import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  computeCommitment,
  packBetMemo,
  encodeZip321Memo,
  generateZip321PaymentUri,
} from "./memo.ts";
import { ZCASH_CONFIG } from "./config.ts";

export interface PreparedBetReceipt {
  marketId: string;
  side: "YES" | "NO";
  amountZec: number;
  secret: string;
  commitment: string;
  returnAddress: string;
  potAddress: string;
  paymentUri: string;
  memoBase64url: string;
  createdAt: string;
}

/**
 * Prepares a bet request and generates client receipt + payment URI.
 */
export function prepareBet(params: {
  marketId: string;
  side: "YES" | "NO";
  amountZec: number;
  potAddress: string;
  returnAddress: string;
}): PreparedBetReceipt {
  const { marketId, side, amountZec, potAddress, returnAddress } = params;

  // 1. Generate client-side 32-byte random secret
  const secret = crypto.randomBytes(32).toString("hex");

  // 2. Compute commitment: SHA-256(side || secret || marketId)
  const commitmentBuffer = computeCommitment({
    side,
    secret,
    marketId,
  });
  const commitment = commitmentBuffer.toString("hex");

  // 3. Pack memo payload: [version 1B] + [commitment 32B] + [addrLen 2B] + [returnAddr] + padding
  const packedMemo = packBetMemo({
    commitment: commitmentBuffer,
    returnAddress,
  });

  // 4. Base64url encode without padding per ZIP-321
  const memoBase64url = encodeZip321Memo(packedMemo);

  // 5. Generate ZIP-321 Payment URI
  const paymentUri = generateZip321PaymentUri({
    address: potAddress,
    amountZec,
    memoBase64url,
    message: `Nocturne Market: ${marketId} (${amountZec} ZEC)`,
  });

  const receipt: PreparedBetReceipt = {
    marketId,
    side,
    amountZec,
    secret,
    commitment,
    returnAddress,
    potAddress,
    paymentUri,
    memoBase64url,
    createdAt: new Date().toISOString(),
  };

  return receipt;
}

// CLI runner if executed directly
if (process.argv[1]?.endsWith("02_prepare_bet_request.ts")) {
  console.log("=== Nocturne Markets: Prepare Bet Request (ZIP-321) ===\n");

  const samplePotAddress =
    process.env.POT_ADDRESS ||
    "utest1potmarketdemo99999999999999999999999999999999999999999999999999999";
  const sampleReturnAddress =
    process.env.RETURN_ADDRESS ||
    "utest1bettorwinneraddress88888888888888888888888888888888888888888888888";

  const receipt = prepareBet({
    marketId: "polymarket-sample-btc-2026",
    side: "YES",
    amountZec: 1.0,
    potAddress: samplePotAddress,
    returnAddress: sampleReturnAddress,
  });

  console.log("1. Bet Details:");
  console.log(`   Market ID:      ${receipt.marketId}`);
  console.log(`   Side:           ${receipt.side} (SEALED UNTIL CLOSE)`);
  console.log(`   Amount:         ${receipt.amountZec} ZEC`);
  console.log(`   Secret:         ${receipt.secret}`);
  console.log(`   Commitment:     ${receipt.commitment}`);
  console.log(`   Return Address: ${receipt.returnAddress}`);
  console.log(`   Pot Address:    ${receipt.potAddress}`);
  console.log("\n2. ZIP-321 Payment URI:");
  console.log(`   ${receipt.paymentUri}\n`);

  const receiptPath = path.resolve("./scripts/zcash/sample_receipt.json");
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf-8");
  console.log(`3. Client Receipt saved to: ${receiptPath}`);
  console.log("   (Keep this receipt code safe to reveal after market close!)\n");
}
