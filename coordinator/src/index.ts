import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { CoordinatorDatabase } from "./db/index.ts";
import { marketRoutes } from "./routes/markets.ts";
import { COORDINATOR_CONFIG } from "./config.ts";

export async function buildApp(customDb?: CoordinatorDatabase): Promise<{
  app: FastifyInstance;
  db: CoordinatorDatabase;
}> {
  const app = Fastify({
    logger: false, // Zero IP logging / disabled for privacy
  });

  const db = customDb ?? new CoordinatorDatabase(COORDINATOR_CONFIG.dbPath);

  // Enable CORS for frontend clients
  await app.register(cors, {
    origin: true,
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

  return { app, db };
}

// Start standalone server if invoked directly
if (process.argv[1]?.endsWith("index.ts")) {
  async function start() {
    console.log("===============================================================");
    console.log("🌌 NOCTURNE MARKETS: ZERO-POST COORDINATOR SERVICE 🌌");
    console.log("===============================================================\n");

    const { app } = await buildApp();

    try {
      await app.listen({
        port: COORDINATOR_CONFIG.port,
        host: COORDINATOR_CONFIG.host,
      });

      console.log(`[Coordinator] Server listening on http://${COORDINATOR_CONFIG.host}:${COORDINATOR_CONFIG.port}`);
      console.log(`[Coordinator] Pot Orchard Address: ${COORDINATOR_CONFIG.potAddress}`);
      console.log(
        `[Coordinator] Settlement Public Key: ${Buffer.from(COORDINATOR_CONFIG.settlementPublicKey).toString("hex")}`
      );
      console.log(`[Coordinator] Database: ${COORDINATOR_CONFIG.dbPath}\n`);
    } catch (err) {
      console.error("Failed to start coordinator:", err);
      process.exit(1);
    }
  }

  start();
}
