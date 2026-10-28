"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketCard, { MarketCardSkeleton, type MarketItem } from "./MarketCard";
import {
  Search,
  SlidersHorizontal,
  Zap,
  RotateCcw,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

export type CategoryType =
  | "All"
  | "Politics"
  | "Crypto"
  | "Sports"
  | "Others"
  | "Blitz";
export type SortType = "trending" | "pot" | "odds-high" | "odds-low" | "ending";
export type StatusFilterType = "all" | "open" | "blitz";

const CATEGORIES: { label: string; value: CategoryType }[] = [
  { label: "All Markets", value: "All" },
  { label: "Politics", value: "Politics" },
  { label: "Crypto", value: "Crypto" },
  { label: "Sports", value: "Sports" },
  { label: "Others", value: "Others" },
  { label: "10m ZEC Blitz", value: "Blitz" },
];

interface MarketProps {
  initialMarkets?: MarketItem[];
}

function MarketContent({ initialMarkets = [] }: MarketProps) {
  const searchParams = useSearchParams();

  // State management
  const [markets, setMarkets] = useState<MarketItem[]>(initialMarkets);
  const [isLoading, setIsLoading] = useState(initialMarkets.length === 0);
  const [activeCategory, setActiveCategory] = useState<CategoryType>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [sortBy, setSortBy] = useState<SortType>("trending");
  const [displayCount, setDisplayCount] = useState(18);

  // Sync with URL query parameters (?cat=... or ?q=...)
  useEffect(() => {
    const catParam = searchParams.get("cat");
    const qParam = searchParams.get("q");

    if (catParam) {
      const lower = catParam.toLowerCase();
      if (lower === "blitz") setActiveCategory("Blitz");
      else if (lower === "crypto") setActiveCategory("Crypto");
      else if (lower === "politics") setActiveCategory("Politics");
      else if (lower === "sports") setActiveCategory("Sports");
      else if (lower === "others") setActiveCategory("Others");
      else setActiveCategory("All");
    }

    if (qParam) {
      setSearchQuery(qParam);
    }
  }, [searchParams]);

  // Sync initial markets if passed
  useEffect(() => {
    if (initialMarkets && initialMarkets.length > 0) {
      setMarkets(initialMarkets);
      setIsLoading(false);
    }
  }, [initialMarkets]);

  // Client-side fetch & periodic polling if initialMarkets is empty
  useEffect(() => {
    let mounted = true;
    const coordinatorUrl =
      process.env.NEXT_PUBLIC_COORDINATOR_URL ||
      process.env.COORDINATOR_URL ||
      "http://127.0.0.1:3000";

    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${coordinatorUrl}/api/markets`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted && Array.isArray(data.markets)) {
          setMarkets(data.markets);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    };

    if (markets.length === 0) {
      fetchMarkets();
    }

    const interval = setInterval(fetchMarkets, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter & Sort Pipeline
  const filteredMarkets = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    // 0. Exclude ended or settled markets from the markets list/grid
    let result = markets.filter((m) => {
      if (m.status === "SETTLED" || m.status === "CLOSED") return false;
      if (m.outcome !== null && m.outcome !== undefined) return false;
      if (m.close_time && m.close_time <= now) return false;
      return true;
    });

    // 1. Category Filter
    if (activeCategory === "Blitz") {
      result = result.filter(
        (m) =>
          m.id?.startsWith("blitz-") ||
          m.title?.toLowerCase().includes("blitz"),
      );
    } else if (activeCategory !== "All") {
      result = result.filter((m) => {
        if (!m.category) return false;
        return m.category.toLowerCase() === activeCategory.toLowerCase();
      });
    }

    // 2. Status Filter
    if (statusFilter === "open") {
      result = result.filter(
        (m) => !m.status || m.status.toUpperCase() === "OPEN",
      );
    } else if (statusFilter === "blitz") {
      result = result.filter((m) => m.id?.startsWith("blitz-"));
    }

    // 3. Search Query Filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((m) => {
        const title = (m.title || "").toLowerCase();
        const cat = (m.category || "").toLowerCase();
        const id = (m.id || "").toLowerCase();
        return (
          title.includes(query) || cat.includes(query) || id.includes(query)
        );
      });
    }

    // 4. Sorting
    result.sort((a, b) => {
      // Keep blitz markets towards the top for high-frequency demo visibility
      if (a.id?.startsWith("blitz-") && !b.id?.startsWith("blitz-")) return -1;
      if (!a.id?.startsWith("blitz-") && b.id?.startsWith("blitz-")) return 1;

      if (sortBy === "pot") {
        return (b.total_pot_zec ?? 0) - (a.total_pot_zec ?? 0);
      }
      if (sortBy === "odds-high") {
        return (b.ref_yes_price ?? 0.5) - (a.ref_yes_price ?? 0.5);
      }
      if (sortBy === "odds-low") {
        return (a.ref_yes_price ?? 0.5) - (b.ref_yes_price ?? 0.5);
      }
      if (sortBy === "ending") {
        return (a.close_time ?? Infinity) - (b.close_time ?? Infinity);
      }
      return 0; // default trending
    });

    return result;
  }, [markets, activeCategory, statusFilter, searchQuery, sortBy]);

  // Group non-blitz markets sharing the same event_slug into paired multi-outcome cards
  const groupedCards = useMemo(() => {
    const eventGroups = new Map<string, MarketItem[]>();

    // Step 1: Bucket by event_slug
    for (const m of filteredMarkets) {
      const isBlitz =
        m.id?.startsWith("blitz-") || m.slug?.startsWith("blitz-");
      if (!isBlitz && m.event_slug && m.event_slug !== "blitz-market") {
        const list = eventGroups.get(m.event_slug) || [];
        list.push(m);
        eventGroups.set(m.event_slug, list);
      }
    }

    // Step 2: Build card sequence preserving ranking order
    const processedEvents = new Set<string>();
    const result: { primary: MarketItem; submarkets?: MarketItem[] }[] = [];

    for (const m of filteredMarkets) {
      const isBlitz =
        m.id?.startsWith("blitz-") || m.slug?.startsWith("blitz-");
      if (isBlitz) {
        result.push({ primary: m });
        continue;
      }

      if (m.event_slug && m.event_slug !== "blitz-market") {
        if (processedEvents.has(m.event_slug)) continue;
        processedEvents.add(m.event_slug);

        const submarkets = eventGroups.get(m.event_slug) || [m];
        if (submarkets.length > 1) {
          result.push({
            primary: submarkets[0],
            submarkets,
          });
        } else {
          result.push({ primary: m });
        }
      } else {
        result.push({ primary: m });
      }
    }

    return result;
  }, [filteredMarkets]);

  // Sliced cards for pagination / view more
  const visibleCards = useMemo(() => {
    return groupedCards.slice(0, displayCount);
  }, [groupedCards, displayCount]);

  const hasMore = displayCount < groupedCards.length;

  // Category counts (counting active non-ended, non-settled markets only)
  const categoryCounts = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const activeMarkets = markets.filter((m) => {
      if (m.status === "SETTLED" || m.status === "CLOSED") return false;
      if (m.outcome !== null && m.outcome !== undefined) return false;
      if (m.close_time && m.close_time <= now) return false;
      return true;
    });

    const counts: Record<string, number> = {
      All: activeMarkets.length,
      Politics: 0,
      Crypto: 0,
      Sports: 0,
      Others: 0,
      Blitz: 0,
    };

    activeMarkets.forEach((m) => {
      if (m.id?.startsWith("blitz-")) counts.Blitz++;
      const cat = m.category || "Others";
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });

    return counts;
  }, [markets]);

  const resetFilters = () => {
    setActiveCategory("All");
    setSearchQuery("");
    setStatusFilter("all");
    setSortBy("trending");
  };

  return (
    <section
      id="markets"
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2 sm:mb-2">
        {/* <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#140e0b] text-[#fb923c] border border-[#7c2d12]/50 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#fb923c]" />
            <span>Shielded Parimutuel Pools</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-[#fef3c7] tracking-tight">
            Active Prediction Markets
          </h2>
          <p className="text-xs sm:text-sm text-[#fef3c7]/65 font-sans mt-1">
            Mirroring Polymarket outcomes on private Zcash. Zero IP write leaks and confidential payouts.
          </p>
        </div> */}

        {/* Global Markets Counter Tag */}
        {/* <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs text-[#fef3c7]/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {isLoading
              ? "Syncing..."
              : `${filteredMarkets.length.toLocaleString()} Markets Available`}
          </span>
        </div> */}
      </div>

      {/* Control Bar: Categories & Search Filters */}
      <div className="flex flex-col gap-4 mb-8">
        {/* 1. Category Tabs Pill Bar (Horizontal swipe on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            const count = categoryCounts[cat.value] ?? 0;
            const isBlitzCat = cat.value === "Blitz";

            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.value);
                  setDisplayCount(18);
                }}
                className={`relative px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all duration-200 shrink-0 flex items-center gap-2 cursor-pointer select-none ${
                  isActive
                    ? "bg-[#fb923c] text-[#431407] shadow-[0_2px_15px_rgba(251,146,60,0.3)]"
                    : isBlitzCat
                      ? "bg-[#1c0f0a] text-[#fb923c] border border-[#ea580c]/50"
                      : "bg-[#140e0b] text-[#fef3c7]/75 hover:text-[#fef3c7]"
                }`}
              >
                {isBlitzCat && (
                  <Zap
                    className={`w-3 h-3 ${isActive ? "text-[#431407]" : "text-[#fb923c]"}`}
                  />
                )}
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive
                        ? "bg-[#431407] text-[#fb923c]"
                        : "bg-[#24150f] text-[#fef3c7]/60 border border-[#7c2d12]/40"
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 2. Search, Status, and Sort Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-2xl bg-[#120d0a]/90 border border-[#7c2d12]/35">
          {/* Search Input */}
          <div className="sm:col-span-6 lg:col-span-7 relative flex items-center">
            <Search className="w-4 h-4 text-[#fef3c7]/40 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayCount(18);
              }}
              placeholder="Search markets by title, topic, or keyword..."
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 text-xs sm:text-sm text-[#fef3c7] placeholder-[#fef3c7]/40 outline-none focus:border-[#fb923c] focus:ring-1 focus:ring-[#fb923c]/40 font-sans transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 text-xs text-[#fef3c7]/40 hover:text-[#fef3c7] px-1 font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="sm:col-span-3 lg:col-span-3">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilterType);
                  setDisplayCount(18);
                }}
                className="w-full appearance-none px-3.5 py-2 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7] outline-none focus:border-[#fb923c] cursor-pointer"
              >
                <option value="all">Status: All Active</option>
                <option value="open">Status: Live Pools</option>
                <option value="blitz">Status: 5m Blitz Only</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#fef3c7]/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="sm:col-span-3 lg:col-span-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="w-full appearance-none px-3.5 py-2 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7] outline-none focus:border-[#fb923c] cursor-pointer"
              >
                <option value="trending">Sort: Trending</option>
                <option value="pot">Sort: Highest Pot</option>
                <option value="odds-high">Sort: Highest YES</option>
                <option value="odds-low">Sort: Lowest YES</option>
                <option value="ending">Sort: Ending Soon</option>
              </select>
              <TrendingUp className="w-3.5 h-3.5 text-[#fef3c7]/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Markets Grid Section */}
      {isLoading ? (
        // Skeleton Loaders
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      ) : visibleCards.length === 0 ? (
        // Empty State
        <div className="text-center py-16 px-4 rounded-3xl bg-[#120d0a]/60 border border-[#7c2d12]/30 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#1e130e] border border-[#7c2d12]/50 flex items-center justify-center text-[#fb923c] mb-3">
            <Search className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-heading font-bold text-[#fef3c7] mb-1">
            No Markets Found
          </h3>
          <p className="text-xs text-[#fef3c7]/60 max-w-sm mb-5 font-sans">
            No active prediction pools match your current filters or search
            query. Try broadening your criteria.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="btn-monad-base btn-ember px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <>
          {/* Real Interactive Market Cards Grid (Single & Grouped Events) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {visibleCards.map(({ primary, submarkets }) => (
              <MarketCard
                key={
                  submarkets && submarkets.length > 1
                    ? `event-${primary.event_slug}`
                    : primary.id
                }
                market={primary}
                submarkets={submarkets}
              />
            ))}
          </div>

          {/* Load More Pagination Trigger */}
          {hasMore && (
            <div className="mt-10 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayCount((prev) => prev + 18)}
                className="btn-monad-base btn-void px-6 py-2.5 text-xs font-mono font-bold text-[#fef3c7] border border-[#7c2d12]/50 hover:border-[#fb923c] hover:text-[#fb923c] shadow-lg cursor-pointer transition-all"
              >
                <span>Show More</span>
              </button>
              <span className="text-[11px] font-mono text-[#fef3c7]/40">
                Displaying {visibleCards.length} of {groupedCards.length} events
                &amp; pools
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Market({ initialMarkets = [] }: MarketProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <MarketCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <MarketContent initialMarkets={initialMarkets} />
    </Suspense>
  );
}
