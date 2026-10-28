import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import {
  parsePolymarketUrl,
  matchPolymarketUrl,
  type MarketSummary,
} from "@/lib/polymarket_url";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

interface TeleportPageProps {
  params: Promise<{
    polyUrl: string[];
  }>;
}

export default async function PolymarketTeleportPage({
  params,
}: TeleportPageProps) {
  const { polyUrl } = await params;
  const rawPath = (polyUrl || []).join("/");

  // 1. Direct Blitz route alias
  if (rawPath.toLowerCase().includes("blitz")) {
    redirect("/blitz");
  }

  // 2. Fetch pre-indexed active markets from Coordinator
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

  // 3. If matched to a single market, redirect directly to mirrored market view
  if (match.matched && match.type === "SINGLE_MARKET" && match.market) {
    if (match.market.event_slug && match.market.event_slug !== "blitz-market") {
      redirect(
        `/event/${encodeURIComponent(match.market.event_slug)}?sub=${encodeURIComponent(
          match.market.slug || match.market.id
        )}`
      );
    } else {
      redirect(`/market/${encodeURIComponent(match.market.id)}`);
    }
  }

  // 4. If matched to a multi-outcome event, redirect directly to mirrored event view
  if (
    match.matched &&
    match.type === "MULTI_MARKET" &&
    match.subMarkets &&
    match.subMarkets.length > 0
  ) {
    const targetSlug =
      match.parsed.eventSlug ||
      match.subMarkets[0].event_slug ||
      match.subMarkets[0].slug ||
      match.subMarkets[0].id;

    if (targetSlug) {
      if (match.parsed.marketSlug && match.parsed.isExplicitMarket) {
        redirect(
          `/event/${encodeURIComponent(targetSlug)}?sub=${encodeURIComponent(
            match.parsed.marketSlug
          )}`
        );
      } else {
        redirect(`/event/${encodeURIComponent(targetSlug)}`);
      }
    }
  }

  // 5. Coordinator fallback query if in-memory match was not found
  const targetQuery =
    match.parsed.eventSlug ||
    match.parsed.marketSlug ||
    match.parsed.sanitized;

  if (targetQuery) {
    // Try market query by ID or slug
    try {
      const res = await fetch(
        `${COORDINATOR_URL}/api/markets/${encodeURIComponent(targetQuery)}`,
        { next: { revalidate: 10 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.market) {
          if (data.market.event_slug && data.market.event_slug !== "blitz-market") {
            redirect(`/event/${encodeURIComponent(data.market.event_slug)}`);
          } else {
            redirect(`/market/${encodeURIComponent(data.market.id)}`);
          }
        }
      }
    } catch {}

    // Try event query by event_slug
    try {
      const eventRes = await fetch(
        `${COORDINATOR_URL}/api/markets?event_slug=${encodeURIComponent(targetQuery)}`,
        { next: { revalidate: 10 } }
      );
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        if (eventData.markets && eventData.markets.length > 0) {
          redirect(`/event/${encodeURIComponent(targetQuery)}`);
        }
      }
    } catch {}

    // Fuzzy matching against all markets
    if (markets.length > 0) {
      const clean = targetQuery.toLowerCase().replace(/[^a-z0-9]/g, "");
      const matched = markets.find((m) => {
        const mSlug = (m.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const mEvent = (m.event_slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const mMarket = (m.market_slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          mSlug === clean ||
          mEvent === clean ||
          mMarket === clean ||
          (mSlug && clean && (mSlug.includes(clean) || clean.includes(mSlug))) ||
          (mEvent && clean && (mEvent.includes(clean) || clean.includes(mEvent)))
        );
      });
      if (matched) {
        if (matched.event_slug && matched.event_slug !== "blitz-market") {
          redirect(`/event/${encodeURIComponent(matched.event_slug)}`);
        } else {
          redirect(`/market/${encodeURIComponent(matched.id)}`);
        }
      }
    }
  }

  // 6. Warm Ember Obsidian Fallback Not-Found Screen
  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl bg-[#0e0a08] border border-[#7c2d12]/40 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-[#1c120c] border border-[#7c2d12]/50 text-[#fb923c] flex items-center justify-center mx-auto mb-4 font-mono font-bold text-sm">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#431407]/60 border border-[#ea580c]/40 text-[#fb923c] text-xs font-mono mb-4">
            <span>Teleporter Query: &ldquo;{match.parsed.sanitized || rawPath}&rdquo;</span>
          </div>

          <h1 className="text-xl font-heading font-bold text-[#fef3c7] mb-2">
            Market Not in Pre-Indexed Active Pool
          </h1>
          <p className="text-xs font-mono text-[#fef3c7]/60 max-w-md mx-auto mb-6 leading-relaxed">
            To guarantee zero privacy leaks, Nocturne only matches against
            pre-indexed bulk pools without querying external Polymarket servers on-demand.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/#markets"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-mono font-bold transition-colors w-full sm:w-auto"
            >
              ← Explore All Shielded Markets
            </Link>
            <Link
              href="/blitz"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#1c120c] hover:bg-[#2a1c14] border border-[#7c2d12]/60 text-[#fb923c] text-xs font-mono font-bold transition-colors w-full sm:w-auto"
            >
              Try 10m Blitz Demo
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
