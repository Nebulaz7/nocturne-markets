import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { execSync } from "child_process";
import fs from "fs";
import { CoordinatorDatabase } from "./db/index.ts";
import { marketRoutes } from "./routes/markets.ts";
import { COORDINATOR_CONFIG } from "./config.ts";
import {
  startDepositWatcher,
  type WalletBridgeLike,
} from "./jobs/depositWatcher.ts";
import { startPolymarketSync } from "./jobs/polymarketSync.ts";
import { startSettlementWorker } from "./jobs/settlement.ts";
import {
  ZingoWalletBridge,
  type IncomingNote,
} from "../../scripts/zcash/wallet_bridge.ts";

export function isZingoCliAvailable(cliPath = "zingo-cli"): boolean {
  if (process.env.ZINGO_CLI_PATH && fs.existsSync(process.env.ZINGO_CLI_PATH)) {
    return true;
  }
  try {
    const cmd = process.platform === "win32" ? `where.exe ${cliPath}` : `which ${cliPath}`;
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class DevMockWalletBridge implements WalletBridgeLike {
  public async sync(): Promise<string> {
    return "mock-synced";
  }

  public async listNotes(): Promise<IncomingNote[]> {
    return [];
  }

  public async sendShieldedPayout(
    destinationAddress: string,
    amountZats: number | bigint,
    memo?: string
  ): Promise<string> {
    console.log(
      `[DevMockWallet] 🛡️ Simulated payout of ${Number(amountZats) / 100_000_000} ZEC to ${destinationAddress.slice(0, 16)}...`
    );
    return `mock-txid-${Date.now()}`;
  }
}

export interface BuildAppOptions {
  enableWorkers?: boolean;
  bridge?: WalletBridgeLike;
  mockDrand?: boolean;
  depositIntervalMs?: number;
  syncIntervalMs?: number;
  settlementIntervalMs?: number;
}

export async function buildApp(
  customDb?: CoordinatorDatabase,
  options: BuildAppOptions = {},
): Promise<{
  app: FastifyInstance;
  db: CoordinatorDatabase;
  stopWorkers?: () => void;
}> {
  const app = Fastify({
    logger: false, // Zero IP logging / disabled for privacy
  });

  const db = customDb ?? new CoordinatorDatabase(COORDINATOR_CONFIG.dbPath);

  // Enable CORS for frontend clients
  await app.register(cors, {
    origin: true,
  });

  // Root endpoint with helpful service info and links
  app.get("/", async () => {
    return {
      service: "Nocturne Markets Coordinator API",
      status: "online",
      version: "0.2.0-zero-post",
      frontend: "http://localhost:3000",
      documentation:
        "Zero-POST privacy architecture: all bets submitted via shielded ZEC memo (NOC2: dual-envelope)",
      endpoints: {
        health: "/api/health",
        markets: "/api/markets",
        syncState: "/api/sync-state",
      },
    };
  });

  // Health check endpoint
  app.get("/api/health", async () => {
    return {
      status: "ok",
      version: "0.2.0-zero-post",
      timestamp: new Date().toISOString(),
    };
  });

  // Register market and audit routes
  await app.register(marketRoutes, { db });

  let stopWorkers: (() => void) | undefined;

  // Background workers initialization
  if (options.enableWorkers) {
    let bridge: WalletBridgeLike;
    if (options.bridge) {
      bridge = options.bridge;
    } else if (isZingoCliAvailable()) {
      bridge = new ZingoWalletBridge();
    } else {
      console.log(
        "[Coordinator] ℹ️ zingo-cli not found on PATH. Initializing DevMockWalletBridge (simulated wallet mode for local dev)."
      );
      bridge = new DevMockWalletBridge();
    }
    const mockDrand = options.mockDrand ?? false;

    console.log("[Coordinator] 🚀 Starting background worker tasks...");

    const watcher = startDepositWatcher(
      db,
      bridge,
      options.depositIntervalMs ?? 10000,
    );

    const polySync = startPolymarketSync(
      db,
      COORDINATOR_CONFIG.potAddress,
      options.syncIntervalMs ?? 60000,
    );

    const settlement = startSettlementWorker(
      {
        db,
        coordinatorSecretKey: COORDINATOR_CONFIG.settlementSecretKey,
        potUvk: COORDINATOR_CONFIG.potUvk,
        bridge,
        mockDrand,
      },
      options.settlementIntervalMs ?? 10000,
    );

    stopWorkers = () => {
      console.log("[Coordinator] Stopping background workers...");
      watcher.stop();
      polySync.stop();
      settlement.stop();
    };

    app.addHook("onClose", async () => {
      stopWorkers?.();
    });
  }

  return { app, db, stopWorkers };
}

// Start standalone server if invoked directly
if (process.argv[1]?.endsWith("index.ts")) {
  async function start() {
    console.log(
      "===============================================================",
    );
    console.log("🌌 NOCTURNE MARKETS: ZERO-POST COORDINATOR SERVICE 🌌");
    console.log(
      "===============================================================\n",
    );

    const enableWorkers = process.env.ENABLE_WORKERS !== "false";
    const { app } = await buildApp(undefined, {
      enableWorkers,
      mockDrand: process.env.DRAND_MOCK === "true",
    });

    try {
      await app.listen({
        port: COORDINATOR_CONFIG.port,
        host: COORDINATOR_CONFIG.host,
      });

      console.log(
        `[Coordinator] Server listening on http://${COORDINATOR_CONFIG.host}:${COORDINATOR_CONFIG.port}`,
      );
      console.log(
        `[Coordinator] Pot Orchard Address: ${COORDINATOR_CONFIG.potAddress}`,
      );
      console.log(
        `[Coordinator] Settlement Public Key: ${Buffer.from(COORDINATOR_CONFIG.settlementPublicKey).toString("hex")}`,
      );
      console.log(`[Coordinator] Database: ${COORDINATOR_CONFIG.dbPath}\n`);
    } catch (err) {
      console.error("Failed to start coordinator:", err);
      process.exit(1);
    }
  }

  start();
}
