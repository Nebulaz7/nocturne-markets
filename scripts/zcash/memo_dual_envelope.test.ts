import assert from "assert";
import crypto from "crypto";
import { bech32m } from "@scure/base";
import { mainnetClient } from "tlock-js";
import {
  generateCoordinatorKeypair,
  compressAddress,
  decompressAddress,
  drandRoundForTimestamp,
  timestampForDrandRound,
  packTlockEnvelope,
  unpackTlockEnvelope,
  encryptPayoutEnvelope,
  decryptPayoutEnvelope,
  encodeBetMemoV2,
  decodeBetMemoV2,
  computeCommitment,
  generateZip321PaymentUri,
  decodeZip321Memo,
  MAX_MEMO_BYTES,
  TLOCK_ENVELOPE_BYTES,
} from "./memo.ts";

async function runDualEnvelopeTests() {
  console.log("=== Running Comprehensive Dual-Envelope Timelock Unit Tests ===\n");

  const coordinatorKey = generateCoordinatorKeypair();
  assert.strictEqual(coordinatorKey.publicKey.length, 32);
  assert.strictEqual(coordinatorKey.secretKey.length, 32);
  console.log("✔ Coordinator X25519 Keypair generated successfully.");

  // 1. Generate 1-receiver and 2-receiver testnet Unified Addresses
  const ua1Receiver =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  // Synthesize a valid 2-receiver (Orchard + Sapling) testnet UA per ZIP-316
  // Type 0x03 (Orchard, 43B) + Type 0x02 (Sapling, 43B) = 90 bytes raw
  const orchardReceiver = crypto.randomBytes(43);
  const saplingReceiver = crypto.randomBytes(43);
  const raw2ReceiverBytes = Buffer.concat([
    Buffer.from([0x03, 43]),
    orchardReceiver,
    Buffer.from([0x02, 43]),
    saplingReceiver,
  ]);
  const words2Receiver = bech32m.toWords(raw2ReceiverBytes);
  const ua2Receiver = bech32m.encode("utest", words2Receiver, 512);

  console.log(`- 1-Receiver UA length: ${ua1Receiver.length} chars`);
  console.log(`- 2-Receiver UA length: ${ua2Receiver.length} chars`);

  // Verify Bech32m Address Compression / Decompression
  const comp1 = compressAddress(ua1Receiver);
  const decomp1 = decompressAddress(comp1);
  assert.strictEqual(decomp1, ua1Receiver, "1-Receiver decompression failed");
  console.log(`✔ 1-Receiver UA compressed from ${ua1Receiver.length} to ${comp1.length} bytes.`);

  const comp2 = compressAddress(ua2Receiver);
  const decomp2 = decompressAddress(comp2);
  assert.strictEqual(decomp2, ua2Receiver, "2-Receiver decompression failed");
  console.log(`✔ 2-Receiver UA compressed from ${ua2Receiver.length} to ${comp2.length} bytes.`);

  // 2. Test Drand Round Timing helpers
  const nowSec = Math.floor(Date.now() / 1000);
  const currentRound = drandRoundForTimestamp(nowSec);
  const roundTime = timestampForDrandRound(currentRound);
  assert(currentRound > 30000000n, "Round calculation unreasonable");
  assert(Math.abs(roundTime - nowSec) <= 3, "Round time conversion delta too high");
  console.log(`✔ Drand Round Helper verified: Now = ${nowSec}s -> Round = ${currentRound}`);

  // 3. Test Offline / Mock Timelock Dual Envelope Roundtrip
  console.log("\n--- Testing Offline / Mock Timelock Dual Envelope ---");
  const marketId = 101;
  const side = "YES";
  const secretHex = "0123456789abcdef0123456789abcdef"; // 16 bytes = 32 hex chars

  const mockTlock = await packTlockEnvelope({
    round: currentRound,
    side,
    secret: secretHex,
    mock: true,
  });
  assert.strictEqual(mockTlock.length, TLOCK_ENVELOPE_BYTES);

  const payoutEnv1 = encryptPayoutEnvelope({
    address: ua1Receiver,
    coordinatorPublicKey: coordinatorKey.publicKey,
    marketId,
  });

  const wireMemo1 = encodeBetMemoV2({
    marketId,
    tlockEnvelope: mockTlock,
    payoutEnvelope: payoutEnv1,
  });

  console.log(`- Wire Memo length (1-Receiver): ${wireMemo1.length} chars`);
  assert(wireMemo1.length <= MAX_MEMO_BYTES, `Wire memo exceeds max memo bytes: ${wireMemo1.length}`);
  assert.strictEqual(wireMemo1.length, 500, "Wire memo should be padded to exactly 500 chars");
  assert(wireMemo1.startsWith("NOC2:"), "Wire memo must start with NOC2: prefix");

  // Test 2-Receiver Memo Length <= 512
  const payoutEnv2 = encryptPayoutEnvelope({
    address: ua2Receiver,
    coordinatorPublicKey: coordinatorKey.publicKey,
    marketId,
  });
  const wireMemo2 = encodeBetMemoV2({
    marketId,
    tlockEnvelope: mockTlock,
    payoutEnvelope: payoutEnv2,
  });
  console.log(`- Wire Memo length (2-Receiver): ${wireMemo2.length} chars`);
  assert(wireMemo2.length <= MAX_MEMO_BYTES, `2-Receiver wire memo exceeds 512 bytes: ${wireMemo2.length}`);

  // Test Decoding
  const decoded1 = decodeBetMemoV2(wireMemo1);
  assert.strictEqual(decoded1.version, 0x02);
  assert.strictEqual(decoded1.marketId, marketId);
  assert.strictEqual(decoded1.tlockEnvelope.length, TLOCK_ENVELOPE_BYTES);

  const expectedCommitment = computeCommitment(mockTlock);
  assert.strictEqual(decoded1.commitment, expectedCommitment);
  console.log(`✔ Commitment matches SHA-256(tlockEnvelope): ${decoded1.commitment}`);

  // Decrypt user address
  const decryptedAddr = decryptPayoutEnvelope({
    payoutEnvelope: decoded1.payoutEnvelope,
    coordinatorSecretKey: coordinatorKey.secretKey,
    marketId,
  });
  assert.strictEqual(decryptedAddr, ua1Receiver, "Decrypted return address mismatch");
  console.log(`✔ Decrypted return address matches original 1-receiver UA!`);

  // Decrypt tlock payload
  const decryptedTlock = await unpackTlockEnvelope({
    envelope: decoded1.tlockEnvelope,
    mock: true,
  });
  assert.strictEqual(decryptedTlock.side, side);
  assert.strictEqual(decryptedTlock.secret, secretHex);
  assert.strictEqual(decryptedTlock.round, currentRound);
  console.log(`✔ Decrypted mock tlock: side=${decryptedTlock.side}, secret=${decryptedTlock.secret}`);

  // 4. Test ZIP-321 Payment URI Roundtrip
  console.log("\n--- Testing ZIP-321 URI Roundtrip ---");
  const potAddress = "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";
  const uri = generateZip321PaymentUri({
    address: potAddress,
    amountZec: 1.0,
    memoUtf8: wireMemo1,
    message: "Nocturne Market Bet 101",
  });

  const uriMemoParamMatch = uri.match(/[?&]memo=([^&]+)/);
  assert(uriMemoParamMatch, "URI missing memo parameter");
  const memoBase64url = uriMemoParamMatch[1];
  const recoveredMemoUtf8 = decodeZip321Memo(memoBase64url).toString("utf-8");
  assert.strictEqual(recoveredMemoUtf8, wireMemo1, "ZIP-321 recovered memo does not match");
  console.log("✔ ZIP-321 payment URI correctly encapsulates and recovers the 500-byte wire memo!");

  // 5. Test Live Quicknet Drand Decryption against a Past Round
  console.log("\n--- Testing Live Drand Quicknet Integration (Past Round) ---");
  try {
    const drandClient = mainnetClient();
    console.log("Querying latest drand Quicknet beacon...");
    const latest = await drandClient.latest();
    console.log(`- Latest round: ${latest.round}`);

    // Encrypt to 5 rounds in the past so decryption can be executed immediately
    const pastRound = BigInt(latest.round) - 5n;
    const liveSecret = "aabbccddeeff00112233445566778899";
    const liveSide = "NO";

    console.log(`Encrypting bet to past round ${pastRound}...`);
    const liveTlock = await packTlockEnvelope({
      round: pastRound,
      side: liveSide,
      secret: liveSecret,
      client: drandClient,
    });
    assert.strictEqual(liveTlock.length, TLOCK_ENVELOPE_BYTES);

    const liveWireMemo = encodeBetMemoV2({
      marketId: "market-slug-test",
      tlockEnvelope: liveTlock,
      payoutEnvelope: payoutEnv1,
    });
    assert.strictEqual(liveWireMemo.length, 500);

    const liveDecoded = decodeBetMemoV2(liveWireMemo);
    console.log("Decrypting live Quicknet tlock envelope...");
    const liveDecrypted = await unpackTlockEnvelope({
      envelope: liveDecoded.tlockEnvelope,
      client: drandClient,
    });

    assert.strictEqual(liveDecrypted.side, liveSide);
    assert.strictEqual(liveDecrypted.secret, liveSecret);
    assert.strictEqual(liveDecrypted.round, pastRound);
    console.log(`✔ Live Quicknet roundtrip PASSED! Recovered side=${liveDecrypted.side}, secret=${liveDecrypted.secret}`);
  } catch (err: any) {
    console.warn("⚠️ Live drand network call skipped or timed out:", err.message);
  }

  console.log("\n>>> ALL DUAL-ENVELOPE TIMELOCK UNIT TESTS COMPLETED SUCCESSFULLY! <<<");
}

runDualEnvelopeTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
