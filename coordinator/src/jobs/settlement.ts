import { CoordinatorDatabase, type BetRecord, type MarketRecord } from "../db/index.ts";
import {
  unpackTlockEnvelope,
  decryptPayoutEnvelope,
  computeMerkleRoot,
  drandRoundForTimestamp,
} from "../../../packages/shared/src/memo.ts";
import {
  calculateParimutuelPayouts,
  zecToZats,
  type BetPosition,
} from "../../../packages/shared/src/parimutuel.ts";
import type { WalletBridgeLike } from "./depositWatcher.ts";
import { ZingoWalletBridge } from "../../../scripts/zcash/wallet_bridge.ts";

export interface SettlementWorkerOptions {
  db: CoordinatorDatabase;
  coordinatorSecretKey: Uint8Array;
  potUvk?: string;
  bridge?: WalletBridgeLike | ZingoWalletBridge;
  mockDrand?: boolean;
}

/**
 * Runs a single settlement sweep across all active markets in the database:
 * 1. Closes expired markets and automatically decrypts all timelocked bets.
 * 2. Computes the Merkle root of commitments for public audit.
 * 3. Resolves outcomes, computes fee-on-profit parimutuel shares, and generates payout records.
 * 4. Broadcasts shielded payouts via ZingoClient mutex.
 */
export async function processSettlementOnce(
  options: SettlementWorkerOptions
): Promise<{
  marketsClosed: number;
  marketsSettled: number;
  payoutsCreated: number;
}> {
  const { db, coordinatorSecretKey, potUvk, bridge, mockDrand = true } = options;
  const now = Math.floor(Date.now() / 1000);

  let marketsClosed = 0;
  let marketsSettled = 0;
  let payoutsCreated = 0;

  // 1. Process OPEN markets that have reached close time
  const openMarkets = db.listMarkets({ status: "OPEN" });

  for (const market of openMarkets) {
    if (market.close_time > now) continue;

    console.log(`[SettlementWorker] Closing Market ${market.id} (Reached close time)...`);
    db.updateMarketStatus(market.id, "CLOSED");
    marketsClosed++;

    // Timelock Decrypt all bets in this market
    const bets = db.listBetsForMarket(market.id);
    let yesZats = 0;
    let noZats = 0;
    const commitments: string[] = [];

    for (const bet of bets) {
      commitments.push(bet.commitment);

      if (!bet.decrypted_side) {
        try {
          const decrypted = await unpackTlockEnvelope({
            envelope: Buffer.from(bet.tlock_envelope),
            mock: mockDrand,
          });

          db.updateBetDecryptedSide(bet.id, decrypted.side);
          if (decrypted.side === "YES") {
            yesZats += bet.amount_zats;
          } else {
            noZats += bet.amount_zats;
          }
          console.log(`[SettlementWorker] Unlocked bet ${bet.id}: Side = ${decrypted.side}`);
        } catch (err: any) {
          console.error(`[SettlementWorker] Failed to decrypt tlock envelope for bet ${bet.id}:`, err.message);
        }
      } else {
        if (bet.decrypted_side === "YES") yesZats += bet.amount_zats;
        else noZats += bet.amount_zats;
      }
    }

    const totalZats = yesZats + noZats;
    db.updateMarketPots(market.id, totalZats, yesZats, noZats);

    // Compute Merkle Root of all commitments in the market
    const merkleRoot = computeMerkleRoot(commitments);
    db.updateMarketStatus(market.id, "CLOSED", null, merkleRoot);
    console.log(`[SettlementWorker] Merkle Root Published: ${merkleRoot.slice(0, 16)}...`);
  }

  // 2. Process CLOSED markets ready for resolution & payout
  const closedMarkets = db.listMarkets({ status: "CLOSED" });

  for (const market of closedMarkets) {
    // For Blitz markets or test markets, resolve outcome automatically
    let outcome = market.outcome;
    if (!outcome) {
      if (market.id.startsWith("blitz-") || market.id.startsWith("test-")) {
        // Default Blitz or test markets resolve to YES for demo simulation
        outcome = "YES";
        db.updateMarketStatus(market.id, "RESOLVED", outcome);
        console.log(`[SettlementWorker] Blitz/Demo Market ${market.id} Resolved: Outcome = ${outcome}`);
      } else {
        // Awaiting external oracle resolution
        continue;
      }
    }

    // Parimutuel settlement
    const bets = db.listBetsForMarket(market.id);
    if (bets.length === 0) {
      db.updateMarketStatus(market.id, "SETTLED");
      continue;
    }

    // Decrypt return addresses for all winning bets in ephemeral memory only
    const betPositions: BetPosition[] = [];
    const decryptedAddresses: Map<string, string> = new Map();

    for (const bet of bets) {
      try {
        const decryptedAddr = decryptPayoutEnvelope({
          payoutEnvelope: Buffer.from(bet.payout_envelope),
          coordinatorSecretKey,
          marketId: market.id,
        });
        decryptedAddresses.set(bet.id, decryptedAddr);

        betPositions.push({
          id: bet.id,
          side: bet.decrypted_side || "YES",
          stakeZats: BigInt(bet.amount_zats),
          returnAddress: decryptedAddr,
        });
      } catch (err: any) {
        console.error(`[SettlementWorker] Failed to decrypt payout address for bet ${bet.id}:`, err.message);
      }
    }

    // Calculate payouts: Sponsored 1.52x fixed odds for Blitz demo markets, Parimutuel for standard markets
    const isBlitzSponsored = market.id.startsWith("blitz-");
    let settlementPayouts: Array<{
      id: string;
      returnAddress: string;
      side: BetSide;
      stakeZats: bigint;
      grossPayoutZats: bigint;
      netPayoutZats: bigint;
      isRefund: boolean;
    }> = [];

    if (isBlitzSponsored) {
      console.log(
        `[SettlementWorker] Settling Sponsored Blitz Market ${market.id} with 1.52x payout...`
      );
      const zip317Fee = 10000n; // ZIP-317 base fee
      for (const bet of betPositions) {
        if (bet.side === "YES") {
          // 1.52x gross payout sponsored by the pot wallet
          const gross = BigInt(Math.floor(Number(bet.stakeZats) * 1.52));
          const net = gross > zip317Fee ? gross - zip317Fee : 0n;
          settlementPayouts.push({
            id: bet.id,
            returnAddress: bet.returnAddress,
            side: bet.side,
            stakeZats: bet.stakeZats,
            grossPayoutZats: gross,
            netPayoutZats: net,
            isRefund: false,
          });
        } else {
          settlementPayouts.push({
            id: bet.id,
            returnAddress: bet.returnAddress,
            side: bet.side,
            stakeZats: bet.stakeZats,
            grossPayoutZats: 0n,
            netPayoutZats: 0n,
            isRefund: false,
          });
        }
      }
    } else {
      const settlement = calculateParimutuelPayouts({
        bets: betPositions,
        outcome,
      });
      console.log(
        `[SettlementWorker] Settling Market ${market.id}: Status = ${settlement.status}`
      );
      settlementPayouts = settlement.payouts;
    }

    const batchPayouts: Array<{ destinationAddress: string; amountZats: bigint; memo?: string }> = [];
    const createdPayoutRecords: Array<{ id: string }> = [];

    for (const p of settlementPayouts) {
      if (p.grossPayoutZats <= 0n) continue;

      const payoutId = `payout-${market.id.slice(0, 8)}-${p.id}`;
      const existingPayout = db.getPayout(payoutId);
      if (existingPayout) continue;

      // Plaintext address is NOT persisted in SQLite; db.createPayout hashes it
      const payoutRecord = db.createPayout({
        id: payoutId,
        market_id: market.id,
        bet_id: p.id,
        amount_zats: Number(p.netPayoutZats),
        destination_address: p.returnAddress,
      });

      payoutsCreated++;
      createdPayoutRecords.push(payoutRecord);
      batchPayouts.push({
        destinationAddress: p.returnAddress,
        amountZats: p.netPayoutZats,
        memo: isBlitzSponsored
          ? `Nocturne Blitz Win: 1.52x Payout`
          : `Nocturne Settlement: ${market.id}`,
      });
    }

    // Batch Shielded Payouts: Dispatch all winner payouts in a single batched transaction
    // to prevent Zcash Orchard unconfirmed change-note locking.
    if (bridge && batchPayouts.length > 0) {
      try {
        console.log(
          `[SettlementWorker] Broadcasting batched shielded payout for ${batchPayouts.length} winners in market ${market.id}...`
        );
        let txid: string;
        if (bridge.sendShieldedPayoutsBatch) {
          txid = await bridge.sendShieldedPayoutsBatch(batchPayouts);
        } else if (bridge.sendShieldedPayout && batchPayouts.length === 1) {
          txid = await bridge.sendShieldedPayout(
            batchPayouts[0].destinationAddress,
            batchPayouts[0].amountZats,
            batchPayouts[0].memo
          );
        } else {
          throw new Error("Wallet bridge does not support batch shielded payouts");
        }

        for (const record of createdPayoutRecords) {
          db.updatePayoutTxid(record.id, txid, "BROADCASTED");
        }
        console.log(`[SettlementWorker] Shielded Batch Payout Broadcasted! Txid: ${txid}`);
      } catch (err: any) {
        console.warn(`[SettlementWorker] Batch payout broadcast delayed or failed: ${err.message}`);
      }
    }

    // Publish Pot UVK for public viewing key post-settlement audit
    if (potUvk) {
      db.updateMarketUvk(market.id, potUvk);
    }

    db.updateMarketStatus(market.id, "SETTLED");
    marketsSettled++;
    console.log(`[SettlementWorker] Market ${market.id} Settlement Complete!\n`);
  }

  return {
    marketsClosed,
    marketsSettled,
    payoutsCreated,
  };
}

/**
 * Starts the automated settlement worker loop.
 */
export function startSettlementWorker(
  options: SettlementWorkerOptions,
  intervalMs: number = 10000
): { stop: () => void } {
  let isRunning = true;
  let timer: NodeJS.Timeout | null = null;

  async function workerLoop() {
    if (!isRunning) return;
    try {
      await processSettlementOnce(options);
    } catch (err: any) {
      console.error("[SettlementWorker] Error in settlement sweep:", err.message);
    } finally {
      if (isRunning) {
        timer = setTimeout(workerLoop, intervalMs);
      }
    }
  }

  workerLoop();

  return {
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
    },
  };
}
