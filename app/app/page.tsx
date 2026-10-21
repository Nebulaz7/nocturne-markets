import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Market from "./components/Market";
import type { MarketSummary } from "@/lib/polymarket_url";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

async function getMarkets(): Promise<MarketSummary[]> {
  try {
    const res = await fetch(`${COORDINATOR_URL}/api/markets`, {
      next: { revalidate: 15 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.markets || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const markets = await getMarkets();

  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Hero initialMarkets={markets} />
        <Market initialMarkets={markets} />
      </main>

      {/* Protocol Security Pillars */}
      {/* <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[#7c2d12]/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30">
            <h4 className="text-sm font-heading font-bold text-[#fef3c7] mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#fb923c]" />
              Zero-POST Timelock
            </h4>
            <p className="text-xs text-[#fef3c7]/65 leading-relaxed font-sans">
              No HTTP write calls. Bets are sealed to the drand Quicknet beacon and decrypted automatically by the network upon round publish.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30">
            <h4 className="text-sm font-heading font-bold text-[#fef3c7] mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ea580c]" />
              Dual-Envelope Memos
            </h4>
            <p className="text-xs text-[#fef3c7]/65 leading-relaxed font-sans">
              Timelock envelope is public for post-close Merkle audit; payout return address is boxed with TweetNaCl to the Coordinator only.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30">
            <h4 className="text-sm font-heading font-bold text-[#fef3c7] mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#fed7aa]" />
              Fee on Profit Only
            </h4>
            <p className="text-xs text-[#fef3c7]/65 leading-relaxed font-sans">
              2% protocol fee is strictly taken from the losing pool. Winners always get 100% of their principal back with zero dust loss.
            </p>
          </div>
        </div>
      </section> */}
    </div>
  );
}
