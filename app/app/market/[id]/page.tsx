import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

interface MarketPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MarketDetailPage({ params }: MarketPageProps) {
  const { id } = await params;

  let market: any = null;
  try {
    const res = await fetch(
      `${COORDINATOR_URL}/api/markets/${encodeURIComponent(id)}`,
      {
        next: { revalidate: 10 },
      },
    );
    if (res.ok) {
      const data = await res.json();
      market = data.market;
    }
  } catch {
    // Backend offline fallback
  }

  if (!market) {
    // If not found in backend, render minimal fallback or notFound()
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">
            Market &ldquo;{id}&rdquo; Not Found
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            This market may not be seeded yet or the coordinator service is
            starting up.
          </p>
          <Link
            href="/"
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-xl"
          >
            ← Back to All Markets
          </Link>
        </div>
      </div>
    );
  }

  const closeDateStr = new Date(market.close_time * 1000).toLocaleString();

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-start py-12 px-4 font-sans">
      <div className="w-full max-w-3xl">
        {/* Navigation bar */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Markets</span>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>SHIELDED POOL {market.status}</span>
          </div>
        </div>

        {/* Market Card */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              ID: {market.id}
            </span>
            {market.ref_yes_price !== null && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Polymarket Ref: {(market.ref_yes_price * 100).toFixed(1)}¢ YES
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight mb-4">
            {market.title}
          </h1>

          {/* Pot Metrics */}
          <div className="grid grid-cols-3 gap-3 my-6">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
              <span className="text-xs font-mono text-zinc-500 block mb-1">
                TOTAL POT
              </span>
              <span className="text-lg md:text-xl font-bold font-mono text-white">
                {market.total_pot_zec.toFixed(4)}{" "}
                <span className="text-xs text-zinc-400 font-normal">ZEC</span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-xs font-mono text-emerald-400 block mb-1">
                YES POT
              </span>
              <span className="text-lg md:text-xl font-bold font-mono text-emerald-300">
                {market.yes_pot_zec.toFixed(4)}{" "}
                <span className="text-xs text-emerald-500 font-normal">
                  ZEC
                </span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/20">
              <span className="text-xs font-mono text-rose-400 block mb-1">
                NO POT
              </span>
              <span className="text-lg md:text-xl font-bold font-mono text-rose-300">
                {market.no_pot_zec.toFixed(4)}{" "}
                <span className="text-xs text-rose-500 font-normal">ZEC</span>
              </span>
            </div>
          </div>

          {/* Settlement Details */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>Closing Time:</span>
              <span className="text-zinc-200">{closeDateStr}</span>
            </div>
            <div className="flex justify-between">
              <span>drand Quicknet Round:</span>
              <span className="text-zinc-200">#{market.drand_round}</span>
            </div>
            <div className="flex justify-between">
              <span>Settlement Key:</span>
              <span className="text-zinc-400 truncate max-w-[200px]">
                {market.coordinator_public_key?.slice(0, 16)}...
              </span>
            </div>
          </div>
        </div>

        {/* Zero-POST Bet Placement Callout */}
        <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-cyan-500/20 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto mb-3">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">
            Zero-POST Shielded Bet Slip
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4">
            Scan with Zashi or YWallet. Bets are sealed with timelock encryption
            and return addresses are boxed directly to the Coordinator. Zero
            HTTP write calls required.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 font-mono text-xs text-zinc-300">
            <span>Pot Address:</span>
            <span className="text-cyan-400 truncate max-w-[240px] sm:max-w-[360px]">
              {market.pot_address}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
