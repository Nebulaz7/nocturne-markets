import Link from "next/link";
import { ShieldUrlBar } from "../components/ShieldUrlBar";
import type { MarketSummary } from "@/lib/polymarket_url";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3001";

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
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Header / Nav */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-bold text-black text-lg">
              Z
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Nocturne Markets
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400">
              TESTNET v0.2
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="hidden sm:inline">Network: Zcash Testnet</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-12 w-full flex flex-col items-center">
        <div className="text-center max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-mono mb-4">
            <span>drand Quicknet + Dual-Envelope Shielded Pools</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3">
            Public Prices. <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Private People.</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Mirror real-world Polymarket events with shielded Zcash parimutuel pools. Zero-POST timelock encryption guarantees zero IP write leaks and game-theory safety.
          </p>
        </div>

        {/* Prominent "Shield a Polymarket Link" Teleporter Command Bar */}
        <section className="w-full mb-12">
          <ShieldUrlBar markets={markets} />
        </section>

        {/* Live Markets Grid */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Active Shielded Pools
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
                {markets.length} Markets
              </span>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Auto-refreshed from Polymarket Gamma API
            </span>
          </div>

          {markets.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-950 border border-zinc-900">
              <p className="text-zinc-400 text-sm">
                No active markets indexed yet. Coordinator service is starting up...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {markets.map((m: any) => {
                const isBlitz = m.id.startsWith("blitz-");
                return (
                  <Link
                    key={m.id}
                    href={`/market/${m.id}`}
                    className={`flex flex-col justify-between p-5 rounded-2xl bg-zinc-950 border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                      isBlitz
                        ? "border-amber-500/40 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                        : "border-zinc-800 hover:border-cyan-500/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        {isBlitz ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/40 font-semibold">
                            ⚡ 5-MIN BLITZ DEMO
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                            POLYMARKET MIRROR
                          </span>
                        )}
                        {m.ref_yes_price !== null && (
                          <span className="text-xs font-mono font-semibold text-zinc-300">
                            {(m.ref_yes_price * 100).toFixed(0)}¢ YES
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug mb-3">
                        {m.title}
                      </h3>
                    </div>

                    <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-xs font-mono text-zinc-400">
                      <span>
                        Pot:{" "}
                        <strong className="text-zinc-200">
                          {m.total_pot_zec ? m.total_pot_zec.toFixed(2) : "0.00"} ZEC
                        </strong>
                      </span>
                      <span className="text-cyan-400 font-medium">Trade Shielded →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Zero-POST Security Pillars */}
        <section className="w-full mt-16 pt-12 border-t border-zinc-900 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-900">
            <h4 className="text-sm font-bold text-white mb-1">Zero-POST Timelock</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No HTTP write calls. Bets are sealed to the drand Quicknet beacon and decrypted automatically by the network.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-900">
            <h4 className="text-sm font-bold text-white mb-1">Dual-Envelope Memos</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Timelock envelope is public for post-close audit; payout return address is boxed with NaCl to Coordinator only.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-zinc-950/60 border border-zinc-900">
            <h4 className="text-sm font-bold text-white mb-1">Fee on Profit Only</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              2% protocol fee is strictly taken from the losing pool. Winners always get 100% of their principal back.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs font-mono text-zinc-600">
        Nocturne Markets — ZECATHON Private Markets Track 2026
      </footer>
    </div>
  );
}
