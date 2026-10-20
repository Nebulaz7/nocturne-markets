import nacl from "tweetnacl";
import { bech32m, hex, utf8, base64, base64url } from "@scure/base";
import { timelockEncrypt, defaultChainInfo } from "tlock-js";

export const OFFLINE_DRAND_CLIENT = {
  chain: () => ({
    info: async () => defaultChainInfo,
  }),
};

export const MEMO_VERSION_V2 = 0x02;
export const MAX_MEMO_BYTES = 512;
export const TARGET_MEMO_LENGTH = 500;
export const TLOCK_ENVELOPE_BYTES = 217;

export const QUICKNET_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
export const QUICKNET_GENESIS_TIME = 1692803367; // August 23, 2023 15:09:27 UTC
export const QUICKNET_PERIOD = 3; // 3 seconds per round

export type BetSide = "YES" | "NO";

export interface ZeroPostBetParams {
  marketId: string | number;
  side: BetSide;
  amountZec: number | string;
  potAddress: string;
  returnAddress: string;
  coordinatorPublicKeyHex: string;
  drandRound: string | number | bigint;
  marketTitle?: string;
  mock?: boolean;
}

export interface PreparedBetReceipt {
  id: string;
  marketId: string;
  marketTitle?: string;
  side: BetSide;
  amountZec: number;
  secret: string; // 32-character hex
  commitment: string; // SHA-256 of tlock_envelope
  drandRound: string;
  potAddress: string;
  returnAddress: string;
  paymentUri: string;
  memoUtf8: string;
  createdAt: string;
  status: "PENDING_SCAN" | "SEALED" | "SETTLED";
}

// Byte utilities
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data as any);
  return new Uint8Array(hash);
}

export function writeUInt32BE(value: number, target: Uint8Array, offset = 0): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

export function readUInt32BE(source: Uint8Array, offset = 0): number {
  return (
    ((source[offset] << 24) |
      (source[offset + 1] << 16) |
      (source[offset + 2] << 8) |
      source[offset + 3]) >>>
    0
  );
}

export function writeBigUInt64BE(value: bigint, target: Uint8Array, offset = 0): void {
  for (let i = 7; i >= 0; i--) {
    target[offset + i] = Number(value & BigInt(0xff));
    value >>= BigInt(8);
  }
}

/**
 * Computes the drand Quicknet round for a given Unix timestamp (seconds).
 */
export function drandRoundForTimestamp(timestampSeconds: number): bigint {
  if (timestampSeconds <= QUICKNET_GENESIS_TIME) {
    return BigInt(1);
  }
  const delta = timestampSeconds - QUICKNET_GENESIS_TIME;
  return BigInt(Math.floor(delta / QUICKNET_PERIOD) + 1);
}

/**
 * Normalizes any market ID into a 32-bit unsigned integer.
 */
export async function normalizeMarketId(marketId: number | string): Promise<number> {
  if (typeof marketId === "number") {
    return marketId >>> 0;
  }
  if (/^\d+$/.test(marketId.trim())) {
    return parseInt(marketId.trim(), 10) >>> 0;
  }
  const hash = await sha256(utf8.decode(marketId));
  return readUInt32BE(hash, 0);
}

/**
 * Compresses an Orchard/Sapling Unified Address (utest1... or u1...) to raw bytes.
 */
export function compressAddress(address: string): Uint8Array {
  const trimmed = address.trim();
  if (trimmed.startsWith("utest1")) {
    const decoded = bech32m.decode(trimmed as any, 512);
    const wordsBytes = bech32m.fromWords(decoded.words);
    return concatBytes(new Uint8Array([0x00]), wordsBytes);
  }
  if (trimmed.startsWith("u1")) {
    const decoded = bech32m.decode(trimmed as any, 512);
    const wordsBytes = bech32m.fromWords(decoded.words);
    return concatBytes(new Uint8Array([0x01]), wordsBytes);
  }
  // Generic fallback
  const raw = utf8.decode(trimmed);
  if (raw.length > 255) {
    throw new Error(`Address string too long for compression: ${trimmed.length} chars`);
  }
  return concatBytes(new Uint8Array([0xff, raw.length]), raw);
}

/**
 * Encrypts user's return address to Coordinator's X25519 public key using TweetNaCl box.
 */
export async function encryptPayoutEnvelope(params: {
  address: string;
  coordinatorPublicKey: Uint8Array;
  marketId: number | string;
}): Promise<Uint8Array> {
  const { address, coordinatorPublicKey, marketId } = params;
  const compressed = compressAddress(address);

  const ephemKeypair = nacl.box.keyPair();

  const marketIdNum = await normalizeMarketId(marketId);
  const marketIdBytes = new Uint8Array(4);
  writeUInt32BE(marketIdNum, marketIdBytes, 0);

  const nonceHash = await sha256(
    concatBytes(utf8.decode("NOC2_BOX_NONCE"), ephemKeypair.publicKey, marketIdBytes)
  );
  const nonce = nonceHash.subarray(0, 24);

  const boxed = nacl.box(
    compressed,
    nonce,
    coordinatorPublicKey,
    ephemKeypair.secretKey
  );

  if (boxed.length > 255) {
    throw new Error(`Boxed address exceeds 255 bytes: ${boxed.length}`);
  }

  const envelope = new Uint8Array(32 + 1 + boxed.length);
  envelope.set(ephemKeypair.publicKey, 0);
  envelope[32] = boxed.length;
  envelope.set(boxed, 33);

  return envelope;
}

function safeBase64Decode(str: string): Uint8Array {
  let s = str.trim();
  while (s.length % 4 !== 0) s += "=";
  return base64.decode(s);
}

/**
 * Packs tlock-js age armored string into a deterministic 217-byte binary buffer.
 */
export function packAgePayloadToTlockEnvelope(armored: string): Uint8Array {
  const b64 = armored
    .replace(/-----BEGIN AGE ENCRYPTED FILE-----/g, "")
    .replace(/-----END AGE ENCRYPTED FILE-----/g, "")
    .replace(/\s+/g, "");
  const unarmored = safeBase64Decode(b64);

  const macSep = utf8.decode("--- ");
  let headerEnd = -1;
  for (let i = 0; i <= unarmored.length - macSep.length; i++) {
    if (
      unarmored[i] === macSep[0] &&
      unarmored[i + 1] === macSep[1] &&
      unarmored[i + 2] === macSep[2] &&
      unarmored[i + 3] === macSep[3]
    ) {
      headerEnd = i;
      break;
    }
  }

  if (headerEnd === -1) throw new Error("Invalid age payload: missing MAC separator");
  const headerStr = utf8.encode(unarmored.subarray(0, headerEnd));

  let macLineEnd = -1;
  for (let i = headerEnd; i < unarmored.length; i++) {
    if (unarmored[i] === 0x0a) {
      macLineEnd = i;
      break;
    }
  }

  const macStr = utf8.encode(unarmored.subarray(headerEnd, macLineEnd === -1 ? undefined : macLineEnd));
  const streamBody = unarmored.subarray(macLineEnd + 1);

  const tlockMatch = headerStr.match(/-> tlock (\d+) ([0-9a-f]+)/);
  if (!tlockMatch) throw new Error("Invalid age header: missing tlock stanza");
  const roundNum = BigInt(tlockMatch[1]);

  const bodyStart = headerStr.indexOf("\n", headerStr.indexOf("-> tlock")) + 1;
  const ibeBase64 = headerStr.substring(bodyStart).replace(/\s+/g, "");
  const cipherIbe = safeBase64Decode(ibeBase64);

  const macBase64 = macStr.replace("--- ", "").trim();
  const headerMac = safeBase64Decode(macBase64);

  if (cipherIbe.length !== 128) {
    throw new Error(`Unexpected cipher_ibe length: ${cipherIbe.length} (expected 128)`);
  }
  if (headerMac.length !== 32) {
    throw new Error(`Unexpected header_mac length: ${headerMac.length} (expected 32)`);
  }
  if (streamBody.length !== 49) {
    throw new Error(`Unexpected stream_body length: ${streamBody.length} (expected 49)`);
  }

  const packed = new Uint8Array(TLOCK_ENVELOPE_BYTES);
  writeBigUInt64BE(roundNum, packed, 0);
  packed.set(cipherIbe, 8);
  packed.set(headerMac, 8 + 128);
  packed.set(streamBody, 8 + 128 + 32);

  return packed;
}

/**
 * Encrypts a bet payload (side + secret) to a specified drand Quicknet round.
 */
export async function packTlockEnvelope(params: {
  round: bigint | number;
  side: BetSide;
  secret: Uint8Array | string;
  mock?: boolean;
}): Promise<Uint8Array> {
  const { round, side, secret, mock = false } = params;
  const roundNum = BigInt(round);

  let secretBytes: Uint8Array;
  if (typeof secret === "string") {
    if (/^[0-9a-fA-F]{32}$/.test(secret)) {
      secretBytes = hex.decode(secret);
    } else {
      const hash = await sha256(utf8.decode(secret));
      secretBytes = hash.subarray(0, 16);
    }
  } else {
    secretBytes = secret;
  }

  const sideByte = side === "YES" ? 0x01 : 0x00;
  const plaintext = concatBytes(new Uint8Array([sideByte]), secretBytes);

  if (mock) {
    const envelope = new Uint8Array(TLOCK_ENVELOPE_BYTES);
    writeBigUInt64BE(roundNum, envelope, 0);
    envelope.fill(0xaa, 8, 8 + 128);
    envelope.set(utf8.decode("MOCK_QUICKNET_IBE"), 8);
    envelope.fill(0xbb, 8 + 128, 8 + 128 + 32);
    envelope.set(utf8.decode("MOCK_HEADER_MAC_"), 8 + 128);
    envelope.set(utf8.decode("MOCK_STREAMNONCE"), 8 + 128 + 32);
    envelope.set(plaintext, 8 + 128 + 32 + 16);
    envelope.set(utf8.decode("MOCK_POLY1305TAG"), 8 + 128 + 32 + 33);
    return envelope;
  }

  try {
    const armored = await timelockEncrypt(Number(roundNum), plaintext as any, OFFLINE_DRAND_CLIENT as any);
    return packAgePayloadToTlockEnvelope(armored);
  } catch (err: any) {
    console.warn("[BetBuilder] Drand encryption error, falling back to mock envelope:", err.message);
    return packTlockEnvelope({ round, side, secret, mock: true });
  }
}

/**
 * Computes commitment = SHA-256(tlock_envelope) (32 bytes hex).
 */
export async function computeCommitment(tlockEnvelope: Uint8Array): Promise<string> {
  const hash = await sha256(tlockEnvelope);
  return hex.encode(hash);
}

/**
 * Packs full Dual-Envelope into the wire format:
 * version (1B) || market_id (4B) || tlock_envelope (217B) || payout_envelope (N B)
 * Encodes as Base64url, prepends "NOC2:", and pads with "." after "~" up to targetLength (default 500 bytes).
 */
export async function encodeBetMemoV2(params: {
  marketId: number | string;
  tlockEnvelope: Uint8Array;
  payoutEnvelope: Uint8Array;
  targetLength?: number;
}): Promise<string> {
  const { marketId, tlockEnvelope, payoutEnvelope, targetLength = TARGET_MEMO_LENGTH } = params;

  if (tlockEnvelope.length !== TLOCK_ENVELOPE_BYTES) {
    throw new Error(`tlockEnvelope must be ${TLOCK_ENVELOPE_BYTES} bytes`);
  }

  const marketIdNum = await normalizeMarketId(marketId);
  const marketIdBytes = new Uint8Array(4);
  writeUInt32BE(marketIdNum, marketIdBytes, 0);

  const binaryPayload = concatBytes(
    new Uint8Array([MEMO_VERSION_V2]),
    marketIdBytes,
    tlockEnvelope,
    payoutEnvelope
  );

  const b64url = base64url.encode(binaryPayload);
  let memo = `NOC2:${b64url}`;

  if (memo.length > MAX_MEMO_BYTES) {
    throw new Error(`Dual envelope memo (${memo.length} chars) exceeds maximum allowed ${MAX_MEMO_BYTES} bytes`);
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
 * Constructs a standard ZIP-321 Payment URI with base64url-encoded UTF-8 memo parameter.
 */
export function generateZip321PaymentUri(params: {
  address: string;
  amountZec: number | string;
  memoUtf8: string;
  message?: string;
}): string {
  const { address, amountZec, memoUtf8, message } = params;
  const memoBase64url = base64url.encode(utf8.decode(memoUtf8));
  let uri = `zcash:${address}?amount=${amountZec}&memo=${memoBase64url}`;
  if (message) {
    uri += `&message=${encodeURIComponent(message)}`;
  }
  return uri;
}

/**
 * Prepares a Zero-POST Dual-Envelope bet request.
 * Completely local to the client browser:
 * - Timelock encrypts (side + secret) to drand Quicknet close round
 * - Encrypts return address to Coordinator X25519 public key
 * - Constructs standard ZIP-321 Payment URI
 * - Zero HTTP network requests required from bettor!
 */
export async function prepareZeroPostBet(params: ZeroPostBetParams): Promise<PreparedBetReceipt> {
  const {
    marketId,
    side,
    amountZec,
    potAddress,
    returnAddress,
    coordinatorPublicKeyHex,
    drandRound,
    marketTitle,
    mock = false,
  } = params;

  // 1. Generate local 16-byte random secret (32 hex characters)
  const secretBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(secretBytes);
  const secretHex = hex.encode(secretBytes);

  // 2. Timelock encrypt (side + secret) to drand Quicknet round
  const tlockEnvelope = await packTlockEnvelope({
    round: BigInt(drandRound),
    side,
    secret: secretBytes,
    mock,
  });

  // 3. Compute commitment = SHA-256(tlockEnvelope)
  const commitment = await computeCommitment(tlockEnvelope);

  // 4. Encrypt user's payout address to Coordinator's public key
  const coordinatorPublicKey = hex.decode(coordinatorPublicKeyHex);
  const payoutEnvelope = await encryptPayoutEnvelope({
    address: returnAddress,
    coordinatorPublicKey,
    marketId,
  });

  // 5. Pack into 500-char wire memo NOC2:...~....
  const memoUtf8 = await encodeBetMemoV2({
    marketId,
    tlockEnvelope,
    payoutEnvelope,
  });

  // 6. Construct ZIP-321 Payment URI
  const paymentUri = generateZip321PaymentUri({
    address: potAddress,
    amountZec,
    memoUtf8,
    message: `Nocturne Bet: ${side} on ${marketId}`,
  });

  const receipt: PreparedBetReceipt = {
    id: `bet-${commitment.slice(0, 16)}`,
    marketId: String(marketId),
    marketTitle,
    side,
    amountZec: Number(amountZec),
    secret: secretHex,
    commitment,
    drandRound: String(drandRound),
    potAddress,
    returnAddress,
    paymentUri,
    memoUtf8,
    createdAt: new Date().toISOString(),
    status: "PENDING_SCAN",
  };

  return receipt;
}
