import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { MarketTradeView } from "@/components/MarketTradeView";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

interface EventPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

export default async function PolymarketEventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const eventSlug = (slug || [])[0] || "";

  let market: any = null;
  let submarkets: any[] = [];
  let relatedMarkets: any[] = [];

  try {
    // 1. Fetch market by Event Slug or Market Slug
    const res = await fetch(
      `${COORDINATOR_URL}/api/markets/${encodeURIComponent(eventSlug)}`,
      {
        next: { revalidate: 10 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      market = data.market;
    }
  } catch {
    // Backend offline fallback
  }

  // 2. Fetch all sibling submarkets for this event
  const targetEventSlug = market?.event_slug || eventSlug;
  if (targetEventSlug && targetEventSlug !== "blitz-market") {
    try {
      const subRes = await fetch(
        `${COORDINATOR_URL}/api/markets?event_slug=${encodeURIComponent(
          targetEventSlug
        )}`,
        {
          next: { revalidate: 10 },
        }
      );
      if (subRes.ok) {
        const subData = await subRes.json();
        submarkets = subData.markets || [];
      }
    } catch {
      // Submarkets fetch fallback
    }
  }

  // 3. Fetch related markets in the same category
  if (market) {
    try {
      const cat = market.category || "Others";
      const relRes = await fetch(
        `${COORDINATOR_URL}/api/markets?category=${encodeURIComponent(cat)}`,
        {
          next: { revalidate: 30 },
        }
      );
      if (relRes.ok) {
        const relData = await relRes.json();
        const allInCat = relData.markets || [];
        relatedMarkets = allInCat
          .filter(
            (m: any) =>
              m.id !== market.id &&
              (!market.event_slug || m.event_slug !== market.event_slug)
          )
          .slice(0, 4);
      }
    } catch {
      // Related markets fallback
    }
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#0e0a08] border border-[#7c2d12]/40 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#1c120c] border border-[#7c2d12]/50 text-[#fb923c] flex items-center justify-center mx-auto mb-4 font-mono font-bold text-sm">
              404
            </div>
            <h1 className="text-xl font-heading font-bold text-[#fef3c7] mb-2">
              Event &ldquo;{eventSlug}&rdquo; Not Found
            </h1>
            <p className="text-xs font-mono text-[#fef3c7]/60 mb-6">
              This event may not be seeded yet or the coordinator service is synchronizing.
            </p>
            <Link
              href="/#markets"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-mono font-bold transition-colors"
            >
              ← Back to All Markets
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <MarketTradeView
          market={market}
          submarkets={submarkets}
          relatedMarkets={relatedMarkets}
        />
      </main>
      <Footer />
    </div>
  );
}
