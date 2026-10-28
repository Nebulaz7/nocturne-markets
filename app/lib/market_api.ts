import {
  prepareZeroPostBet,
  type ZeroPostBetParams,
  type PreparedBetReceipt,
  type BetSide,
} from "./bet_builder.ts";
import {
  getBetReceipts,
  saveBetReceipt,
  updateBetReceiptStatus,
} from "./vault.ts";
import { generateMerkleProof, verifyMerkleProof } from "./merkle.ts";
import type { MarketSummary } from "./polymarket_url.ts";

export type CategoryFilter =
  | "All"
  | "Politics"
  | "Crypto"
  | "Sports"
  | "Others";
export type HistoryInterval = "1d" | "1w" | "1m" | "max";

export interface MarketHistoryPoint {
  t: number;
  yesPct: number;
  noPct: number;
}

export interface MarketDirectoryResponse {
  categories: {
    Politics: { count: number; markets: MarketSummary[] };
    Crypto: { count: number; markets: MarketSummary[] };
    Sports: { count: number; markets: MarketSummary[] };
    Others: { count: number; markets: MarketSummary[] };
  };
  total: number;
}

export interface LocalReceiptAuditResult {
  receiptId: string;
  commitment: string;
  side: BetSide;
  amountZec: number;
  foundInAudit: boolean;
  marketStatus: string;
  proofValid: boolean;
  computedRoot?: string;
  merkleRoot?: string;
}

function getCoordinatorBaseUrl(customBaseUrl?: string): string {
  if (customBaseUrl) return customBaseUrl.replace(/\/+$/, "");
  if (typeof process !== "undefined" && process.env) {
    const envUrl =
      process.env.NEXT_PUBLIC_COORDINATOR_URL || process.env.COORDINATOR_URL;
    if (envUrl) return envUrl.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:3000";
}

/**
 * Fetches markets from the Coordinator API.
 * Supports filtering by category ('All', 'Politics', 'Crypto', 'Sports', 'Others')
 * and market status ('OPEN', 'CLOSED', 'RESOLVED', 'SETTLED').
 */
export async function fetchMarkets(params?: {
  category?: CategoryFilter;
  status?: string;
  baseUrl?: string;
}): Promise<MarketSummary[]> {
  const baseUrl = getCoordinatorBaseUrl(params?.baseUrl);
  const searchParams = new URLSearchParams();

  if (params?.category && params.category !== "All") {
    searchParams.set("category", params.category);
  }
  if (params?.status) {
    searchParams.set("status", params.status);
  }

  const query = searchParams.toString();
  const url = `${baseUrl}/api/markets${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch markets: HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data.markets || []) as MarketSummary[];
}

/**
 * Fetches directory grouped strictly by Politics, Crypto, Sports, and Others.
 */
export async function fetchMarketsDirectory(
  baseUrl?: string,
): Promise<MarketDirectoryResponse> {
  const root = getCoordinatorBaseUrl(baseUrl);
  const res = await fetch(`${root}/api/markets/directory`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch market directory: HTTP ${res.status}`);
  }

  return (await res.json()) as MarketDirectoryResponse;
}

/**
 * Fetches market probability history graph data from server-side cached proxy.
 * Safe for privacy: browser never contacts clob.polymarket.com directly.
 */
export async function fetchMarketHistory(
  marketId: string,
  interval: HistoryInterval = "1d",
  baseUrl?: string,
): Promise<MarketHistoryPoint[]> {
  const root = getCoordinatorBaseUrl(baseUrl);
  const url = `${root}/api/markets/${encodeURIComponent(marketId)}/history?interval=${interval}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch market history: HTTP ${res.status}`);
  }

  const data = await res.json();
  return (data.history || []) as MarketHistoryPoint[];
}

/**
 * Prepares a Zero-POST Dual-Envelope bet request locally, constructs the ZIP-321
 * payment URI, and saves the receipt to the private browser localStorage vault.
 * 100% offline: zero HTTP requests sent to drand or external servers.
 */
export async function generateAndSaveBetReceipt(
  params: ZeroPostBetParams,
): Promise<PreparedBetReceipt> {
  const receipt = await prepareZeroPostBet(params);
  saveBetReceipt(receipt);
  return receipt;
}

/**
 * Verifies local bet receipts in localStorage against the coordinator's public audit endpoint.
 * Performs client-side Merkle proof verification directly in browser memory.
 */
export async function verifyLocalReceipts(
  marketId: string,
  baseUrl?: string,
): Promise<LocalReceiptAuditResult[]> {
  const receipts = getBetReceipts().filter((r) => r.marketId === marketId);
  if (receipts.length === 0) {
    return [];
  }

  const root = getCoordinatorBaseUrl(baseUrl);
  const res = await fetch(
    `${root}/api/markets/${encodeURIComponent(marketId)}/audit`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch audit data for market ${marketId}: HTTP ${res.status}`,
    );
  }

  const auditData = await res.json();
  const audit = auditData.audit;
  const auditCommitments = Array.isArray(audit?.commitments)
    ? audit.commitments.map((c: any) => c.commitment.toLowerCase().trim())
    : [];

  const expectedRoot = audit?.merkle_root || "";

  const results: LocalReceiptAuditResult[] = [];

  for (const receipt of receipts) {
    const targetCommitment = receipt.commitment.toLowerCase().trim();
    const foundInAudit = auditCommitments.includes(targetCommitment);

    let proofValid = false;
    let computedRoot: string | undefined;

    if (foundInAudit && expectedRoot && auditCommitments.length > 0) {
      const proof = await generateMerkleProof(
        auditCommitments,
        targetCommitment,
        expectedRoot,
      );
      if (proof) {
        proofValid = await verifyMerkleProof(
          targetCommitment,
          proof.steps,
          expectedRoot,
        );
        computedRoot = proof.computedRoot;
      }
    }

    // Update receipt status reactively in localStorage
    if (foundInAudit) {
      if (audit.status === "SETTLED") {
        updateBetReceiptStatus(receipt.id, "SETTLED");
      } else if (receipt.status === "PENDING_SCAN") {
        updateBetReceiptStatus(receipt.id, "SEALED");
      }
    }

    results.push({
      receiptId: receipt.id,
      commitment: receipt.commitment,
      side: receipt.side,
      amountZec: receipt.amountZec,
      foundInAudit,
      marketStatus: audit.status || "UNKNOWN",
      proofValid,
      computedRoot,
      merkleRoot: expectedRoot || undefined,
    });
  }

  return results;
}
/**
 * Manually confirms an on-chain deposit to the coordinator database.
 * Used during local development/testing to register real testnet deposits.
 */
export async function confirmManualBetDeposit(
  params: {
    marketId: string;
    commitment: string;
    amountZec?: number;
    depositTxid?: string;
  },
  baseUrl?: string,
): Promise<boolean> {
  const base = getCoordinatorBaseUrl(baseUrl);
  try {
    const res = await fetch(`${base}/api/bets/confirm-manual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId: params.marketId,
        commitment: params.commitment,
        amountZec: params.amountZec ?? 0.05,
        depositTxid: params.depositTxid,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error(
      "[confirmManualBetDeposit] Failed to reach coordinator:",
      err,
    );
    return false;
  }
}

export interface AuditCommitmentItem {
  id: string;
  commitment: string;
  amount_zats: number | null;
  amount_zec: number | null;
  decrypted_side: string;
  deposit_txid: string | null;
  block_height: number | null;
}

export interface MarketAuditPackage {
  market_id: string;
  title: string;
  status: string;
  outcome: string | null;
  category: string;
  drand_round: number | string;
  merkle_root: string | null;
  pot_address: string;
  pot_uvk: string | null;
  pots_sealed: boolean;
  total_pot_zats: number | null;
  yes_pot_zats: number | null;
  no_pot_zats: number | null;
  total_bets: number;
  commitments: AuditCommitmentItem[];
}

/**
 * Fetches the public Merkle audit package for a market from the coordinator.
 */
export async function fetchMarketAudit(
  marketId: string,
  baseUrl?: string
): Promise<MarketAuditPackage> {
  const root = getCoordinatorBaseUrl(baseUrl);
  const res = await fetch(
    `${root}/api/markets/${encodeURIComponent(marketId)}/audit`,
    {
      headers: { Accept: "application/json" },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch audit: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.audit || json;
}

export interface BlitzMarketItem {
  id: string;
  title: string;
  slug?: string;
  market_slug?: string;
  event_slug?: string;
  question?: string;
  group_item_title?: string;
  category: string;
  image?: string | null;
  icon?: string | null;
  close_time: number;
  drand_round: number;
  status: string;
  pot_address: string;
  coordinator_public_key: string;
  market_type: string;
  payout_multiplier: number;
  seconds_left: number;
  total_pot_zec?: number;
  yes_pot_zec?: number;
  no_pot_zec?: number;
  ref_yes_price?: number;
}

/**
 * Fetches the currently active 10-Minute Rolling ZEC Blitz market from the coordinator.
 */
export async function fetchBlitzMarket(baseUrl?: string): Promise<BlitzMarketItem> {
  const root = getCoordinatorBaseUrl(baseUrl);
  const res = await fetch(`${root}/api/markets/blitz`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch blitz market: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.market;
}

