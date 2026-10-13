import { ZingoWalletBridge } from "./wallet_bridge.ts";
import {
  decodeBetMemoV2,
  decryptPayoutEnvelope,
  decodeZip321Memo,
  unpackBetMemo,
} from "./memo.ts";
import { ZCASH_CONFIG } from "./config.ts";

export interface VerifiedBetDeposit {
  txid: string;
  blockHeight: number;
  amountZats: bigint;
  amountZec: number;
  marketId: number | string;
  commitment: string;
  returnAddress?: string;
  tlockEnvelope?: Buffer;
  payoutEnvelope?: Buffer;
  memoVersion: number;
  detectedAt: string;
}

/**
 * Scans the pot wallet for incoming shielded bets and validates their memos.
 * Fully supports NOC2: Dual-Envelope Timelock format.
 */
export async function scanForBetDeposits(
  bridge: ZingoWalletBridge,
  coordinatorSecretKey?: Uint8Array
): Promise<VerifiedBetDeposit[]> {
  console.log("1. Syncing pot wallet with lightwalletd...");
  await bridge.sync();

  console.log("2. Fetching incoming notes and decrypted memos...");
  const notes = await bridge.listNotes();
  const validBets: VerifiedBetDeposit[] = [];

  for (const note of notes) {
    if (!note.memo) continue;

    const trimmedMemo = note.memo.trim();

    // Check if memo is NOC2 Dual-Envelope format
    if (trimmedMemo.includes("NOC2:")) {
      try {
        const noc2Start = trimmedMemo.indexOf("NOC2:");
        const noc2Str = trimmedMemo.substring(noc2Start);
        const decodedV2 = decodeBetMemoV2(noc2Str);

        let returnAddress: string | undefined;
        if (coordinatorSecretKey) {
          try {
            returnAddress = decryptPayoutEnvelope({
              payoutEnvelope: decodedV2.payoutEnvelope,
              coordinatorSecretKey,
              marketId: decodedV2.marketId,
            });
          } catch (err: any) {
            console.warn(`[Warning] Could not decrypt payout address for tx ${note.txid}: ${err.message}`);
          }
        }

        const amountZec = Number(note.amountZats) / 100_000_000;

        validBets.push({
          txid: note.txid,
          blockHeight: note.blockHeight,
          amountZats: note.amountZats,
          amountZec,
          marketId: decodedV2.marketId,
          commitment: decodedV2.commitment,
          returnAddress,
          tlockEnvelope: decodedV2.tlockEnvelope,
          payoutEnvelope: decodedV2.payoutEnvelope,
          memoVersion: 2,
          detectedAt: new Date().toISOString(),
        });
        continue;
      } catch (err: any) {
        console.debug(`Note in tx ${note.txid} failed NOC2 parse: ${err.message}`);
      }
    }

    // Fallback: Legacy V1 format
    try {
      let memoBuffer: Buffer;
      if (trimmedMemo.startsWith("base64:")) {
        memoBuffer = Buffer.from(trimmedMemo.slice(7), "base64");
      } else {
        memoBuffer = decodeZip321Memo(trimmedMemo);
      }

      const unpacked = unpackBetMemo(memoBuffer);
      const amountZec = Number(note.amountZats) / 100_000_000;

      validBets.push({
        txid: note.txid,
        blockHeight: note.blockHeight,
        amountZats: note.amountZats,
        amountZec,
        marketId: "legacy-v1",
        commitment: unpacked.commitment,
        returnAddress: unpacked.returnAddress,
        memoVersion: 1,
        detectedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore non-bet memos
    }
  }

  return validBets;
}

if (process.argv[1]?.endsWith("03_watch_deposits.ts")) {
  async function main() {
    console.log("=== Nocturne Markets: Deposit Watcher ===\n");
    const bridge = new ZingoWalletBridge();

    const potAddress = await bridge.getPotAddress().catch(() => "Not initialized");
    console.log(`Watching Pot Address: ${potAddress}\n`);

    const coordSkHex = process.env.COORDINATOR_SECRET_KEY;
    const coordinatorSecretKey = coordSkHex ? Buffer.from(coordSkHex, "hex") : undefined;

    const deposits = await scanForBetDeposits(bridge, coordinatorSecretKey);
    console.log(`\nFound ${deposits.length} verified bet deposit(s):`);
    console.dir(deposits, { depth: null });
  }

  main().catch((err) => {
    console.error("Deposit watcher error:", err.message);
  });
}
