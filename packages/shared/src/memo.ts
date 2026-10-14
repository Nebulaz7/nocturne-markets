import crypto from "crypto";
import nacl from "tweetnacl";
import { bech32m } from "@scure/base";
import { timelockEncrypt, timelockDecrypt, mainnetClient } from "tlock-js";

export const MEMO_VERSION_V2 = 0x02;
export const MAX_MEMO_BYTES = 512;
export const TARGET_MEMO_LENGTH = 500;
export const TLOCK_ENVELOPE_BYTES = 217;

export const QUICKNET_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
export const QUICKNET_GENESIS_TIME = 1692803367; // August 23, 2023 15:09:27 UTC
export const QUICKNET_PERIOD = 3; // 3 seconds per round

export type BetSide = "YES" | "NO";

export interface DecodedBetMemoV2 {
  version: number;
  marketId: number;
  tlockEnvelope: Buffer;
  payoutEnvelope: Buffer;
  commitment: string; // 32-byte hex string (SHA-256 of tlockEnvelope)
}

export interface DecryptedTlockPayload {
  round: bigint;
  side: BetSide;
  secret: string; // 32-char hex (16 bytes)
}

/**
 * Generates an X25519 keypair for the Coordinator settlement service.
 */
export function generateCoordinatorKeypair(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  return nacl.box.keyPair();
}

/**
 * Normalizes any market ID (integer or slug string) into a 32-bit unsigned integer.
 */
export function normalizeMarketId(marketId: number | string): number {
  if (typeof marketId === "number") {
    return (marketId >>> 0);
  }
  if (/^\d+$/.test(marketId.trim())) {
    return (parseInt(marketId.trim(), 10) >>> 0);
  }
  return crypto.createHash("sha256").update(marketId).digest().readUInt32BE(0);
}

/**
 * Computes the drand Quicknet round for a given Unix timestamp (seconds).
 */
export function drandRoundForTimestamp(timestampSeconds: number): bigint {
  if (timestampSeconds <= QUICKNET_GENESIS_TIME) {
    return 1n;
  }
  const delta = timestampSeconds - QUICKNET_GENESIS_TIME;
  return BigInt(Math.floor(delta / QUICKNET_PERIOD) + 1);
}

/**
 * Computes the Unix timestamp (seconds) when a drand Quicknet round is published.
 */
export function timestampForDrandRound(round: bigint | number): number {
  const r = BigInt(round);
  if (r <= 1n) return QUICKNET_GENESIS_TIME;
  return QUICKNET_GENESIS_TIME + Number(r - 1n) * QUICKNET_PERIOD;
}

/**
 * Compresses a Zcash address (specifically Bech32m Unified Addresses) into raw bytes.
 * Handles testnet (utest1...) and mainnet (u1...) Orchard UAs.
 */
export function compressAddress(address: string): Buffer {
  const trimmed = address.trim();
  if (trimmed.startsWith("utest1")) {
    const decoded = bech32m.decode(trimmed, 512);
    const wordsBytes = Buffer.from(bech32m.fromWords(decoded.words));
    return Buffer.concat([Buffer.from([0x00]), wordsBytes]);
  }
  if (trimmed.startsWith("u1")) {
    const decoded = bech32m.decode(trimmed, 512);
    const wordsBytes = Buffer.from(bech32m.fromWords(decoded.words));
    return Buffer.concat([Buffer.from([0x01]), wordsBytes]);
  }
  // Generic fallback for transparent or custom addresses
  const raw = Buffer.from(trimmed, "utf-8");
  if (raw.length > 255) {
    throw new Error(`Address string too long for compression: ${trimmed.length} chars`);
  }
  return Buffer.concat([Buffer.from([0xff, raw.length]), raw]);
}

/**
 * Decompresses raw bytes back into the original Zcash address.
 */
export function decompressAddress(buf: Buffer | Uint8Array): string {
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (buffer.length < 2) {
    throw new Error("Address buffer too short to decompress");
  }
  const hrpType = buffer[0];
  if (hrpType === 0x00) {
    const words = bech32m.toWords(buffer.subarray(1));
    return bech32m.encode("utest", words, 512);
  }
  if (hrpType === 0x01) {
    const words = bech32m.toWords(buffer.subarray(1));
    return bech32m.encode("u", words, 512);
  }
  if (hrpType === 0xff) {
    const len = buffer[1];
    return buffer.subarray(2, 2 + len).toString("utf-8");
  }
  throw new Error(`Unknown address compression HRP identifier: 0x${hrpType.toString(16)}`);
}

/**
 * Encrypts user's return address to Coordinator's X25519 public key using TweetNaCl box
 * with a deterministic nonce: SHA-256("NOC2_BOX_NONCE" || ephem_pk || market_id_bytes)[0..24].
 * Layout: ephem_pk (32B) || cipher_len (1B) || boxed_address (16B Poly1305 MAC + N bytes)
 */
export function encryptPayoutEnvelope(params: {
  address: string;
  coordinatorPublicKey: Uint8Array;
  marketId: number | string;
}): Buffer {
  const { address, coordinatorPublicKey, marketId } = params;
  const compressed = compressAddress(address);

  const ephemKeypair = nacl.box.keyPair();

  const marketIdNum = normalizeMarketId(marketId);
  const marketIdBytes = Buffer.alloc(4);
  marketIdBytes.writeUInt32BE(marketIdNum, 0);

  const nonce = crypto
    .createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("NOC2_BOX_NONCE", "utf-8"),
        Buffer.from(ephemKeypair.publicKey),
        marketIdBytes,
      ])
    )
    .digest()
    .subarray(0, 24);

  const boxed = nacl.box(
    compressed,
    nonce,
    coordinatorPublicKey,
    ephemKeypair.secretKey
  );

  if (boxed.length > 255) {
    throw new Error(`Boxed address exceeds 255 bytes: ${boxed.length}`);
  }

  const envelope = Buffer.alloc(32 + 1 + boxed.length);
  Buffer.from(ephemKeypair.publicKey).copy(envelope, 0);
  envelope.writeUInt8(boxed.length, 32);
  Buffer.from(boxed).copy(envelope, 33);

  return envelope;
}

/**
 * Decrypts user's payout address using Coordinator's X25519 secret key.
 */
export function decryptPayoutEnvelope(params: {
  payoutEnvelope: Buffer | Uint8Array;
  coordinatorSecretKey: Uint8Array;
  marketId: number | string;
}): string {
  const envelope = Buffer.isBuffer(params.payoutEnvelope)
    ? params.payoutEnvelope
    : Buffer.from(params.payoutEnvelope);

  if (envelope.length < 33) {
    throw new Error("Payout envelope too short");
  }

  const ephemPk = envelope.subarray(0, 32);
  const cipherLen = envelope.readUInt8(32);
  if (envelope.length < 33 + cipherLen) {
    throw new Error("Payout envelope length mismatch");
  }
  const boxedAddress = envelope.subarray(33, 33 + cipherLen);

  const marketIdNum = normalizeMarketId(params.marketId);
  const marketIdBytes = Buffer.alloc(4);
  marketIdBytes.writeUInt32BE(marketIdNum, 0);

  const nonce = crypto
    .createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from("NOC2_BOX_NONCE", "utf-8"),
        Buffer.from(ephemPk),
        marketIdBytes,
      ])
    )
    .digest()
    .subarray(0, 24);

  const opened = nacl.box.open(
    boxedAddress,
    nonce,
    ephemPk,
    params.coordinatorSecretKey
  );

  if (!opened) {
    throw new Error("Failed to decrypt payout envelope: MAC verification failure");
  }

  return decompressAddress(opened);
}

function wrapBase64(b64: string, col: number = 64): string {
  let res = "";
  for (let i = 0; i < b64.length; i += col) {
    res += b64.substring(i, i + col) + "\n";
  }
  return res;
}

function encodeArmor(data: Buffer | Uint8Array): string {
  const b64 = Buffer.from(data).toString("base64");
  return "-----BEGIN AGE ENCRYPTED FILE-----\n" + wrapBase64(b64, 64) + "-----END AGE ENCRYPTED FILE-----\n";
}

/**
 * Packs tlock-js age output into a deterministic 217-byte binary buffer:
 * - round_number (8B BigUInt64BE)
 * - cipher_ibe (128B raw)
 * - header_mac (32B raw)
 * - stream_body (49B raw: 16B nonce + 17B ciphertext + 16B Poly1305 tag)
 */
export function packAgePayloadToTlockEnvelope(armored: string): Buffer {
  const b64 = armored
    .replace(/-----BEGIN AGE ENCRYPTED FILE-----/g, "")
    .replace(/-----END AGE ENCRYPTED FILE-----/g, "")
    .replace(/\s+/g, "");
  const unarmored = Buffer.from(b64, "base64");

  const headerEnd = unarmored.indexOf(Buffer.from("--- "));
  if (headerEnd === -1) throw new Error("Invalid age payload: missing MAC separator");
  const headerStr = unarmored.subarray(0, headerEnd).toString("utf-8");

  const macLineEnd = unarmored.indexOf(0x0a, headerEnd);
  const macStr = unarmored.subarray(headerEnd, macLineEnd === -1 ? undefined : macLineEnd).toString("utf-8");
  const streamBody = unarmored.subarray(macLineEnd + 1);

  const tlockMatch = headerStr.match(/-> tlock (\d+) ([0-9a-f]+)/);
  if (!tlockMatch) throw new Error("Invalid age header: missing tlock stanza");
  const roundNum = BigInt(tlockMatch[1]);

  const bodyStart = headerStr.indexOf("\n", headerStr.indexOf("-> tlock")) + 1;
  const ibeBase64 = headerStr.substring(bodyStart).replace(/\s+/g, "");
  const cipherIbe = Buffer.from(ibeBase64, "base64");

  const macBase64 = macStr.replace("--- ", "").trim();
  const headerMac = Buffer.from(macBase64, "base64");

  if (cipherIbe.length !== 128) {
    throw new Error(`Unexpected cipher_ibe length: ${cipherIbe.length} (expected 128)`);
  }
  if (headerMac.length !== 32) {
    throw new Error(`Unexpected header_mac length: ${headerMac.length} (expected 32)`);
  }
  if (streamBody.length !== 49) {
    throw new Error(`Unexpected stream_body length: ${streamBody.length} (expected 49)`);
  }

  const packed = Buffer.alloc(TLOCK_ENVELOPE_BYTES);
  packed.writeBigUInt64BE(roundNum, 0);
  cipherIbe.copy(packed, 8);
  headerMac.copy(packed, 8 + 128);
  streamBody.copy(packed, 8 + 128 + 32);

  return packed;
}

/**
 * Reconstructs age ASCII armor from the 217-byte tlock envelope buffer.
 */
export function reconstructAgeArmorFromTlockEnvelope(envelope: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(envelope) ? envelope : Buffer.from(envelope);
  if (buf.length !== TLOCK_ENVELOPE_BYTES) {
    throw new Error(`Invalid tlock envelope length: ${buf.length} (expected ${TLOCK_ENVELOPE_BYTES})`);
  }

  const round = buf.readBigUInt64BE(0);
  const cipherIbe = buf.subarray(8, 8 + 128);
  const headerMac = buf.subarray(8 + 128, 8 + 128 + 32);
  const streamBody = buf.subarray(8 + 128 + 32, TLOCK_ENVELOPE_BYTES);

  const ibeB64 = cipherIbe.toString("base64").replace(/=/g, "");
  const macB64 = headerMac.toString("base64").replace(/=/g, "");

  const header =
    "age-encryption.org/v1\n" +
    `-> tlock ${round} ${QUICKNET_CHAIN_HASH}\n` +
    wrapBase64(ibeB64, 64) +
    `--- ${macB64}\n`;

  const unarmored = Buffer.concat([Buffer.from(header, "utf-8"), streamBody]);
  return encodeArmor(unarmored);
}

/**
 * Encrypts a bet payload (side + secret) to a specified drand Quicknet round.
 * Supports live drand Quicknet or offline/mock mode.
 */
export async function packTlockEnvelope(params: {
  round: bigint | number;
  side: BetSide;
  secret: Buffer | string; // 16 bytes (or 32-char hex)
  client?: any;
  mock?: boolean;
}): Promise<Buffer> {
  const { round, side, secret, client, mock = false } = params;
  const roundNum = BigInt(round);

  let secretBuf: Buffer;
  if (Buffer.isBuffer(secret)) {
    secretBuf = secret;
  } else if (/^[0-9a-fA-F]{32}$/.test(secret)) {
    secretBuf = Buffer.from(secret, "hex");
  } else {
    // If arbitrary string, hash to 16 bytes
    secretBuf = crypto.createHash("sha256").update(secret).digest().subarray(0, 16);
  }

  if (secretBuf.length !== 16) {
    throw new Error(`Secret must be exactly 16 bytes (got ${secretBuf.length})`);
  }

  const sideByte = side === "YES" ? 0x01 : 0x00;
  const plaintext = Buffer.concat([Buffer.from([sideByte]), secretBuf]); // 17 bytes

  if (mock) {
    const envelope = Buffer.alloc(TLOCK_ENVELOPE_BYTES);
    envelope.writeBigUInt64BE(roundNum, 0);
    // Fill cipher_ibe with mock marker
    envelope.fill(0xaa, 8, 8 + 128);
    envelope.write("MOCK_QUICKNET_IBE", 8, "utf-8");
    // Fill header_mac
    envelope.fill(0xbb, 8 + 128, 8 + 128 + 32);
    envelope.write("MOCK_HEADER_MAC_", 8 + 128, "utf-8");
    // stream_body (49 bytes): 16B nonce + 17B plaintext + 16B tag
    envelope.write("MOCK_STREAMNONCE", 8 + 128 + 32, 16, "utf-8");
    plaintext.copy(envelope, 8 + 128 + 32 + 16);
    envelope.write("MOCK_POLY1305TAG", 8 + 128 + 32 + 33, 16, "utf-8");
    return envelope;
  }

  const drandClient = client ?? mainnetClient();
  const armored = await timelockEncrypt(Number(roundNum), plaintext, drandClient);
  return packAgePayloadToTlockEnvelope(armored);
}

/**
 * Decrypts a 217-byte tlock envelope into { round, side, secret }.
 */
export async function unpackTlockEnvelope(params: {
  envelope: Buffer | Uint8Array;
  client?: any;
  mock?: boolean;
}): Promise<DecryptedTlockPayload> {
  const buf = Buffer.isBuffer(params.envelope) ? params.envelope : Buffer.from(params.envelope);
  if (buf.length !== TLOCK_ENVELOPE_BYTES) {
    throw new Error(`Tlock envelope must be exactly ${TLOCK_ENVELOPE_BYTES} bytes`);
  }

  const round = buf.readBigUInt64BE(0);

  // Check if mock envelope
  const isMockMarker =
    buf.subarray(8, 8 + 17).toString("utf-8") === "MOCK_QUICKNET_IBE" || params.mock === true;

  if (isMockMarker) {
    const sideByte = buf.readUInt8(8 + 128 + 32 + 16);
    const secretBuf = buf.subarray(8 + 128 + 32 + 17, 8 + 128 + 32 + 33);
    return {
      round,
      side: sideByte === 0x01 ? "YES" : "NO",
      secret: secretBuf.toString("hex"),
    };
  }

  const drandClient = params.client ?? mainnetClient();
  const armored = reconstructAgeArmorFromTlockEnvelope(buf);
  const decryptedUint8 = await timelockDecrypt(armored, drandClient);
  const decrypted = Buffer.from(decryptedUint8);

  if (decrypted.length < 17) {
    throw new Error(`Decrypted payload too short: ${decrypted.length} bytes`);
  }

  const sideByte = decrypted[0];
  const secretHex = decrypted.subarray(1, 17).toString("hex");

  return {
    round,
    side: sideByte === 0x01 ? "YES" : "NO",
    secret: secretHex,
  };
}

/**
 * Computes commitment = SHA-256(tlock_envelope) (32 bytes hex).
 * Binds side, secret, and round without wasting 32 extra bytes inside the memo.
 */
export function computeCommitment(tlockEnvelope: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(tlockEnvelope).digest("hex");
}

/**
 * Packs full Dual-Envelope into the wire format:
 * version (1B) || market_id (4B) || tlock_envelope (217B) || payout_envelope (N B)
 * Encodes as Base64url, prepends "NOC2:", and pads with "." after "~" up to targetLength (default 500 bytes).
 */
export function encodeBetMemoV2(params: {
  marketId: number | string;
  tlockEnvelope: Buffer | Uint8Array;
  payoutEnvelope: Buffer | Uint8Array;
  targetLength?: number;
}): string {
  const { marketId, tlockEnvelope, payoutEnvelope, targetLength = TARGET_MEMO_LENGTH } = params;

  if (tlockEnvelope.length !== TLOCK_ENVELOPE_BYTES) {
    throw new Error(`tlockEnvelope must be ${TLOCK_ENVELOPE_BYTES} bytes`);
  }

  const marketIdNum = normalizeMarketId(marketId);
  const marketIdBytes = Buffer.alloc(4);
  marketIdBytes.writeUInt32BE(marketIdNum, 0);

  const binaryPayload = Buffer.concat([
    Buffer.from([MEMO_VERSION_V2]),
    marketIdBytes,
    Buffer.from(tlockEnvelope),
    Buffer.from(payoutEnvelope),
  ]);

  const b64url = binaryPayload
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  let memo = `NOC2:${b64url}`;

  if (memo.length > MAX_MEMO_BYTES) {
    throw new Error(
      `Dual envelope memo (${memo.length} chars) exceeds maximum allowed ${MAX_MEMO_BYTES} bytes`
    );
  }

  if (memo.length < targetLength) {
    const padNeeded = targetLength - memo.length - 1; // 1 char for ~ delimiter
    if (padNeeded >= 0) {
      memo = `${memo}~${".".repeat(padNeeded)}`;
    }
  }

  return memo;
}

/**
 * Decodes wire memo string into structured components.
 */
export function decodeBetMemoV2(memoString: string): DecodedBetMemoV2 {
  const trimmed = memoString.trim();
  if (!trimmed.startsWith("NOC2:")) {
    throw new Error("Invalid memo format: missing NOC2: prefix");
  }

  const withoutPrefix = trimmed.substring(5);
  const b64urlPart = withoutPrefix.split("~")[0];

  let b64 = b64urlPart.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }

  const binary = Buffer.from(b64, "base64");
  if (binary.length < 1 + 4 + TLOCK_ENVELOPE_BYTES) {
    throw new Error("Memo binary payload too short to contain version, marketId, and tlock envelope");
  }

  const version = binary.readUInt8(0);
  if (version !== MEMO_VERSION_V2) {
    throw new Error(`Unsupported memo version: 0x${version.toString(16)} (expected 0x02)`);
  }

  const marketId = binary.readUInt32BE(1);
  const tlockEnvelope = binary.subarray(5, 5 + TLOCK_ENVELOPE_BYTES);
  const payoutEnvelope = binary.subarray(5 + TLOCK_ENVELOPE_BYTES);
  const commitment = computeCommitment(tlockEnvelope);

  return {
    version,
    marketId,
    tlockEnvelope,
    payoutEnvelope,
    commitment,
  };
}

/**
 * ZIP-321 base64url helpers
 */
export function encodeZip321Memo(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeZip321Memo(base64url: string): Buffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

/**
 * Constructs a standard ZIP-321 Payment URI with base64url-encoded UTF-8 memo parameter.
 */
export function generateZip321PaymentUri(params: {
  address: string;
  amountZec: number | string;
  memoUtf8: string;
  message?: string;
}): string {
  const { address, amountZec, memoUtf8, message } = params;
  const memoBase64url = encodeZip321Memo(Buffer.from(memoUtf8, "utf-8"));
  let uri = `zcash:${address}?amount=${amountZec}&memo=${memoBase64url}`;
  if (message) {
    uri += `&message=${encodeURIComponent(message)}`;
  }
  return uri;
}

/**
 * Computes a standard SHA-256 Merkle root from an array of hex leaves (commitments).
 * Duplicates odd leaf if odd number of elements per level.
 */
export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return "0".repeat(64);
  }
  let hashes: Buffer[] = leaves.map((leaf) => {
    const buf = /^[0-9a-fA-F]{64}$/.test(leaf)
      ? Buffer.from(leaf, "hex")
      : Buffer.from(leaf, "utf-8");
    return crypto.createHash("sha256").update(buf).digest();
  });

  while (hashes.length > 1) {
    if (hashes.length % 2 === 1) {
      hashes.push(hashes[hashes.length - 1]);
    }
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const combined = Buffer.concat([hashes[i], hashes[i + 1]]);
      nextLevel.push(crypto.createHash("sha256").update(combined).digest());
    }
    hashes = nextLevel;
  }

  return hashes[0].toString("hex");
}
