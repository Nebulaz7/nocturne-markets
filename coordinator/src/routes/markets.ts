import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { CoordinatorDatabase, type MarketRecord } from "../db/index.ts";
import { COORDINATOR_CONFIG } from "../config.ts";

export interface MarketRoutesOptions {
  db: CoordinatorDatabase;
}

interface HistoryCacheEntry {
  expiresAt: number;
  data: Array<{ t: number; yesPct: number; noPct: number }>;
}

const historyCache = new Map<string, HistoryCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_FIDELITY: Record<string, number | undefined> = {
  "1d": undefined,
  "1w": 5,
  "1m": 60,
  "max": undefined,
};

function formatMarketResponse(m: MarketRecord, db: CoordinatorDatabase) {
  const isClosedOrSettled =
    m.status === "CLOSED" ||
    m.status === "RESOLVED" ||
    m.status === "SETTLED" ||
    m.status === "REFUNDED";

  const betsCount = db.countBetsForMarket(m.id);

  return {
    id: m.id,
    polymarket_id: m.polymarket_id,
    title: m.title,
    slug: m.slug,
    event_slug: m.event_slug || null,
    market_slug: m.market_slug || null,
    condition_id: m.condition_id || null,
    question: m.question || null,
    group_item_title: m.group_item_title || null,
    ref_yes_price: m.ref_yes_price ?? null,
    yes_token_id: m.yes_token_id ?? null,
    no_token_id: m.no_token_id ?? null,
    category: m.category || "Others",
    image: m.image || null,
    icon: m.icon || null,
    close_time: m.close_time,
    drand_round: m.drand_round,
    status: m.status,
    outcome: m.outcome,
    pot_address: m.pot_address,
    pots_sealed: !isClosedOrSettled,
    commitment_count: betsCount,
    total_pot_zats: isClosedOrSettled ? m.total_pot_zats : null,
    yes_pot_zats: isClosedOrSettled ? m.yes_pot_zats : null,
    no_pot_zats: isClosedOrSettled ? m.no_pot_zats : null,
    total_pot_zec: isClosedOrSettled ? m.total_pot_zats / 100_000_000 : null,
    yes_pot_zec: isClosedOrSettled ? m.yes_pot_zats / 100_000_000 : null,
    no_pot_zec: isClosedOrSettled ? m.no_pot_zats / 100_000_000 : null,
  };
}

function generateBlitzHistory(
  market: MarketRecord,
  interval: string
): Array<{ t: number; yesPct: number; noPct: number }> {
  const now = Math.floor(Date.now() / 1000);
  const startTime = market.close_time - 300;
  const endTime = Math.min(now, market.close_time);
  const step = 10;
  const history: Array<{ t: number; yesPct: number; noPct: number }> = [];

  const basePrice = market.ref_yes_price ?? 0.5;
  for (let t = startTime; t <= endTime; t += step) {
    const pseudo = Math.sin(t * 0.1) * 0.03 + Math.cos(t * 0.05) * 0.02;
    const clampedPrice = Math.max(0.05, Math.min(0.95, basePrice + pseudo));
    const yesPct = Number((clampedPrice * 100).toFixed(1));
    const noPct = Number((100 - yesPct).toFixed(1));
    history.push({ t, yesPct, noPct });
  }

  if (history.length === 0) {
    const yesPct = Number((basePrice * 100).toFixed(1));
    history.push({ t: now, yesPct, noPct: Number((100 - yesPct).toFixed(1)) });
  }

  return history;
}

export const marketRoutes: FastifyPluginAsync<MarketRoutesOptions> = async (
  fastify: FastifyInstance,
  options: MarketRoutesOptions
) => {
  const { db } = options;

  /**
   * GET /api/markets
   * Returns list of all mirrored markets with masked pot totals while OPEN.
   * Supports filtering by status, event_slug, and category (Politics|Crypto|Sports|Others).
   */
  fastify.get<{
    Querystring: { event_slug?: string; status?: any; category?: string };
  }>("/api/markets", async (req, reply) => {
    const { event_slug, status, category } = req.query;

    let markets: MarketRecord[];
    if (event_slug) {
      markets = db.listMarketsByEventSlug(event_slug);
      if (category) {
        markets = markets.filter(
          (m) => (m.category || "Others").toLowerCase() === category.toLowerCase()
        );
      }
      if (status) {
        markets = markets.filter((m) => m.status === status);
      }
    } else {
      markets = db.listMarkets({ status, category });
    }

    const formatted = markets.map((m) => formatMarketResponse(m, db));
    return reply.send({ markets: formatted });
  });

  /**
   * GET /api/markets/directory
   * Returns directory grouped strictly by Politics, Crypto, Sports, and Others.
   */
  fastify.get("/api/markets/directory", async (req, reply) => {
    const allMarkets = db.listMarkets();
    const directory: Record<"Politics" | "Crypto" | "Sports" | "Others", any[]> = {
      Politics: [],
      Crypto: [],
      Sports: [],
      Others: [],
    };

    for (const m of allMarkets) {
      const cat = (m.category as "Politics" | "Crypto" | "Sports" | "Others") || "Others";
      const formatted = formatMarketResponse(m, db);
      if (directory[cat]) {
        directory[cat].push(formatted);
      } else {
        directory.Others.push(formatted);
      }
    }

    return reply.send({
      categories: {
        Politics: { count: directory.Politics.length, markets: directory.Politics },
        Crypto: { count: directory.Crypto.length, markets: directory.Crypto },
        Sports: { count: directory.Sports.length, markets: directory.Sports },
        Others: { count: directory.Others.length, markets: directory.Others },
      },
      total: allMarkets.length,
    });
  });

  /**
   * GET /api/markets/:id
   * Returns market details needed for client-side zero-POST bet encryption.
   * Pots remain sealed/null while OPEN.
   */
  fastify.get<{ Params: { id: string } }>("/api/markets/:id", async (req, reply) => {
    const { id } = req.params;
    let market = db.getMarket(id);

    if (!market) {
      // Fallback search by slug or event_slug
      market = db.getMarketBySlug(id);
    }

    if (!market) {
      return reply.status(404).send({ error: `Market '${id}' not found` });
    }

    const formatted = formatMarketResponse(market, db);

    return reply.send({
      market: {
        ...formatted,
        // Zero-POST parameters: Client uses these to encrypt bet and boxed UA locally
        coordinator_public_key: Buffer.from(COORDINATOR_CONFIG.settlementPublicKey).toString("hex"),
      },
    });
  });

  /**
   * GET /api/markets/:id/history
   * Cached graph proxy endpoint. Client browser never contacts clob.polymarket.com directly.
   * Keyed by `${marketId}:${interval}` with 5-minute TTL.
   */
  fastify.get<{
    Params: { id: string };
    Querystring: { interval?: string; fidelity?: number };
  }>("/api/markets/:id/history", async (req, reply) => {
    const { id } = req.params;
    const interval = (req.query.interval || "1d").toLowerCase();
    const validInterval = ["1d", "1w", "1m", "max"].includes(interval) ? interval : "1d";
    const reqFidelity = req.query.fidelity;

    let market = db.getMarket(id);
    if (!market) {
      market = db.getMarketBySlug(id);
    }

    if (!market) {
      return reply.status(404).send({ error: `Market '${id}' not found` });
    }

    // 1. Check cache
    const cacheKey = `${market.id}:${validInterval}`;
    const cached = historyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return reply.send({ history: cached.data });
    }

    // 2. Rolling Blitz market: return synthetic ticks
    if (market.id.startsWith("blitz-") || !market.yes_token_id) {
      const history = market.id.startsWith("blitz-")
        ? generateBlitzHistory(market, validInterval)
        : [
            {
              t: Math.floor(Date.now() / 1000),
              yesPct: Number(((market.ref_yes_price ?? 0.5) * 100).toFixed(1)),
              noPct: Number((100 - (market.ref_yes_price ?? 0.5) * 100).toFixed(1)),
            },
          ];

      historyCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data: history,
      });

      return reply.send({ history });
    }

    // 3. Fetch from Polymarket CLOB backend proxy
    try {
      const fidelityParam = reqFidelity
        ? `&fidelity=${reqFidelity}`
        : DEFAULT_FIDELITY[validInterval]
        ? `&fidelity=${DEFAULT_FIDELITY[validInterval]}`
        : "";

      const clobUrl = `https://clob.polymarket.com/prices-history?market=${market.yes_token_id}&interval=${validInterval}${fidelityParam}`;
      const res = await fetch(clobUrl, {
        headers: { "User-Agent": "NocturneMarkets/0.2.0" },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`Upstream CLOB returned HTTP ${res.status}`);
      }

      const json = await res.json();
      const points = Array.isArray(json.history) ? json.history : [];
      const history = points.map((p: any) => {
        const pVal = typeof p.p === "number" ? p.p : parseFloat(p.p || "0.5");
        const yesPct = Number((pVal * 100).toFixed(1));
        const noPct = Number((100 - yesPct).toFixed(1));
        return { t: Number(p.t), yesPct, noPct };
      });

      historyCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data: history,
      });

      return reply.send({ history });
    } catch (err: any) {
      // Graceful fallback on network timeout or upstream CLOB error
      if (cached) {
        return reply.send({ history: cached.data });
      }

      const fallbackPrice = market.ref_yes_price ?? 0.5;
      const yesPct = Number((fallbackPrice * 100).toFixed(1));
      const fallbackHistory = [
        {
          t: Math.floor(Date.now() / 1000),
          yesPct,
          noPct: Number((100 - yesPct).toFixed(1)),
        },
      ];

      return reply.send({ history: fallbackHistory });
    }
  });

  /**
   * GET /api/markets/:id/audit
   * Public post-settlement audit package.
   * Pots and sides are masked while OPEN.
   */
  fastify.get<{ Params: { id: string } }>("/api/markets/:id/audit", async (req, reply) => {
    const { id } = req.params;
    const market = db.getMarket(id);

    if (!market) {
      return reply.status(404).send({ error: `Market '${id}' not found` });
    }

    const isClosedOrSettled =
      market.status === "CLOSED" ||
      market.status === "RESOLVED" ||
      market.status === "SETTLED" ||
      market.status === "REFUNDED";

    const bets = db.listBetsForMarket(id);

    // Format commitments without exposing payout envelopes
    const commitments = bets.map((b) => ({
      id: b.id,
      commitment: b.commitment,
      amount_zats: isClosedOrSettled ? b.amount_zats : null,
      amount_zec: isClosedOrSettled ? b.amount_zats / 100_000_000 : null,
      decrypted_side: market.status === "OPEN" ? "SEALED" : b.decrypted_side,
      deposit_txid: b.deposit_txid,
      block_height: b.block_height,
    }));

    return reply.send({
      audit: {
        market_id: market.id,
        title: market.title,
        status: market.status,
        outcome: market.outcome,
        category: market.category || "Others",
        drand_round: market.drand_round,
        merkle_root: market.merkle_root,
        pot_address: market.pot_address,
        pot_uvk:
          market.status === "SETTLED"
            ? market.pot_uvk || COORDINATOR_CONFIG.potUvk || null
            : null,
        pots_sealed: !isClosedOrSettled,
        total_pot_zats: isClosedOrSettled ? market.total_pot_zats : null,
        yes_pot_zats: isClosedOrSettled ? market.yes_pot_zats : null,
        no_pot_zats: isClosedOrSettled ? market.no_pot_zats : null,
        total_bets: commitments.length,
        commitments,
      },
    });
  });
};
