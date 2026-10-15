import assert from "node:assert";
import {
  parsePolymarketUrl,
  matchPolymarketUrl,
  slugMatches,
  type MarketSummary,
} from "./polymarket_url.ts";

function runPolymarketUrlTests() {
  console.log("=== Running Polymarket URL Parser & Matcher Unit Tests ===\n");

  // --------------------------------------------------------------------------
  // 1. URL Parsing Tests
  // --------------------------------------------------------------------------
  console.log("1. Testing parsePolymarketUrl with all URL variations...");

  // Variant A: Full Event URL
  const p1 = parsePolymarketUrl("https://polymarket.com/event/fed-decision-in-october");
  assert.strictEqual(p1.eventSlug, "fed-decision-in-october");
  assert.strictEqual(p1.marketSlug, null);
  assert.strictEqual(p1.isExplicitMarket, false);

  // Variant B: Nested Sub-Market URL
  const p2 = parsePolymarketUrl("https://polymarket.com/event/fed-decision-in-october/fed-decreases-interest-rates-by-25-bps");
  assert.strictEqual(p2.eventSlug, "fed-decision-in-october");
  assert.strictEqual(p2.marketSlug, "fed-decreases-interest-rates-by-25-bps");
  assert.strictEqual(p2.isExplicitMarket, true);

  // Variant C: Market URL with query strings and hash
  const p3 = parsePolymarketUrl("https://polymarket.com/market/will-btc-hit-100k?tid=12345&ref=telegram#discussion");
  assert.strictEqual(p3.eventSlug, null);
  assert.strictEqual(p3.marketSlug, "will-btc-hit-100k");
  assert.strictEqual(p3.isExplicitMarket, true);

  // Variant D: Mobile / short links
  const p4 = parsePolymarketUrl("https://polymarket.com/e/fed-decision-in-october");
  assert.strictEqual(p4.eventSlug, "fed-decision-in-october");
  assert.strictEqual(p4.isExplicitMarket, false);

  const p5 = parsePolymarketUrl("https://polymarket.com/m/will-btc-hit-100k");
  assert.strictEqual(p5.marketSlug, "will-btc-hit-100k");
  assert.strictEqual(p5.isExplicitMarket, true);

  // Variant E: Prepend Domain Prefix (Address bar prepending)
  const p6 = parsePolymarketUrl("https://nocturnemarkets.cv/https://polymarket.com/event/fed-decision-in-october");
  assert.strictEqual(p6.eventSlug, "fed-decision-in-october");

  // Variant F: Mangled protocol from catch-all route (/https:/polymarket.com/...)
  const p7 = parsePolymarketUrl("https:/polymarket.com/event/fed-decision-in-october");
  assert.strictEqual(p7.eventSlug, "fed-decision-in-october");

  // Variant G: Relative path
  const p8 = parsePolymarketUrl("/event/fed-decision-in-october");
  assert.strictEqual(p8.eventSlug, "fed-decision-in-october");

  // Variant H: Raw slug
  const p9 = parsePolymarketUrl("fed-decision-in-october");
  assert.strictEqual(p9.eventSlug, "fed-decision-in-october");

  console.log("   ✔ All 9 URL syntax variants parsed successfully.");

  // --------------------------------------------------------------------------
  // 2. Slug Matching with Timestamp/Random Suffixes
  // --------------------------------------------------------------------------
  console.log("2. Testing slug matching with Polymarket timestamp suffixes...");
  assert.strictEqual(
    slugMatches("fed-decision-in-october-20260617190323537", "fed-decision-in-october"),
    true
  );
  assert.strictEqual(
    slugMatches("fed-decision-in-october", "fed-decision-in-october-20260617190323537"),
    true
  );
  assert.strictEqual(
    slugMatches("will-btc-hit-100k", "will-eth-hit-10k"),
    false
  );
  console.log("   ✔ Slug fuzzy prefix and suffix matching verified.");

  // --------------------------------------------------------------------------
  // 3. In-Memory Matching against Cached Markets
  // --------------------------------------------------------------------------
  console.log("3. Testing matchPolymarketUrl in-memory resolution...");

  const mockMarkets: MarketSummary[] = [
    // Multi-bracket event: FOMC October
    {
      id: "fomc-cut-25",
      title: "Fed Decision in October: 25 bps decrease",
      event_slug: "fed-decision-in-october-20260617",
      market_slug: "will-the-fed-decrease-rates-25-bps",
      condition_id: "0xcond101",
      group_item_title: "25 bps decrease",
      ref_yes_price: 0.85,
      status: "OPEN",
    },
    {
      id: "fomc-cut-50",
      title: "Fed Decision in October: 50+ bps decrease",
      event_slug: "fed-decision-in-october-20260617",
      market_slug: "will-the-fed-decrease-rates-50-bps",
      condition_id: "0xcond102",
      group_item_title: "50+ bps decrease",
      ref_yes_price: 0.05,
      status: "OPEN",
    },
    {
      id: "fomc-no-change",
      title: "Fed Decision in October: No change",
      event_slug: "fed-decision-in-october-20260617",
      market_slug: "fed-interest-rates-no-change",
      condition_id: "0xcond103",
      group_item_title: "No change",
      ref_yes_price: 0.10,
      status: "OPEN",
    },
    // Single binary market event: BTC 100k
    {
      id: "btc-100k-market",
      title: "Will Bitcoin hit $100,000 before December 31, 2026?",
      event_slug: "btc-100k-2026-event",
      market_slug: "will-btc-hit-100k-before-dec-2026",
      condition_id: "0xcond201",
      group_item_title: null,
      ref_yes_price: 0.68,
      status: "OPEN",
    },
  ];

  // Test Case A: User pastes event URL with multiple sub-markets
  const matchEvent = matchPolymarketUrl(
    "https://polymarket.com/event/fed-decision-in-october",
    mockMarkets
  );
  assert.strictEqual(matchEvent.matched, true);
  assert.strictEqual(matchEvent.type, "MULTI_MARKET");
  assert.strictEqual(matchEvent.subMarkets?.length, 3);
  console.log("   ✔ Multi-bracket event correctly returns MULTI_MARKET with 3 sub-markets.");

  // Test Case B: User pastes explicit sub-market URL
  const matchSubMarket = matchPolymarketUrl(
    "https://polymarket.com/event/fed-decision-in-october/will-the-fed-decrease-rates-25-bps",
    mockMarkets
  );
  assert.strictEqual(matchSubMarket.matched, true);
  assert.strictEqual(matchSubMarket.type, "SINGLE_MARKET");
  assert.strictEqual(matchSubMarket.market?.id, "fomc-cut-25");
  assert.strictEqual(matchSubMarket.market?.ref_yes_price, 0.85);
  console.log("   ✔ Explicit sub-market URL directly resolves to target binary market.");

  // Test Case C: Single binary market event resolves directly to SINGLE_MARKET
  const matchBtc = matchPolymarketUrl(
    "https://polymarket.com/event/btc-100k-2026",
    mockMarkets
  );
  assert.strictEqual(matchBtc.matched, true);
  assert.strictEqual(matchBtc.type, "SINGLE_MARKET");
  assert.strictEqual(matchBtc.market?.id, "btc-100k-market");
  console.log("   ✔ Single-market event directly resolves to SINGLE_MARKET.");

  // Test Case D: Prepend prefix in address bar
  const matchPrepend = matchPolymarketUrl(
    "nocturnemarkets.cv/https://polymarket.com/market/will-btc-hit-100k-before-dec-2026?r=123",
    mockMarkets
  );
  assert.strictEqual(matchPrepend.matched, true);
  assert.strictEqual(matchPrepend.type, "SINGLE_MARKET");
  assert.strictEqual(matchPrepend.market?.id, "btc-100k-market");
  console.log("   ✔ Address bar prepend URL successfully matched.");

  // Test Case E: Condition ID match
  const matchCondition = matchPolymarketUrl("0xcond102", mockMarkets);
  assert.strictEqual(matchCondition.matched, true);
  assert.strictEqual(matchCondition.market?.id, "fomc-cut-50");
  console.log("   ✔ Condition ID fallback match verified.");

  // Test Case F: Unknown market
  const matchUnknown = matchPolymarketUrl(
    "https://polymarket.com/event/unknown-niche-market-12345",
    mockMarkets
  );
  assert.strictEqual(matchUnknown.matched, false);
  assert.strictEqual(matchUnknown.type, "NOT_FOUND");
  console.log("   ✔ Non-existent market correctly returns NOT_FOUND.");

  console.log("\n>>> ALL POLYMARKET URL PARSER & MATCHER TESTS PASSED! <<<\n");
}

runPolymarketUrlTests();
