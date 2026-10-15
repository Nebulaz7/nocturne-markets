/**
 * Pure, zero-network-call Polymarket URL parser and in-memory matcher.
 * Provides the core engine for Nocturne's Zero-Leak "Shield Any Polymarket Link" Teleporter.
 */

export interface ParsedPolymarketUrl {
  rawInput: string;
  sanitized: string;
  eventSlug: string | null;
  marketSlug: string | null;
  isExplicitMarket: boolean;
}

export interface MarketSummary {
  id: string;
  title: string;
  slug?: string | null;
  event_slug?: string | null;
  market_slug?: string | null;
  condition_id?: string | null;
  question?: string | null;
  group_item_title?: string | null;
  ref_yes_price?: number | null;
  status: string;
  total_pot_zats?: number;
  close_time?: number;
}

export type PolymarketMatchType = "SINGLE_MARKET" | "MULTI_MARKET" | "NOT_FOUND";

export interface PolymarketMatchResult {
  parsed: ParsedPolymarketUrl;
  matched: boolean;
  type: PolymarketMatchType;
  market?: MarketSummary;
  subMarkets?: MarketSummary[];
}

/**
 * Strips repeated protocol/domain prefixes iteratively, handling stacked URLs like:
 * "https://nocturnemarkets.cv/https://polymarket.com/event/fed-decision-in-october"
 * or mangled browser pathnames like "https:/polymarket.com/event/...".
 */
function cleanPrefixes(raw: string): string {
  let s = raw.trim();

  // Strip query strings and hash anchors
  s = s.split("?")[0].split("#")[0];

  let changed = true;
  while (changed) {
    const before = s;

    // Strip Nocturne domains / localhost
    s = s.replace(/^(?:https?:\/?\/?)?(?:www\.)?nocturnemarkets\.(?:cv|com|xyz|org|net)\/?/i, "");
    s = s.replace(/^(?:https?:\/?\/?)?localhost(?::\d+)?\/?/i, "");

    // Strip Polymarket domains
    s = s.replace(/^(?:https?:\/?\/?)?(?:www\.)?polymarket\.com\/?/i, "");

    // Strip leading protocols or slashes
    s = s.replace(/^(?:https?:\/?\/)+/i, "");
    s = s.replace(/^\/+/, "");

    changed = s !== before;
  }

  // Remove trailing slashes
  s = s.replace(/\/+$/, "");
  return s;
}

/**
 * Parses any Polymarket URL, path, or slug into normalized { eventSlug, marketSlug }.
 * 100% pure TypeScript string manipulation with ZERO network requests.
 */
export function parsePolymarketUrl(input: string): ParsedPolymarketUrl {
  const rawInput = input ?? "";
  const sanitized = cleanPrefixes(rawInput);

  if (!sanitized) {
    return {
      rawInput,
      sanitized: "",
      eventSlug: null,
      marketSlug: null,
      isExplicitMarket: false,
    };
  }

  const segments = sanitized.split("/").map((seg) => decodeURIComponent(seg).trim()).filter(Boolean);

  let eventSlug: string | null = null;
  let marketSlug: string | null = null;
  let isExplicitMarket = false;

  if (segments.length === 0) {
    return { rawInput, sanitized, eventSlug: null, marketSlug: null, isExplicitMarket: false };
  }

  const first = segments[0].toLowerCase();

  if (first === "event" || first === "e") {
    // /event/<eventSlug> OR /event/<eventSlug>/<marketSlug>
    eventSlug = segments[1] ?? null;
    if (segments.length >= 3) {
      marketSlug = segments[2];
      isExplicitMarket = true;
    }
  } else if (first === "market" || first === "m") {
    // /market/<marketSlug>
    marketSlug = segments[1] ?? null;
    isExplicitMarket = true;
  } else if (segments.length >= 2) {
    // Assume <eventSlug>/<marketSlug>
    eventSlug = segments[0];
    marketSlug = segments[1];
    isExplicitMarket = true;
  } else {
    // Single slug provided (e.g. "fed-decision-in-october")
    eventSlug = segments[0];
    marketSlug = segments[0];
    isExplicitMarket = false;
  }

  return {
    rawInput,
    sanitized,
    eventSlug,
    marketSlug,
    isExplicitMarket,
  };
}

/**
 * Compares two slugs flexibly, matching exact slugs or common Polymarket timestamp/hash suffixes.
 * E.g., "fed-decision-in-october" matches "fed-decision-in-october-20260617190323537".
 */
export function slugMatches(targetSlug: string | null | undefined, querySlug: string | null | undefined): boolean {
  if (!targetSlug || !querySlug) return false;
  const t = targetSlug.trim().toLowerCase();
  const q = querySlug.trim().toLowerCase();

  if (t === q) return true;
  if (t.startsWith(q) || q.startsWith(t)) return true;

  // Compare without non-alphanumeric noise
  const tClean = t.replace(/[^a-z0-9]/g, "");
  const qClean = q.replace(/[^a-z0-9]/g, "");
  if (tClean === qClean || tClean.startsWith(qClean) || qClean.startsWith(tClean)) {
    return true;
  }

  return false;
}

/**
 * Matches a Polymarket URL input against a local in-memory array of markets.
 * ZERO network requests are made.
 *
 * Rules:
 * 1. If explicit sub-market URL -> resolves directly to that single market.
 * 2. If event URL matching 1 market -> resolves directly to that market.
 * 3. If event URL matching multiple binary sub-markets -> returns MULTI_MARKET with subMarkets list.
 * 4. If no match -> returns NOT_FOUND.
 */
export function matchPolymarketUrl(input: string, markets: MarketSummary[]): PolymarketMatchResult {
  const parsed = parsePolymarketUrl(input);

  if (!parsed.sanitized || markets.length === 0) {
    return {
      parsed,
      matched: false,
      type: "NOT_FOUND",
    };
  }

  // 1. If explicit submarket was targeted, look for market_slug or direct id
  if (parsed.isExplicitMarket && parsed.marketSlug) {
    const market = markets.find(
      (m) =>
        slugMatches(m.market_slug, parsed.marketSlug) ||
        slugMatches(m.slug, parsed.marketSlug) ||
        m.id.toLowerCase() === parsed.marketSlug!.toLowerCase()
    );

    if (market) {
      return {
        parsed,
        matched: true,
        type: "SINGLE_MARKET",
        market,
      };
    }
  }

  // 2. Search by eventSlug across all markets
  if (parsed.eventSlug) {
    const eventMatches = markets.filter(
      (m) =>
        slugMatches(m.event_slug, parsed.eventSlug) ||
        slugMatches(m.slug, parsed.eventSlug) ||
        m.id.toLowerCase() === parsed.eventSlug!.toLowerCase()
    );

    if (eventMatches.length === 1) {
      return {
        parsed,
        matched: true,
        type: "SINGLE_MARKET",
        market: eventMatches[0],
      };
    }

    if (eventMatches.length > 1) {
      return {
        parsed,
        matched: true,
        type: "MULTI_MARKET",
        subMarkets: eventMatches,
      };
    }
  }

  // 3. Search by marketSlug if not explicit
  if (parsed.marketSlug) {
    const marketMatches = markets.filter(
      (m) =>
        slugMatches(m.market_slug, parsed.marketSlug) ||
        slugMatches(m.slug, parsed.marketSlug) ||
        m.id.toLowerCase() === parsed.marketSlug!.toLowerCase()
    );

    if (marketMatches.length === 1) {
      return {
        parsed,
        matched: true,
        type: "SINGLE_MARKET",
        market: marketMatches[0],
      };
    }

    if (marketMatches.length > 1) {
      return {
        parsed,
        matched: true,
        type: "MULTI_MARKET",
        subMarkets: marketMatches,
      };
    }
  }

  // 4. Fallback search by conditionId
  const byCondition = markets.find(
    (m) => m.condition_id && m.condition_id.toLowerCase() === parsed.sanitized.toLowerCase()
  );
  if (byCondition) {
    return {
      parsed,
      matched: true,
      type: "SINGLE_MARKET",
      market: byCondition,
    };
  }

  return {
    parsed,
    matched: false,
    type: "NOT_FOUND",
  };
}
