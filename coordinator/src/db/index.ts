import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import {
  SCHEMA_SQL,
  type MarketRecord,
  type BetRecord,
  type PayoutRecord,
  type MarketStatus,
  type BetSide,
  type MarketOutcome,
} from "./schema.ts";

export * from "./schema.ts";

export class CoordinatorDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = ":memory:") {
    if (dbPath !== ":memory:") {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA_SQL);
  }

  // --- MARKETS ---

  public createMarket(params: {
    id: string;
    polymarket_id?: string | null;
    title: string;
    slug?: string | null;
    close_time: number;
    drand_round: number;
    pot_address: string;
    pot_uvk?: string | null;
  }): MarketRecord {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO markets (
        id, polymarket_id, title, slug, close_time, drand_round, status,
        outcome, pot_address, pot_uvk, merkle_root, total_pot_zats,
        yes_pot_zats, no_pot_zats, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', NULL, ?, ?, NULL, 0, 0, 0, ?, ?)
    `);

    stmt.run(
      params.id,
      params.polymarket_id ?? null,
      params.title,
      params.slug ?? null,
      params.close_time,
      params.drand_round,
      params.pot_address,
      params.pot_uvk ?? null,
      now,
      now
    );

    return this.getMarket(params.id)!;
  }

  public getMarket(id: string): MarketRecord | null {
    const stmt = this.db.prepare("SELECT * FROM markets WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? (row as MarketRecord) : null;
  }

  public listMarkets(filter?: { status?: MarketStatus }): MarketRecord[] {
    if (filter?.status) {
      const stmt = this.db.prepare("SELECT * FROM markets WHERE status = ? ORDER BY close_time ASC");
      return (stmt.all(filter.status) as any[]) as MarketRecord[];
    }
    const stmt = this.db.prepare("SELECT * FROM markets ORDER BY close_time ASC");
    return (stmt.all() as any[]) as MarketRecord[];
  }

  public updateMarketStatus(
    id: string,
    status: MarketStatus,
    outcome?: MarketOutcome | null,
    merkleRoot?: string | null
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE markets 
      SET status = ?, outcome = COALESCE(?, outcome), merkle_root = COALESCE(?, merkle_root), updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, outcome ?? null, merkleRoot ?? null, now, id);
  }

  public updateMarketPots(
    id: string,
    totalZats: number,
    yesZats: number,
    noZats: number
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE markets 
      SET total_pot_zats = ?, yes_pot_zats = ?, no_pot_zats = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(totalZats, yesZats, noZats, now, id);
  }

  public updateMarketUvk(id: string, potUvk: string): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE markets 
      SET pot_uvk = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(potUvk, now, id);
  }

  public updateMarketCloseTime(id: string, closeTime: number): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE markets
      SET close_time = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(closeTime, now, id);
  }

  // --- BETS ---

  public insertBet(params: {
    id: string;
    market_id: string;
    commitment: string;
    amount_zats: number;
    tlock_envelope: Uint8Array | Buffer;
    payout_envelope: Uint8Array | Buffer;
    deposit_txid?: string | null;
    block_height?: number | null;
  }): BetRecord {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO bets (
        id, market_id, commitment, amount_zats, tlock_envelope, payout_envelope,
        deposit_txid, block_height, decrypted_side, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'CONFIRMED', ?)
    `);

    stmt.run(
      params.id,
      params.market_id,
      params.commitment,
      params.amount_zats,
      params.tlock_envelope,
      params.payout_envelope,
      params.deposit_txid ?? null,
      params.block_height ?? null,
      now
    );

    // Atomically increment total pot for the market
    const market = this.getMarket(params.market_id);
    if (market) {
      this.updateMarketPots(
        market.id,
        market.total_pot_zats + params.amount_zats,
        market.yes_pot_zats,
        market.no_pot_zats
      );
    }

    return this.getBet(params.id)!;
  }

  public getBet(id: string): BetRecord | null {
    const stmt = this.db.prepare("SELECT * FROM bets WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? (row as BetRecord) : null;
  }

  public getBetByCommitment(commitment: string): BetRecord | null {
    const stmt = this.db.prepare("SELECT * FROM bets WHERE commitment = ?");
    const row = stmt.get(commitment) as any;
    return row ? (row as BetRecord) : null;
  }

  public listBetsForMarket(marketId: string): BetRecord[] {
    const stmt = this.db.prepare("SELECT * FROM bets WHERE market_id = ? ORDER BY created_at ASC");
    return (stmt.all(marketId) as any[]) as BetRecord[];
  }

  public updateBetDecryptedSide(id: string, side: BetSide): void {
    const stmt = this.db.prepare(`
      UPDATE bets 
      SET decrypted_side = ?, status = 'REVEALED'
      WHERE id = ?
    `);
    stmt.run(side, id);
  }

  public updateBetStatus(id: string, status: "CONFIRMED" | "REVEALED" | "SETTLED" | "REFUNDED"): void {
    const stmt = this.db.prepare("UPDATE bets SET status = ? WHERE id = ?");
    stmt.run(status, id);
  }

  // --- PAYOUTS ---

  public createPayout(params: {
    id: string;
    market_id: string;
    bet_id: string;
    amount_zats: number;
    destination_address: string;
  }): PayoutRecord {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO payouts (
        id, market_id, bet_id, amount_zats, destination_address, txid, status, created_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, NULL, 'PENDING', ?, NULL)
    `);

    stmt.run(
      params.id,
      params.market_id,
      params.bet_id,
      params.amount_zats,
      params.destination_address,
      now
    );

    return this.getPayout(params.id)!;
  }

  public getPayout(id: string): PayoutRecord | null {
    const stmt = this.db.prepare("SELECT * FROM payouts WHERE id = ?");
    const row = stmt.get(id) as any;
    return row ? (row as PayoutRecord) : null;
  }

  public listPayoutsForMarket(marketId: string): PayoutRecord[] {
    const stmt = this.db.prepare("SELECT * FROM payouts WHERE market_id = ? ORDER BY created_at ASC");
    return (stmt.all(marketId) as any[]) as PayoutRecord[];
  }

  public updatePayoutTxid(id: string, txid: string, status: "BROADCASTED" | "CONFIRMED" = "BROADCASTED"): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE payouts 
      SET txid = ?, status = ?, sent_at = ?
      WHERE id = ?
    `);
    stmt.run(txid, status, now, id);
  }

  // --- SYNC STATE ---

  public getSyncState(key: string, defaultValue: string = "0"): string {
    const stmt = this.db.prepare("SELECT value FROM sync_state WHERE key = ?");
    const row = stmt.get(key) as any;
    return row ? row.value : defaultValue;
  }

  public setSyncState(key: string, value: string): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO sync_state (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, now);
  }

  public close(): void {
    this.db.close();
  }
}
