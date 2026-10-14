export type MarketStatus =
  | "OPEN"
  | "CLOSED"
  | "RESOLVED"
  | "SETTLED"
  | "REFUNDED";

export type BetSide = "YES" | "NO";
export type MarketOutcome = "YES" | "NO" | "VOID";

export interface MarketRecord {
  id: string;
  polymarket_id: string | null;
  title: string;
  slug: string | null;
  close_time: number; // Unix seconds
  drand_round: number;
  status: MarketStatus;
  outcome: MarketOutcome | null;
  pot_address: string;
  pot_uvk: string | null;
  merkle_root: string | null;
  total_pot_zats: number;
  yes_pot_zats: number;
  no_pot_zats: number;
  created_at: number;
  updated_at: number;
}

export interface BetRecord {
  id: string;
  market_id: string;
  commitment: string; // 64 hex chars (SHA-256 of tlock_envelope)
  amount_zats: number;
  tlock_envelope: Uint8Array; // 217 bytes
  payout_envelope: Uint8Array;
  deposit_txid: string | null;
  block_height: number | null;
  decrypted_side: BetSide | null;
  status: "CONFIRMED" | "REVEALED" | "SETTLED" | "REFUNDED";
  created_at: number;
}

export interface PayoutRecord {
  id: string;
  market_id: string;
  bet_id: string;
  amount_zats: number;
  destination_address: string;
  txid: string | null;
  status: "PENDING" | "BROADCASTED" | "CONFIRMED" | "FAILED";
  created_at: number;
  sent_at: number | null;
}

export interface SyncStateRecord {
  key: string;
  value: string;
  updated_at: number;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY,
  polymarket_id TEXT,
  title TEXT NOT NULL,
  slug TEXT,
  close_time INTEGER NOT NULL,
  drand_round INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  outcome TEXT,
  pot_address TEXT NOT NULL,
  pot_uvk TEXT,
  merkle_root TEXT,
  total_pot_zats INTEGER NOT NULL DEFAULT 0,
  yes_pot_zats INTEGER NOT NULL DEFAULT 0,
  no_pot_zats INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  commitment TEXT NOT NULL UNIQUE,
  amount_zats INTEGER NOT NULL,
  tlock_envelope BLOB NOT NULL,
  payout_envelope BLOB NOT NULL,
  deposit_txid TEXT,
  block_height INTEGER,
  decrypted_side TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL REFERENCES markets(id),
  bet_id TEXT NOT NULL REFERENCES bets(id),
  amount_zats INTEGER NOT NULL,
  destination_address TEXT NOT NULL,
  txid TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bets_market_id ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_bets_commitment ON bets(commitment);
CREATE INDEX IF NOT EXISTS idx_payouts_market_id ON payouts(market_id);
`;
