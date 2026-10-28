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
  clobTokenIds?: string; // JSON string, e.g. '["token1", "token2"]'
  groupItemTitle?: string;
  active?: boolean;
  closed?: boolean;
  image?: string;
  icon?: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  category?: string;
  tags?: Array<{ id?: string; label?: string; slug?: string }>;
  endDate?: string;
  closed?: boolean;
  active?: boolean;
  image?: string;
  icon?: string;
  markets?: PolymarketMarket[];
}

export type MarketCategory = "Politics" | "Crypto" | "Sports" | "Others";

/**
 * Strictly normalizes any Polymarket category or event tags into one of exactly 4 categories:
 * 'Politics', 'Crypto', 'Sports', or 'Others'.
 */
export function normalizeCategory(
  rawCategory?: string | null,
  tags?: Array<{ label?: string; slug?: string }> | null,
  title?: string | null
): MarketCategory {
  const cat = (rawCategory || "").trim().toLowerCase();
  if (cat === "politics") return "Politics";
  if (cat === "crypto" || cat === "cryptocurrency") return "Crypto";
  if (cat === "sports") return "Sports";

  // Check tags
  if (tags && Array.isArray(tags)) {
    for (const t of tags) {
      const tagStr = `${t.label || ""} ${t.slug || ""}`.toLowerCase();
      if (
        tagStr.includes("politic") ||
        tagStr.includes("election") ||
        tagStr.includes("geopolitics")
      ) {
        return "Politics";
      }
      if (
        tagStr.includes("crypto") ||
        tagStr.includes("bitcoin") ||
        tagStr.includes("ethereum") ||
        tagStr.includes("solana")
      ) {
        return "Crypto";
      }
      if (
        tagStr.includes("sport") ||
        tagStr.includes("nba") ||
        tagStr.includes("nfl") ||
        tagStr.includes("soccer") ||
        tagStr.includes("football") ||
        tagStr.includes("baseball") ||
        tagStr.includes("tennis") ||
        tagStr.includes("mma") ||
        tagStr.includes("ufc")
      ) {
        return "Sports";
      }
    }
  }

  // Keyword check in title and metadata
  const text = `${rawCategory || ""} ${title || ""}`.toLowerCase();

  // Crypto keywords
  if (
    /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|binance|coinbase|tether|usdt|usdc|token|nft|defi|doge|xrp)\b/i.test(
      text
    )
  ) {
    return "Crypto";
  }

  // Politics keywords
  if (
    /\b(politics|election|trump|biden|harris|kamala|senate|president|white house|democrat|republican|congress|ceasefire|war|geopolitics|putin|zelensky|ukraine|gaza|israel|nato|governor|supreme court)\b/i.test(
      text
    )
  ) {
    return "Politics";
  }

  // Sports keywords
  if (
    /\b(sports|nba|nfl|mlb|nhl|soccer|uefa|premier league|champions league|fifa|tennis|ufc|f1|formula 1|boxing|ballon d'or|super bowl|world cup|touchdown|quarterback)\b/i.test(
      text
    )
  ) {
    return "Sports";
  }

  return "Others";
}

/**
 * Fetches popular prediction markets from Polymarket Gamma API and seeds/updates them in SQLite.
 * Paginates active events in bulk to ensure all active volume is pre-indexed for zero-leak teleporting.
 */
export async function syncPolymarketMarketsOnce(
  db: CoordinatorDatabase,
  potAddress: string,
  maxPages: number = 1
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  let synced = 0;

  try {
    for (let page = 0; page < maxPages; page++) {
      const offset = page * 100;
      const url = `${POLYMARKET_GAMMA_API}/events?active=true&closed=false&order=volume24hr&ascending=false&limit=100&offset=${offset}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
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

          // Parse CLOB token IDs
          let yesTokenId: string | null = null;
          let noTokenId: string | null = null;
          try {
            const tokenIds = JSON.parse(m.clobTokenIds || "[]");
            if (Array.isArray(tokenIds) && tokenIds.length >= 2) {
              const yesIndex = outcomes[0].toLowerCase() === "yes" ? 0 : 1;
              const noIndex = yesIndex === 0 ? 1 : 0;
              yesTokenId = tokenIds[yesIndex] || null;
              noTokenId = tokenIds[noIndex] || null;
            }
          } catch {}

          const normalizedCat = normalizeCategory(evt.category, evt.tags, evt.title);
          const marketImage = m.image || evt.image || null;
          const marketIcon = m.icon || m.image || evt.icon || evt.image || null;

          const existing = db.getMarket(m.id);
          if (existing) {
            if (refYesPrice !== null && existing.ref_yes_price !== refYesPrice) {
              db.updateMarketRefPrice(m.id, refYesPrice);
            }
            db.updateMarketTokensAndCategory(m.id, {
              yes_token_id: yesTokenId,
              no_token_id: noTokenId,
              category: normalizedCat,
              image: marketImage,
              icon: marketIcon,
            });
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
            yes_token_id: yesTokenId,
            no_token_id: noTokenId,
            category: normalizedCat,
            close_time: closeTimeSec,
            drand_round: drandRound,
            pot_address: potAddress,
            image: marketImage,
            icon: marketIcon,
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
      yes_token_id: "token-btc-100k-yes",
      no_token_id: "token-btc-100k-no",
      category: "Crypto" as MarketCategory,
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
      yes_token_id: "token-eth-flip-btc-yes",
      no_token_id: "token-eth-flip-btc-no",
      category: "Crypto" as MarketCategory,
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
        yes_token_id: m.yes_token_id,
        no_token_id: m.no_token_id,
        category: m.category,
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
 * Ensures there is always an active 10-Minute Zcash (ZEC) Blitz Market for judges to test.
 * When the current blitz market expires, seeds a new rolling 10-minute sponsored demo market.
 */
export async function ensureActiveBlitzMarket(
  db: CoordinatorDatabase,
  potAddress: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Look for any OPEN blitz market that still has at least 15 seconds remaining
  const openMarkets = db.listMarkets({ status: "OPEN" });
  const activeBlitz = openMarkets.find(
    (m) => m.id.startsWith("blitz-") && m.close_time > now + 15
  );

  if (activeBlitz) {
    return activeBlitz.id;
  }

  // Create fresh 10-Minute ZEC Blitz Market (600 seconds)
  const blitzId = `blitz-zec-${Date.now().toString().slice(-4)}`;
  const closeTime = now + 600; // Exactly 10 minutes
  const drandRound = Number(drandRoundForTimestamp(closeTime));

  const newMarket = db.createMarket({
    id: blitzId,
    polymarket_id: "blitz-zec-oracle",
    title: "Blitz: Will ZEC/USD close higher in the next 10 minutes?",
    slug: "blitz-zec",
    event_slug: "blitz-zec",
    market_slug: blitzId,
    condition_id: "0xblitzzecoracle",
    question: "Will ZEC/USD 10-min candle close above reference price?",
    group_item_title: "10-min candle",
    ref_yes_price: 0.50,
    category: "Crypto",
    close_time: closeTime,
    drand_round: drandRound,
    pot_address: potAddress,
    image: "/zcash.svg",
    icon: "/zcash.svg",
  });

  console.log(
    `[BlitzManager] Fresh 10-Minute ZEC Blitz Market Seeded: ${newMarket.id} (Closes at ${new Date(closeTime * 1000).toLocaleTimeString()})`
  );
  return newMarket.id;
}

export const ensureActiveZecBlitzMarket = ensureActiveBlitzMarket;

/**
 * Starts the Polymarket sync job with recurring interval and lightweight Blitz market seeder.
 */
export function startPolymarketSync(
  db: CoordinatorDatabase,
  potAddress: string,
  intervalMs: number = 300000
): { stop: () => void } {
  let isRunning = true;
  let timer: NodeJS.Timeout | null = null;
  let blitzTimer: NodeJS.Timeout | null = null;

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

  // Fast background loop (every 15s) ensuring Blitz markets are continuously active
  async function blitzLoop() {
    if (!isRunning) return;
    try {
      await ensureActiveBlitzMarket(db, potAddress);
    } catch (err: any) {
      console.error("[BlitzManager] Blitz loop error:", err.message);
    } finally {
      if (isRunning) {
        blitzTimer = setTimeout(blitzLoop, 15000);
      }
    }
  }

  syncLoop();
  blitzTimer = setTimeout(blitzLoop, 5000);

  return {
    stop: () => {
      isRunning = false;
      if (timer) clearTimeout(timer);
      if (blitzTimer) clearTimeout(blitzTimer);
    },
  };
}
