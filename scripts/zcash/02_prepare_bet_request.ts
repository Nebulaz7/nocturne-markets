import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  packTlockEnvelope,
  encryptPayoutEnvelope,
  encodeBetMemoV2,
  computeCommitment,
  generateZip321PaymentUri,
  drandRoundForTimestamp,
  generateCoordinatorKeypair,
  type BetSide,
} from "./memo.ts";

export interface PreparedBetReceiptV2 {
  marketId: number | string;
  side: BetSide;
  amountZec: number;
  secret: string; // 32-char hex (16 bytes)
  commitment: string; // SHA-256(tlockEnvelope)
  drandRound: string;
  returnAddress: string;
  potAddress: string;
  paymentUri: string;
  memoUtf8: string;
  createdAt: string;
}

/**
 * Prepares a Zero-POST Dual-Envelope bet request.
 * Completely local to the client browser:
 * - Timelock encrypts (side + secret) to drand Quicknet close round
 * - Encrypts return address to Coordinator X25519 public key
 * - Constructs standard ZIP-321 Payment URI
 * - Zero HTTP network requests required from bettor!
 */
export async function prepareBetV2(params: {
  marketId: number | string;
  side: BetSide;
  amountZec: number;
  potAddress: string;
  returnAddress: string;
  coordinatorPublicKey: Uint8Array;
  closeTimestamp?: number; // Unix seconds
  mock?: boolean;
}): Promise<PreparedBetReceiptV2> {
  const {
    marketId,
    side,
    amountZec,
    potAddress,
    returnAddress,
    coordinatorPublicKey,
    mock = false,
  } = params;

  // 1. Target close time defaults to +5 minutes from now if not specified
  const closeTimestamp = params.closeTimestamp ?? Math.floor(Date.now() / 1000) + 300;
  const drandRound = drandRoundForTimestamp(closeTimestamp);

  // 2. Generate local 16-byte random secret (32 hex characters)
  const secret = crypto.randomBytes(16).toString("hex");

  // 3. Timelock encrypt (side + secret) to drand Quicknet round
  const tlockEnvelope = await packTlockEnvelope({
    round: drandRound,
    side,
    secret,
    mock,
  });

  // 4. Encrypt user's shielded return address to Coordinator's public key
  const payoutEnvelope = encryptPayoutEnvelope({
    address: returnAddress,
    coordinatorPublicKey,
    marketId,
  });

  // 5. Pack into 500-byte valid ASCII UTF-8 memo starting with NOC2:
  const memoUtf8 = encodeBetMemoV2({
    marketId,
    tlockEnvelope,
    payoutEnvelope,
  });

  // 6. Define commitment as SHA-256(tlockEnvelope)
  const commitment = computeCommitment(tlockEnvelope);

  // 7. Generate ZIP-321 Payment URI
  const paymentUri = generateZip321PaymentUri({
    address: potAddress,
    amountZec,
    memoUtf8,
    message: `Nocturne Bet: Market ${marketId} (${amountZec} ZEC)`,
  });

  const receipt: PreparedBetReceiptV2 = {
    marketId,
    side,
    amountZec,
    secret,
    commitment,
    drandRound: drandRound.toString(),
    returnAddress,
    potAddress,
    paymentUri,
    memoUtf8,
    createdAt: new Date().toISOString(),
  };

  return receipt;
}

// Backward-compatible sync wrapper if needed
export function prepareBet(params: {
  marketId: string;
  side: "YES" | "NO";
  amountZec: number;
  potAddress: string;
  returnAddress: string;
}) {
  const mockCoord = generateCoordinatorKeypair();
  const secret = crypto.randomBytes(16).toString("hex");
  const round = drandRoundForTimestamp(Math.floor(Date.now() / 1000) + 300);

  // Synchronous mock fallback for legacy tests
  const sideByte = params.side === "YES" ? 0x01 : 0x00;
  const tlockEnvelope = Buffer.alloc(217);
  tlockEnvelope.writeBigUInt64BE(round, 0);
  tlockEnvelope.fill(0xaa, 8, 8 + 128);
  tlockEnvelope.write("MOCK_QUICKNET_IBE", 8, "utf-8");
  tlockEnvelope.fill(0xbb, 8 + 128, 8 + 128 + 32);
  tlockEnvelope.write("MOCK_HEADER_MAC_", 8 + 128, "utf-8");
  tlockEnvelope.write("MOCK_STREAMNONCE", 8 + 128 + 32, 16, "utf-8");
  tlockEnvelope.writeUInt8(sideByte, 8 + 128 + 32 + 16);
  Buffer.from(secret, "hex").copy(tlockEnvelope, 8 + 128 + 32 + 17, 0, 16);
  tlockEnvelope.write("MOCK_POLY1305TAG", 8 + 128 + 32 + 33, 16, "utf-8");

  const payoutEnvelope = encryptPayoutEnvelope({
    address: params.returnAddress,
    coordinatorPublicKey: mockCoord.publicKey,
    marketId: params.marketId,
  });

  const memoUtf8 = encodeBetMemoV2({
    marketId: params.marketId,
    tlockEnvelope,
    payoutEnvelope,
  });

  const commitment = computeCommitment(tlockEnvelope);

  const paymentUri = generateZip321PaymentUri({
    address: params.potAddress,
    amountZec: params.amountZec,
    memoUtf8,
  });

  return {
    marketId: params.marketId,
    side: params.side,
    amountZec: params.amountZec,
    secret,
    commitment,
    returnAddress: params.returnAddress,
    potAddress: params.potAddress,
    paymentUri,
    memoBase64url: Buffer.from(memoUtf8, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    memoUtf8,
    createdAt: new Date().toISOString(),
  };
}

if (process.argv[1]?.endsWith("02_prepare_bet_request.ts")) {
  async function main() {
    console.log("=== Nocturne Markets: Zero-POST Dual-Envelope Bet Preparation ===\n");

    const sampleCoordinator = generateCoordinatorKeypair();
    const samplePotAddress =
      process.env.POT_ADDRESS ||
      "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
    const sampleReturnAddress =
      process.env.RETURN_ADDRESS ||
      "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

    const receipt = await prepareBetV2({
      marketId: "polymarket-sample-btc-2026",
      side: "YES",
      amountZec: 1.0,
      potAddress: samplePotAddress,
      returnAddress: sampleReturnAddress,
      coordinatorPublicKey: sampleCoordinator.publicKey,
      mock: true,
    });

    console.log("1. Client Bet Details (Stored ONLY in browser localStorage):");
    console.log(`   Market ID:      ${receipt.marketId}`);
    console.log(`   Side:           ${receipt.side} (Timelocked in tlock envelope)`);
    console.log(`   Amount:         ${receipt.amountZec} ZEC`);
    console.log(`   Secret:         ${receipt.secret}`);
    console.log(`   Commitment:     ${receipt.commitment} (SHA-256 of tlock envelope)`);
    console.log(`   Drand Round:    ${receipt.drandRound}`);
    console.log(`   Return Address: ${receipt.returnAddress} (Encrypted to Coordinator)`);
    console.log(`   Pot Address:    ${receipt.potAddress}`);
    console.log(`\n2. Memo UTF-8 String (Length: ${receipt.memoUtf8.length} chars <= 512):`);
    console.log(`   ${receipt.memoUtf8}`);
    console.log("\n3. ZIP-321 Payment URI (Zero HTTP POST needed — Scan with Zashi/YWallet):");
    console.log(`   ${receipt.paymentUri}\n`);

    const receiptPath = path.resolve("./scripts/zcash/sample_receipt.json");
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf-8");
    console.log(`4. Local Client Receipt saved to: ${receiptPath}`);
    console.log("   (Zero HTTP write requests were sent to any server!)\n");
  }

  main().catch((err) => {
    console.error("Error preparing bet:", err);
  });
}
