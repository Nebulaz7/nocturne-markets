import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { CoordinatorDatabase } from "../db/index.ts";
import { COORDINATOR_CONFIG } from "../config.ts";

export interface MarketRoutesOptions {
  db: CoordinatorDatabase;
}

export const marketRoutes: FastifyPluginAsync<MarketRoutesOptions> = async (
  fastify: FastifyInstance,
  options: MarketRoutesOptions
) => {
  const { db } = options;

  /**
   * GET /api/markets
   * Returns list of all mirrored markets with pot sizes, slug metadata, and status.
   */
  fastify.get<{ Querystring: { event_slug?: string; status?: any } }>("/api/markets", async (req, reply) => {
    const { event_slug, status } = req.query;

    let markets = event_slug
      ? db.listMarketsByEventSlug(event_slug)
      : db.listMarkets(status ? { status } : undefined);

    const formatted = markets.map((m) => ({
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
      close_time: m.close_time,
      drand_round: m.drand_round,
      status: m.status,
      outcome: m.outcome,
      pot_address: m.pot_address,
      total_pot_zats: m.total_pot_zats,
      yes_pot_zats: m.yes_pot_zats,
      no_pot_zats: m.no_pot_zats,
      total_pot_zec: m.total_pot_zats / 100_000_000,
      yes_pot_zec: m.yes_pot_zats / 100_000_000,
      no_pot_zec: m.no_pot_zats / 100_000_000,
    }));

    return reply.send({ markets: formatted });
  });

  /**
   * GET /api/markets/:id
   * Returns market details needed for client-side zero-POST bet encryption:
   * pot_address, drand_round, and coordinator_public_key.
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

    const betsCount = db.listBetsForMarket(market.id).length;

    return reply.send({
      market: {
        id: market.id,
        polymarket_id: market.polymarket_id,
        title: market.title,
        slug: market.slug,
        event_slug: market.event_slug || null,
        market_slug: market.market_slug || null,
        condition_id: market.condition_id || null,
        question: market.question || null,
        group_item_title: market.group_item_title || null,
        ref_yes_price: market.ref_yes_price ?? null,
        close_time: market.close_time,
        drand_round: market.drand_round,
        status: market.status,
        outcome: market.outcome,
        pot_address: market.pot_address,
        total_pot_zats: market.total_pot_zats,
        total_pot_zec: market.total_pot_zats / 100_000_000,
        yes_pot_zec: market.yes_pot_zats / 100_000_000,
        no_pot_zec: market.no_pot_zats / 100_000_000,
        bets_count: betsCount,
        // Zero-POST parameters: Client uses these to encrypt bet and boxed UA locally
        coordinator_public_key: Buffer.from(COORDINATOR_CONFIG.settlementPublicKey).toString("hex"),
      },
    });
  });

  /**
   * GET /api/markets/:id/audit
   * Public post-settlement audit package:
   * Returns all revealed commitments, pot tallies, drand beacon info, and Merkle root.
   */
  fastify.get<{ Params: { id: string } }>("/api/markets/:id/audit", async (req, reply) => {
    const { id } = req.params;
    const market = db.getMarket(id);

    if (!market) {
      return reply.status(404).send({ error: `Market '${id}' not found` });
    }

    const bets = db.listBetsForMarket(id);

    // Format commitments without exposing payout envelopes
    const commitments = bets.map((b) => ({
      id: b.id,
      commitment: b.commitment,
      amount_zats: b.amount_zats,
      amount_zec: b.amount_zats / 100_000_000,
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
        drand_round: market.drand_round,
        merkle_root: market.merkle_root,
        pot_address: market.pot_address,
        pot_uvk: market.status === "SETTLED" ? (market.pot_uvk || COORDINATOR_CONFIG.potUvk || null) : null,
        total_pot_zats: market.total_pot_zats,
        yes_pot_zats: market.yes_pot_zats,
        no_pot_zats: market.no_pot_zats,
        total_bets: commitments.length,
        commitments,
      },
    });
  });
};
