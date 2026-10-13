import crypto from "crypto";
export * from "../../packages/shared/src/memo.ts";
import {
  MEMO_VERSION_V2,
  MAX_MEMO_BYTES,
  TLOCK_ENVELOPE_BYTES,
  TARGET_MEMO_LENGTH,
  encodeBetMemoV2,
  decodeBetMemoV2,
  packTlockEnvelope,
  unpackTlockEnvelope,
  encryptPayoutEnvelope,
  decryptPayoutEnvelope,
  generateCoordinatorKeypair,
  computeCommitment as computeCommitmentV2,
  encodeZip321Memo,
  decodeZip321Memo,
  generateZip321PaymentUri,
} from "../../packages/shared/src/memo.ts";

export const MEMO_VERSION = 0x01;
export const COMMITMENT_BYTES = 32;

export interface BetCommitmentData {
  side: "YES" | "NO";
  secret: string; // Hex string (32 bytes / 64 hex chars)
  marketId: string;
}

export interface DecodedBetMemo {
  version: number;
  commitment: string; // 64 hex chars
  returnAddress: string;
}

/**
 * Legacy V1 commitment calculation:
 * SHA-256(side || secret || marketId)
 */
export function computeCommitmentV1(data: BetCommitmentData): Buffer {
  const secretBuffer = Buffer.from(data.secret, "hex");
  const payload = Buffer.concat([
    Buffer.from(data.side, "utf-8"),
    secretBuffer,
    Buffer.from(data.marketId, "utf-8"),
  ]);
  return crypto.createHash("sha256").update(payload).digest();
}

/**
 * Packs legacy V1 bet memo into 512-byte buffer.
 */
export function packBetMemo(params: {
  version?: number;
  commitment: Buffer;
  returnAddress: string;
}): Buffer {
  const version = params.version ?? MEMO_VERSION;
  if (params.commitment.length !== COMMITMENT_BYTES) {
    throw new Error(`Commitment must be exactly ${COMMITMENT_BYTES} bytes`);
  }

  const addrBuffer = Buffer.from(params.returnAddress.trim(), "utf-8");
  const headerLen = 1 + COMMITMENT_BYTES + 2;
  const totalLen = headerLen + addrBuffer.length;

  if (totalLen > MAX_MEMO_BYTES) {
    throw new Error(
      `Packed memo length (${totalLen} bytes) exceeds maximum limit (${MAX_MEMO_BYTES} bytes)`
    );
  }

  const buffer = Buffer.alloc(MAX_MEMO_BYTES, 0);
  buffer.writeUInt8(version, 0);
  params.commitment.copy(buffer, 1);
  buffer.writeUInt16BE(addrBuffer.length, 33);
  addrBuffer.copy(buffer, 35);

  return buffer;
}

/**
 * Unpacks legacy V1 memo buffer into structured data.
 */
export function unpackBetMemo(buffer: Buffer): DecodedBetMemo {
  if (buffer.length < 35) {
    throw new Error("Memo buffer too short to contain valid header");
  }

  const version = buffer.readUInt8(0);
  const commitment = buffer.subarray(1, 33).toString("hex");
  const addrLen = buffer.readUInt16BE(33);

  if (35 + addrLen > buffer.length) {
    throw new Error("Invalid address length in memo buffer");
  }

  const returnAddress = buffer.subarray(35, 35 + addrLen).toString("utf-8");

  return {
    version,
    commitment,
    returnAddress,
  };
}
