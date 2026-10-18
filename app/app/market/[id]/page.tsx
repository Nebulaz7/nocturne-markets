import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketTradeView } from "@/components/MarketTradeView";

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
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-start py-12 px-4 font-sans selection:bg-cyan-500 selection:text-black">
      <MarketTradeView market={market} />
    </div>
  );
}
