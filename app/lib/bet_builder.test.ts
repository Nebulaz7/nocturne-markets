import assert from "assert";
import { prepareZeroPostBet } from "./bet_builder.ts";
import { decodeBetMemoV2, unpackTlockEnvelope, decryptPayoutEnvelope } from "../../packages/shared/src/memo.ts";
import nacl from "tweetnacl";

async function runTests() {
  console.log("=== Testing Browser-Compatible Bet Builder (app/lib/bet_builder.ts) ===\n");

  // Generate test coordinator keypair
  const coordKeypair = nacl.box.keyPair();
  const coordPublicKeyHex = Buffer.from(coordKeypair.publicKey).toString("hex");

  const testPotAddress = "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const testReturnAddress = "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  console.log("1. Generating Zero-POST bet in mock mode...");
  const receipt = await prepareZeroPostBet({
    marketId: "blitz-btc-1234",
    side: "YES",
    amountZec: 1.5,
    potAddress: testPotAddress,
    returnAddress: testReturnAddress,
    coordinatorPublicKeyHex: coordPublicKeyHex,
    drandRound: "33095000",
    marketTitle: "Bitcoin Blitz 5-Min",
    mock: true,
  });

  console.log("   Receipt ID:", receipt.id);
  console.log("   Commitment:", receipt.commitment);
  console.log("   Memo length:", receipt.memoUtf8.length);
  assert.strictEqual(receipt.memoUtf8.length, 500, "Memo length must be exactly 500 chars");
  assert.strictEqual(receipt.memoUtf8.startsWith("NOC2:"), true, "Memo must start with NOC2:");
  assert.strictEqual(receipt.paymentUri.startsWith("zcash:"), true, "Payment URI must start with zcash:");

  console.log("2. Verifying roundtrip with coordinator backend decoder (decodeBetMemoV2)...");
  const decoded = decodeBetMemoV2(receipt.memoUtf8);
  assert.strictEqual(decoded.version, 0x02);
  assert.strictEqual(decoded.commitment, receipt.commitment, "Commitment must match exactly");

  console.log("3. Verifying tlock payload unpacking...");
  const tlockPayload = await unpackTlockEnvelope({ envelope: decoded.tlockEnvelope, mock: true });
  assert.strictEqual(tlockPayload.side, "YES");
  assert.strictEqual(tlockPayload.secret, receipt.secret);

  console.log("4. Verifying coordinator payout envelope decryption...");
  const decryptedReturn = decryptPayoutEnvelope({
    payoutEnvelope: decoded.payoutEnvelope,
    coordinatorSecretKey: coordKeypair.secretKey,
    marketId: "blitz-btc-1234",
  });
  assert.strictEqual(decryptedReturn, testReturnAddress);

  console.log("\n>>> ALL CLIENT BET BUILDER TESTS PASSED SUCCESSFULLY! <<<\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
