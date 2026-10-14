import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import { ZCASH_CONFIG } from "../../scripts/zcash/config.ts";

export interface CoordinatorConfig {
  port: number;
  host: string;
  dbPath: string;
  dataDir: string;
  potAddress: string;
  potUvk?: string;
  settlementPublicKey: Uint8Array;
  settlementSecretKey: Uint8Array;
  drandQuicknetChainHash: string;
  corsOrigin: boolean | string;
}

const DATA_DIR = path.resolve(process.env.NOCTURNE_DATA_DIR || "./nocturne-data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persist or load Coordinator Settlement X25519 Keypair
function getOrCreateSettlementKeypair(): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const keyFile = path.join(DATA_DIR, "coordinator_settlement_key.json");

  if (process.env.COORDINATOR_SECRET_KEY) {
    const secretKey = Buffer.from(process.env.COORDINATOR_SECRET_KEY, "hex");
    // In tweetnacl box, secretKey is 32 bytes and publicKey can be derived or passed
    // nacl.box.keyPair.fromSecretKey
    const keypair = nacl.box.keyPair.fromSecretKey(new Uint8Array(secretKey));
    return keypair;
  }

  if (fs.existsSync(keyFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
      return {
        publicKey: new Uint8Array(Buffer.from(data.publicKey, "hex")),
        secretKey: new Uint8Array(Buffer.from(data.secretKey, "hex")),
      };
    } catch {
      // If read fails, regenerate below
    }
  }

  const generated = nacl.box.keyPair();
  fs.writeFileSync(
    keyFile,
    JSON.stringify(
      {
        publicKey: Buffer.from(generated.publicKey).toString("hex"),
        secretKey: Buffer.from(generated.secretKey).toString("hex"),
      },
      null,
      2
    ),
    "utf-8"
  );

  return generated;
}

const settlementKeypair = getOrCreateSettlementKeypair();

export const COORDINATOR_CONFIG: CoordinatorConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",
  dataDir: DATA_DIR,
  dbPath: path.join(DATA_DIR, "nocturne.sqlite"),
  potAddress:
    process.env.POT_ADDRESS ||
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8",
  potUvk: process.env.POT_UVK,
  settlementPublicKey: settlementKeypair.publicKey,
  settlementSecretKey: settlementKeypair.secretKey,
  drandQuicknetChainHash:
    "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  corsOrigin: true,
};
