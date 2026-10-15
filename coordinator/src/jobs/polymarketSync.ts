import { CoordinatorDatabase } from "../db/index.ts";
import { drandRoundForTimestamp } from "../../../packages/shared/src/memo.ts";

export const POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId?: string;
  slug?: string;
  endDate?: string;
  outcomes?: string; // JSON string, e.g. '["Yes", "No"]'
  outcomePrices?: string; // JSON string, e.g. '["0.0015", "0.9985"]'
  groupItemTitle?: string;
  active?: boolean;
  closed?: boolean;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  markets?: PolymarketMarket[];
}

/**
 * Fetches popular prediction markets from Polymarket Gamma API and seeds/updates them in SQLite.
 * Paginates active events in bulk to ensure all active volume is pre-indexed for zero-leak teleporting.
 */
export async function syncPolymarketMarketsOnce(
  db: CoordinatorDatabase,
  potAddress: string,
  maxPages: number = 3
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  let synced = 0;

  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 100;
      const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&order=volume24hr&ascending=false&limit=100&offset=${offset}`;

      const res = await fetch(url, {
        headers: { "User-Agent": "NocturneMarkets/0.2.0" },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const events: PolymarketEvent[] = await res.json();
      if (!events || events.length === 0) break;

      for (const evt of events) {
        if (!evt.id || !evt.title || !evt.markets) continue;

        for (const m of evt.markets) {
          if (!m.id || m.closed) continue;

          // Filter for binary markets where outcomes are ["Yes", "No"]
          let outcomes: string[] = [];
          try {
            outcomes = JSON.parse(m.outcomes || "[]");
          } catch {
            continue;
          }

          if (outcomes.length !== 2) continue;
          const isYesNo =
            (outcomes[0].toLowerCase() === "yes" && outcomes[1].toLowerCase() === "no") ||
            (outcomes[0].toLowerCase() === "no" && outcomes[1].toLowerCase() === "yes");
          if (!isYesNo) continue;

          // Parse reference YES price
          let refYesPrice: number | null = null;
          try {
            const prices = JSON.parse(m.outcomePrices || "[]");
            if (prices.length >= 1) {
              const yesIndex = outcomes[0].toLowerCase() === "yes" ? 0 : 1;
              refYesPrice = parseFloat(prices[yesIndex]);
            }
          } catch {}

          // Determine close timestamp
          const closeDate = m.endDate || evt.endDate;
          let closeTimeSec: number;
          if (closeDate) {
            closeTimeSec = Math.floor(new Date(closeDate).getTime() / 1000);
          } else {
            closeTimeSec = now + 7 * 24 * 3600;
          }

          // If expired, skip
          if (closeTimeSec <= now + 60) continue;

          const existing = db.getMarket(m.id);
          if (existing) {
            if (refYesPrice !== null && existing.ref_yes_price !== refYesPrice) {
              db.updateMarketRefPrice(m.id, refYesPrice);
            }
            continue;
          }

          const drandRound = Number(drandRoundForTimestamp(closeTimeSec));
          const title = m.groupItemTitle
            ? `${evt.title}: ${m.groupItemTitle}`
            : m.question || evt.title;

          db.createMarket({
            id: m.id,
            polymarket_id: m.id,
            title,
            slug: m.slug || evt.slug,
            event_slug: evt.slug,
            market_slug: m.slug || null,
            condition_id: m.conditionId || null,
            question: m.question || null,
            group_item_title: m.groupItemTitle || null,
            ref_yes_price: refYesPrice,
            close_time: closeTimeSec,
            drand_round: drandRound,
            pot_address: potAddress,
          });

          synced++;
        }
      }
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
      event_slug: "btc-100k-2026",
      market_slug: "will-btc-hit-100k-before-december-31-2026",
      condition_id: "0xcondbtc100k",
      question: "Will Bitcoin hit $100,000 before December 31, 2026?",
      group_item_title: null,
      ref_yes_price: 0.68,
      closeTimeOffset: 30 * 24 * 3600,
    },
    {
      id: "poly-eth-flip-btc",
      title: "Will Ethereum flip Bitcoin by market cap in 2026?",
      slug: "eth-flips-btc",
      event_slug: "eth-flips-btc",
      market_slug: "will-ethereum-flip-bitcoin-in-2026",
      condition_id: "0xcondethflip",
      question: "Will Ethereum flip Bitcoin by market cap in 2026?",
      group_item_title: null,
      ref_yes_price: 0.12,
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
        event_slug: m.event_slug,
        market_slug: m.market_slug,
        condition_id: m.condition_id,
        question: m.question,
        group_item_title: m.group_item_title,
        ref_yes_price: m.ref_yes_price,
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
    event_slug: "blitz-market",
    market_slug: blitzId,
    condition_id: "0xblitzoracle",
    question: "Will BTC 1-min candle close above $65,000?",
    group_item_title: "1-min candle",
    ref_yes_price: 0.50,
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
