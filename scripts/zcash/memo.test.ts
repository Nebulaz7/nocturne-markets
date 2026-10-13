import crypto from "crypto";
import {
  computeCommitment,
  packBetMemo,
  unpackBetMemo,
  encodeZip321Memo,
  decodeZip321Memo,
  generateZip321PaymentUri,
  MAX_MEMO_BYTES,
} from "./memo.ts";

function runTests() {
  console.log("=== Running ZIP-321 Memo Unit Tests ===");

  // 1. Generate test commitment
  const testSecret = crypto.randomBytes(32).toString("hex");
  const commitment = computeCommitment({
    side: "YES",
    secret: testSecret,
    marketId: "polymarket-104928",
  });

  console.log("1. Commitment generated:", commitment.toString("hex"));
  if (commitment.length !== 32) {
    throw new Error("Commitment length is not 32 bytes");
  }

  // 2. Pack memo with test return address
  const testReturnAddr = "utest1zcs8xwkf9u4w98j2m03d7v4hsn4l9f7a9q2k4l9f7a9q2k4l9f7a9q2k4l9f7a";
  const packed = packBetMemo({
    commitment,
    returnAddress: testReturnAddr,
  });

  console.log(`2. Packed memo buffer length: ${packed.length} bytes (Must be exactly ${MAX_MEMO_BYTES})`);
  if (packed.length !== MAX_MEMO_BYTES) {
    throw new Error(`Packed memo length was ${packed.length}, expected ${MAX_MEMO_BYTES}`);
  }

  // 3. Encode to ZIP-321 base64url
  const encoded = encodeZip321Memo(packed);
  console.log(`3. Encoded base64url length: ${encoded.length} chars`);
  if (encoded.includes("=") || encoded.includes("+") || encoded.includes("/")) {
    throw new Error("ZIP-321 memo contains invalid characters or padding '='");
  }

  // 4. Decode back from base64url
  const decodedBuffer = decodeZip321Memo(encoded);
  if (decodedBuffer.length !== MAX_MEMO_BYTES) {
    throw new Error("Decoded buffer length mismatch");
  }

  // 5. Unpack structured fields
  const unpacked = unpackBetMemo(decodedBuffer);
  console.log("4. Unpacked return address:", unpacked.returnAddress);
  console.log("5. Unpacked commitment:", unpacked.commitment);

  if (unpacked.commitment !== commitment.toString("hex")) {
    throw new Error("Unpacked commitment does not match original");
  }
  if (unpacked.returnAddress !== testReturnAddr) {
    throw new Error("Unpacked return address does not match original");
  }

  // 6. Test ZIP-321 URI generation
  const potAddress = "utest1potaddress999999999999999999999999999999999999999999999999999999";
  const uri = generateZip321PaymentUri({
    address: potAddress,
    amountZec: 1.0,
    memoBase64url: encoded,
    message: "Nocturne: Polymarket 104928 Bet",
  });

  console.log("6. Generated Payment URI sample (truncated):", uri.slice(0, 100) + "...");
  if (!uri.startsWith("zcash:utest1potaddress") || !uri.includes("amount=1") || !uri.includes("memo=")) {
    throw new Error("Invalid URI structure");
  }

  console.log("\n>>> ALL MEMO ENCODING/DECODING TESTS PASSED SUCCESSFULLY! <<<\n");
}

runTests();
