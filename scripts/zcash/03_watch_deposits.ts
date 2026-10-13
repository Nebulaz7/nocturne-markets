import { ZingoWalletBridge } from "./wallet_bridge.ts";
import { decodeZip321Memo, unpackBetMemo, DecodedBetMemo } from "./memo.ts";
import { ZCASH_CONFIG } from "./config.ts";

export interface VerifiedBetDeposit {
  txid: string;
  blockHeight: number;
  amountZats: number;
  amountZec: number;
  commitment: string;
  returnAddress: string;
  detectedAt: string;
}

/**
 * Scans the pot wallet for incoming shielded bets and validates their memos.
 */
export async function scanForBetDeposits(
  bridge: ZingoWalletBridge
): Promise<VerifiedBetDeposit[]> {
  console.log("1. Syncing pot wallet with lightwalletd...");
  await bridge.sync();

  console.log("2. Fetching incoming notes and decrypted memos...");
  const notes = await bridge.listNotes();
  const validBets: VerifiedBetDeposit[] = [];

  for (const note of notes) {
    if (!note.memo) continue;

    try {
      // Decode memo from base64url or raw byte string
      let memoBuffer: Buffer;
      if (note.memo.startsWith("base64:")) {
        memoBuffer = Buffer.from(note.memo.slice(7), "base64");
      } else {
        memoBuffer = decodeZip321Memo(note.memo);
      }

      const unpacked: DecodedBetMemo = unpackBetMemo(memoBuffer);

      // Verify chip size matches standard increments
      const amountZec = note.amountZats / 100_000_000;
      const isValidChip = Object.values(ZCASH_CONFIG.chipSizesZats).includes(note.amountZats);

      if (!isValidChip) {
        console.warn(
          `[Warning] Note in tx ${note.txid} has non-standard chip size (${amountZec} ZEC). Expected 1, 5, or 10 ZEC.`
        );
      }

      validBets.push({
        txid: note.txid,
        blockHeight: note.blockHeight,
        amountZats: note.amountZats,
        amountZec,
        commitment: unpacked.commitment,
        returnAddress: unpacked.returnAddress,
        detectedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Ignore non-bet memos
      console.debug(`Note in tx ${note.txid} does not match Nocturne bet format: ${err}`);
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

    const deposits = await scanForBetDeposits(bridge);
    console.log(`\nFound ${deposits.length} verified bet deposit(s):`);
    console.dir(deposits, { depth: null });
  }

  main().catch((err) => {
    console.error("Deposit watcher error:", err.message);
  });
}
