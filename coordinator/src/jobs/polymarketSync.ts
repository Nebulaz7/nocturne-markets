import { CoordinatorDatabase } from "../db/index.ts";
import { drandRoundForTimestamp } from "../../../packages/shared/src/memo.ts";

export const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  endDate?: string;
  closed?: boolean;
  markets?: Array<{
    id: string;
    question: string;
    outcomePrices?: string;
    clobTokenIds?: string;
    active?: boolean;
    closed?: boolean;
  }>;
}

/**
 * Fetches popular prediction markets from Polymarket Gamma API and seeds/updates them in SQLite.
 */
export async function syncPolymarketMarketsOnce(
  db: CoordinatorDatabase,
  potAddress: string
): Promise<number> {
  const url = `${POLYMARKET_GAMMA_API}/events?closed=false&limit=6`;
  let synced = 0;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NocturneMarkets/0.2.0" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const events: PolymarketEvent[] = await res.json();

    for (const evt of events) {
      if (!evt.id || !evt.title) continue;

      const existing = db.getMarket(evt.id);
      if (existing) continue;

      // Close timestamp: parse endDate or fallback to +7 days
      let closeTimeSec: number;
      if (evt.endDate) {
        closeTimeSec = Math.floor(new Date(evt.endDate).getTime() / 1000);
      } else {
        closeTimeSec = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
      }

      // If already expired in the past, skip
      if (closeTimeSec <= Math.floor(Date.now() / 1000) + 60) continue;

      const drandRound = Number(drandRoundForTimestamp(closeTimeSec));

      db.createMarket({
        id: evt.id,
        polymarket_id: evt.id,
        title: evt.title,
        slug: evt.slug || evt.id,
        close_time: closeTimeSec,
        drand_round: drandRound,
        pot_address: potAddress,
      });

      synced++;
    }
  } catch (err: any) {
    console.warn(`[PolymarketSync] Warning: Failed to fetch live Polymarket events (${err.message}). Using fallback seed markets.`);
    synced += seedFallbackMarkets(db, potAddress);
  }

  // Always ensure a rolling 5-minute Blitz Market is active for judges
  await ensureActiveBlitzMarket(db, potAddress);

  return synced;
}

/**
 * Seeds fallback markets if offline or if Polymarket is unreachable.
 */
function seedFallbackMarkets(db: CoordinatorDatabase, potAddress: string): number {
  const now = Math.floor(Date.now() / 1000);
  const fallbacks = [
    {
      id: "poly-btc-100k-2026",
      title: "Will Bitcoin hit $100,000 before December 31, 2026?",
      slug: "btc-100k-2026",
      closeTimeOffset: 30 * 24 * 3600,
    },
    {
      id: "poly-eth-flip-btc",
      title: "Will Ethereum flip Bitcoin by market cap in 2026?",
      slug: "eth-flips-btc",
      closeTimeOffset: 14 * 24 * 3600,
    },
  ];

  let added = 0;
  for (const m of fallbacks) {
    if (!db.getMarket(m.id)) {
      const closeTime = now + m.closeTimeOffset;
      const drandRound = Number(drandRoundForTimestamp(closeTime));
      db.createMarket({
        id: m.id,
        polymarket_id: m.id,
        title: m.title,
        slug: m.slug,
        close_time: closeTime,
        drand_round: drandRound,
        pot_address: potAddress,
      });
      added++;
    }
  }
  return added;
}

/**
 * Ensures there is always an active 5-Minute ZEC Blitz Market for judges to test.
 * When the current blitz market expires, seeds a new rolling one.
 */
export async function ensureActiveBlitzMarket(
  db: CoordinatorDatabase,
  potAddress: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Look for any OPEN blitz market
  const openMarkets = db.listMarkets({ status: "OPEN" });
  const activeBlitz = openMarkets.find((m) => m.id.startsWith("blitz-") && m.close_time > now);

  if (activeBlitz) {
    return activeBlitz.id;
  }

  // Create fresh 5-Minute Blitz Market
  const blitzId = `blitz-btc-${Date.now().toString().slice(-4)}`;
  const closeTime = now + 300; // 5 minutes (300 seconds)
  const drandRound = Number(drandRoundForTimestamp(closeTime));

  const newMarket = db.createMarket({
    id: blitzId,
    polymarket_id: "blitz-oracle",
    title: "⚡ Blitz: Will BTC 1-min candle close above $65,000?",
    slug: blitzId,
    close_time: closeTime,
    drand_round: drandRound,
    pot_address: potAddress,
  });

  console.log(`[PolymarketSync] ⚡ Fresh 5-Minute Blitz Market Seeded: ${newMarket.id} (Closes at ${new Date(closeTime * 1000).toLocaleTimeString()})`);
  return newMarket.id;
}

/**
 * Starts the Polymarket sync job with recurring interval.
 */
export function startPolymarketSync(
  db: CoordinatorDatabase,
  potAddress: string,
  intervalMs: number = 60000
): { stop: () => void } {
  let isRunning = true;
  let timer: NodeJS.Timeout | null = null;

  async function syncLoop() {
    if (!isRunning) return;
    try {
      await syncPolymarketMarketsOnce(db, potAddress);
    } catch (err: any) {
      console.error("[PolymarketSync] Sync loop error:", err.message);
    } finally {
      if (isRunning) {
        timer = setTimeout(syncLoop, intervalMs);
      }
    }
  }

  syncLoop();

  return {
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
    },
  };
}
