import { CoordinatorDatabase } from "../db/index.ts";
import type { IncomingNote } from "../../../scripts/zcash/wallet_bridge.ts";
import {
  decodeBetMemoV2,
  decodeZip321Memo,
  normalizeMarketId,
} from "../../../packages/shared/src/memo.ts";

export interface WalletBridgeLike {
  sync(): Promise<string>;
  listNotes(): Promise<IncomingNote[]>;
  sendShieldedPayout?(
    destinationAddress: string,
    amountZats: number | bigint,
    memo?: string
  ): Promise<string>;
}

export interface DepositWatcherResult {
  notesScanned: number;
  newBetsInserted: number;
  latestBlockHeight: number;
}

/**
 * Polls the pot wallet for incoming shielded notes, parses valid NOC2: dual-envelope
 * memos, and commits them idempotently to the SQLite database.
 */
export async function pollDepositsOnce(
  db: CoordinatorDatabase,
  bridge: WalletBridgeLike
): Promise<DepositWatcherResult> {
  // 1. Sync light wallet non-blockingly
  await bridge.sync();

  // 2. Fetch incoming notes
  const notes = await bridge.listNotes();
  let newBetsInserted = 0;
  let maxBlockHeight = parseInt(db.getSyncState("last_scanned_height", "0"), 10);

  for (const note of notes) {
    if (!note.memo) continue;
    if (note.blockHeight > maxBlockHeight) {
      maxBlockHeight = note.blockHeight;
    }

    const trimmedMemo = note.memo.trim();
    if (!trimmedMemo.includes("NOC2:")) continue;

    try {
      const noc2Start = trimmedMemo.indexOf("NOC2:");
      const noc2Str = trimmedMemo.substring(noc2Start);
      const decoded = decodeBetMemoV2(noc2Str);

      // Check for duplicate commitment (idempotency guard)
      const existing = db.getBetByCommitment(decoded.commitment);
      if (existing) continue;

      // Match to market in DB
      // decoded.marketId is a 32-bit unsigned int
      // Look up by integer ID or find market with matching normalized ID
      let market = db.getMarket(decoded.marketId.toString());
      if (!market) {
        // Fallback: search open markets whose normalized id matches
        const allMarkets = db.listMarkets();
        market =
          allMarkets.find((m) => {
            if (m.id === decoded.marketId.toString()) return true;
            return normalizeMarketId(m.id) === decoded.marketId;
          }) ?? null;
      }

      // If no specific market was found, link to the currently active market or default
      if (!market) {
        const openMarkets = db.listMarkets({ status: "OPEN" });
        if (openMarkets.length > 0) {
          market = openMarkets[0];
        }
      }

      if (!market) {
        console.warn(`[DepositWatcher] Note ${note.txid} references unknown market ID ${decoded.marketId}. Skipping.`);
        continue;
      }

      const betId = `bet-${note.txid.slice(0, 8)}-${decoded.commitment.slice(0, 8)}`;

      db.insertBet({
        id: betId,
        market_id: market.id,
        commitment: decoded.commitment,
        amount_zats: Number(note.amountZats),
        tlock_envelope: decoded.tlockEnvelope,
        payout_envelope: decoded.payoutEnvelope,
        deposit_txid: note.txid,
        block_height: note.blockHeight,
      });

      newBetsInserted++;
      console.log(
        `[DepositWatcher] ✔ Verified Bet Recorded: ${betId} for Market ${market.id} (${Number(note.amountZats) / 100_000_000} ZEC)`
      );
    } catch (err: any) {
      console.debug(`[DepositWatcher] Note ${note.txid} failed NOC2 parse: ${err.message}`);
    }
  }

  db.setSyncState("last_scanned_height", maxBlockHeight.toString());

  return {
    notesScanned: notes.length,
    newBetsInserted,
    latestBlockHeight: maxBlockHeight,
  };
}

/**
 * Starts the deposit watcher background polling loop.
 */
export function startDepositWatcher(
  db: CoordinatorDatabase,
  bridge: WalletBridgeLike,
  intervalMs: number = 10000
): { stop: () => void } {
  let isRunning = true;
  let timer: NodeJS.Timeout | null = null;

  async function pollLoop() {
    if (!isRunning) return;
    try {
      await pollDepositsOnce(db, bridge);
    } catch (err: any) {
      console.error("[DepositWatcher] Polling error:", err.message);
    } finally {
      if (isRunning) {
        timer = setTimeout(pollLoop, intervalMs);
      }
    }
  }

  pollLoop();

  return {
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
    },
  };
}
