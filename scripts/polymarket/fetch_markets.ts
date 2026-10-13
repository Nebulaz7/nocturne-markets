export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  outcomes: string[]; // ["Yes", "No"]
  outcomePrices: string[]; // ["0.55", "0.45"]
  volume: string;
  liquidity: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  slug: string;
  startDate: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  markets: PolymarketMarket[];
}

export async function fetchActivePolymarketEvents(limit: number = 5): Promise<PolymarketEvent[]> {
  const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&archived=false`;
  console.log(`Fetching active markets from Polymarket Gamma API: ${url}`);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "NocturneMarkets/0.1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Polymarket API request failed with status ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as PolymarketEvent[];
  return data;
}

if (process.argv[1]?.endsWith("fetch_markets.ts")) {
  async function main() {
    console.log("=== Testing Polymarket Gamma API Sync ===\n");
    const events = await fetchActivePolymarketEvents(3);

    console.log(`Retrieved ${events.length} active events:\n`);
    for (const ev of events) {
      console.log(`Event: ${ev.title}`);
      console.log(`  ID:       ${ev.id}`);
      console.log(`  End Date: ${ev.endDate}`);
      console.log(`  Markets:  ${ev.markets?.length || 0}`);

      if (ev.markets && ev.markets.length > 0) {
        const m = ev.markets[0];
        console.log(`  Sample Market: ${m.question}`);
        console.log(`    Condition ID:   ${m.conditionId}`);
        console.log(`    Outcomes:       ${JSON.stringify(m.outcomes)}`);
        console.log(`    Outcome Prices: ${JSON.stringify(m.outcomePrices)}`);
        console.log(`    Volume:         $${m.volume}`);
      }
      console.log("---------------------------------------------------------");
    }
  }

  main().catch((err) => {
    console.error("Polymarket fetch failed:", err.message);
  });
}
