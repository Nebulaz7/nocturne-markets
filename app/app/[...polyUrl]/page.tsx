import { redirect } from "next/navigation";
import Link from "next/link";
import {
  parsePolymarketUrl,
  matchPolymarketUrl,
  type MarketSummary,
} from "@/lib/polymarket_url";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3001";

interface TeleportPageProps {
  params: Promise<{
    polyUrl: string[];
  }>;
}

export default async function PolymarketTeleportPage({ params }: TeleportPageProps) {
  const { polyUrl } = await params;
  const rawPath = (polyUrl || []).join("/");

  // Fetch pre-indexed active markets from Coordinator
  let markets: MarketSummary[] = [];
  try {
    const res = await fetch(`${COORDINATOR_URL}/api/markets`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      markets = data.markets || [];
    }
  } catch {
    // If backend offline, fall back to empty list
  }

  const match = matchPolymarketUrl(rawPath, markets);

  // If matched to a single market, teleport directly!
  if (match.matched && match.type === "SINGLE_MARKET" && match.market) {
    redirect(`/market/${match.market.id}`);
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Nocturne Markets Teleporter
            </h1>
            <p className="text-xs font-mono text-zinc-400">
              Resolved: &ldquo;{match.parsed.sanitized || rawPath}&rdquo;
            </p>
          </div>
        </div>

        {/* Multi-bracket event picker */}
        {match.matched && match.type === "MULTI_MARKET" && match.subMarkets && (
          <div>
            <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-950/50 border border-emerald-500/30 rounded-lg w-fit">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-mono text-emerald-300">
                Zero-Leak Match Found ({match.subMarkets.length} binary outcome brackets)
              </span>
            </div>

            <p className="text-sm text-zinc-300 mb-4">
              Select which specific binary outcome bracket you want to trade with shielded ZEC:
            </p>

            <div className="grid grid-cols-1 gap-2.5 max-h-96 overflow-y-auto">
              {match.subMarkets.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/market/${sub.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-cyan-500/60 hover:bg-zinc-800/50 transition-all group"
                >
                  <div className="flex-1 pr-4">
                    <span className="text-sm font-semibold text-zinc-200 group-hover:text-cyan-300 transition-colors">
                      {sub.group_item_title || sub.title}
                    </span>
                  </div>
                  {typeof sub.ref_yes_price === "number" && (
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-300 shrink-0">
                      {(sub.ref_yes_price * 100).toFixed(0)}¢ YES
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Not Found Screen */}
        {(!match.matched || match.type === "NOT_FOUND") && (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-1">
              Market Not in Pre-Indexed Active Pool
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
              To guarantee zero privacy leaks, Nocturne only matches against pre-indexed bulk pools without querying Polymarket on-demand.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm rounded-xl transition-colors"
            >
              <span>Explore All Shielded Markets</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
