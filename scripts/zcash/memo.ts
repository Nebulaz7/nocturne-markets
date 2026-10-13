import crypto from "crypto";

export const MEMO_VERSION = 0x01;
export const MAX_MEMO_BYTES = 512;
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
 * Computes SHA-256 commitment for a bet:
 * SHA-256(side || secret || marketId)
 */
export function computeCommitment(data: BetCommitmentData): Buffer {
  const secretBuffer = Buffer.from(data.secret, "hex");
  const payload = Buffer.concat([
    Buffer.from(data.side, "utf-8"),
    secretBuffer,
    Buffer.from(data.marketId, "utf-8"),
  ]);
  return crypto.createHash("sha256").update(payload).digest();
}

/**
 * Packs the bet commitment and return address into a binary buffer:
 * [1B version] + [32B commitment] + [2B returnAddressLen] + [returnAddress bytes]
 * Followed by zero-padding up to 512 bytes.
 */
export function packBetMemo(params: {
  version?: number;
  commitment: Buffer; // 32 bytes
  returnAddress: string;
}): Buffer {
  const version = params.version ?? MEMO_VERSION;
  if (params.commitment.length !== COMMITMENT_BYTES) {
    throw new Error(`Commitment must be exactly ${COMMITMENT_BYTES} bytes`);
  }

  const addrBuffer = Buffer.from(params.returnAddress.trim(), "utf-8");
  const headerLen = 1 + COMMITMENT_BYTES + 2; // 35 bytes
  const totalLen = headerLen + addrBuffer.length;

  if (totalLen > MAX_MEMO_BYTES) {
    throw new Error(
      `Packed memo length (${totalLen} bytes) exceeds maximum limit (${MAX_MEMO_BYTES} bytes)`
    );
  }

  const buffer = Buffer.alloc(MAX_MEMO_BYTES, 0); // Pre-fill with 0x00 padding
  buffer.writeUInt8(version, 0);
  params.commitment.copy(buffer, 1);
  buffer.writeUInt16BE(addrBuffer.length, 33);
  addrBuffer.copy(buffer, 35);

  return buffer;
}

/**
 * Unpacks binary memo bytes into structured commitment and return address.
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

/**
 * Encodes memo buffer into ZIP-321 base64url format:
 * - RFC 4648 section 5 alphabet (- and _)
 * - Trailing '=' padding characters MUST be removed.
 */
export function encodeZip321Memo(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes ZIP-321 base64url string back to buffer.
 */
export function decodeZip321Memo(base64url: string): Buffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

/**
 * Constructs a full ZIP-321 Payment URI:
 * zcash:<address>?amount=<amount>&memo=<base64url>&message=<msg>
 */
export function generateZip321PaymentUri(params: {
  address: string;
  amountZec: number | string;
  memoBase64url: string;
  message?: string;
}): string {
  const { address, amountZec, memoBase64url, message } = params;
  let uri = `zcash:${address}?amount=${amountZec}&memo=${memoBase64url}`;
  if (message) {
    uri += `&message=${encodeURIComponent(message)}`;
  }
  return uri;
}
