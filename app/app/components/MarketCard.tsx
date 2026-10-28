"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Zap, Clock } from "lucide-react";
import MarketAvatar from "../../components/MarketAvatar";
import { useNetwork } from "@/context/NetworkContext";

export interface MarketItem {
  id: string;
  title: string;
  category?: string | null;
  ref_yes_price?: number | null;
  total_pot_zec?: number;
  total_pot_zats?: number;
  close_time?: number;
  drand_round?: number | string;
  status?: string;
  outcome?: string | null;
  pot_address?: string;
  event_slug?: string | null;
  group_item_title?: string | null;
  question?: string | null;
  slug?: string | null;
  image?: string | null;
  icon?: string | null;
}

interface MarketCardProps {
  market: MarketItem;
  submarkets?: MarketItem[];
}

// Clean event question/title for paired multi-outcome events
function cleanEventTitle(title: string, question?: string | null): string {
  if (question && question.trim().length > 0 && !question.startsWith("Will ")) {
    return question.replace(/\s*-\s*More Markets$/i, "").trim();
  }
  const colonIdx = title.indexOf(": ");
  if (colonIdx > 0) {
    return title
      .slice(0, colonIdx)
      .replace(/\s*-\s*More Markets$/i, "")
      .trim();
  }
  return title.replace(/\s*-\s*More Markets$/i, "").trim();
}

// Extract concise option/outcome name from submarket record
function cleanOutcomeName(item: MarketItem): string {
  if (item.group_item_title && item.group_item_title.trim().length > 0) {
    return item.group_item_title.replace(/\s*\(.*\)$/, "").trim();
  }
  const colonIdx = item.title.indexOf(": ");
  if (colonIdx > 0) {
    return item.title
      .slice(colonIdx + 2)
      .replace(/\s*\(.*\)$/, "")
      .trim();
  }
  return item.title.replace(/\s*\(.*\)$/, "").trim();
}

// Extract a 2-character avatar initials/tag for the event badge
function getEventBadge(title: string, category?: string | null): string {
  const words = title.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (category) {
    return category.slice(0, 2).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase();
}

export default function MarketCard({ market, submarkets }: MarketCardProps) {
  const router = useRouter();
  const { currency } = useNetwork();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const isMultiOutcome = Boolean(submarkets && submarkets.length > 1);
  const isBlitz =
    market.id?.startsWith("blitz-") ||
    market.slug?.startsWith("blitz-") ||
    market.title?.toLowerCase().includes("blitz");

  // Format close time or drand round
  const formatTimeRemaining = (closeTime?: number) => {
    if (!closeTime) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = closeTime - now;
    if (diff <= 0) return "Ended";
    if (diff < 3600) return `${Math.ceil(diff / 60)}m left`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
    return `${Math.floor(diff / 86400)}d left`;
  };

  const timeRemaining = formatTimeRemaining(market.close_time);

  // Single-market probability metrics
  const rawPrice =
    market.ref_yes_price !== null && market.ref_yes_price !== undefined
      ? market.ref_yes_price
      : 0.5;

  const yesPercent = Math.max(1, Math.min(99, Math.round(rawPrice * 100)));
  const potZec = market.total_pot_zec ?? 0;

  // Single-market arc gauge calculations (semi-circle from 180deg to 0deg)
  const rad = (yesPercent / 100) * Math.PI;
  const dotX = Number((34 - 26 * Math.cos(rad)).toFixed(2));
  const dotY = Number((34 - 26 * Math.sin(rad)).toFixed(2));
  const gaugeColor = yesPercent >= 50 ? "#22c55e" : "#ef4444";

  const triggerLoader = () => {
    setIsNavigating(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nocturne-route-start"));
    }
  };

  const handleCardClick = (targetId?: string) => {
    triggerLoader();
    if (isBlitz) {
      router.push("/blitz");
    } else if (isMultiOutcome && market.event_slug && market.event_slug !== "blitz-market") {
      const query = targetId ? `?sub=${targetId}` : "";
      router.push(`/event/${market.event_slug}${query}`);
    } else {
      router.push(`/market/${targetId || market.slug || market.id}`);
    }
  };

  const handleTradeYes = (e: React.MouseEvent, targetId?: string) => {
    e.stopPropagation();
    triggerLoader();
    if (isBlitz) {
      router.push("/blitz?side=YES");
    } else if (isMultiOutcome && market.event_slug && market.event_slug !== "blitz-market") {
      router.push(`/event/${market.event_slug}?side=YES&sub=${targetId || market.id}`);
    } else {
      router.push(`/market/${targetId || market.slug || market.id}?side=YES`);
    }
  };

  const handleTradeNo = (e: React.MouseEvent, targetId?: string) => {
    e.stopPropagation();
    triggerLoader();
    if (isBlitz) {
      router.push("/blitz?side=NO");
    } else if (isMultiOutcome && market.event_slug && market.event_slug !== "blitz-market") {
      router.push(`/event/${market.event_slug}?side=NO&sub=${targetId || market.id}`);
    } else {
      router.push(`/market/${targetId || market.slug || market.id}?side=NO`);
    }
  };

  // ========================================================
  // RENDER 1: Multi-Outcome Paired Event Card (e.g. Anthropic IPO by __?)
  // ========================================================
  if (isMultiOutcome && submarkets) {
    const eventTitle = cleanEventTitle(market.title, market.question);
    const badge = getEventBadge(eventTitle, market.category);

    // Sort submarkets by probability / volume descending
    const sortedSubmarkets = [...submarkets].sort((a, b) => {
      const priceA = a.ref_yes_price ?? 0.5;
      const priceB = b.ref_yes_price ?? 0.5;
      return priceB - priceA;
    });

    const displaySubmarkets = isExpanded
      ? sortedSubmarkets
      : sortedSubmarkets.slice(0, 3);
    const hasMore = sortedSubmarkets.length > 3;

    const combinedPotZec = submarkets.reduce(
      (sum, s) => sum + (s.total_pot_zec ?? 0),
      0,
    );

    return (
      <div
        ref={cardRef}
        onClick={() => handleCardClick(sortedSubmarkets[0].id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(sortedSubmarkets[0].id);
          }
        }}
        role="article"
        tabIndex={0}
        className="group relative flex flex-col justify-between p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 hover:border-[#fb923c]/60 transition-all duration-300 overflow-hidden cursor-pointer"
      >
        <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" />

        {/* Top Header: Category & Status */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3 z-10 relative">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#160f0c] text-[#fef3c7]/70 border border-[#7c2d12]/40">
                {market.category || "General"}
              </span>

              {timeRemaining && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#fef3c7]/50 px-1.5 py-0.5">
                  <Clock className="w-2.5 h-2.5 text-[#fef3c7]/40" />
                  <span>{timeRemaining}</span>
                </span>
              )}
            </div>

            <div className="text-[10px] font-mono shrink-0">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">LIVE</span>
              </span>
            </div>
          </div>

          {/* Event Title with Icon Badge (matching Polymarket / Kalshi multi-card) */}
          <div className="flex items-start gap-3 mb-3.5 z-10 relative">
            <MarketAvatar
              src={isBlitz ? "/zcash.svg" : (market.icon || market.image)}
              title={eventTitle}
              category={market.category}
              size="md"
            />
            <h3 className="text-sm sm:text-base font-heading font-semibold text-[#fef3c7] line-clamp-2 leading-snug group-hover:text-[#fed7aa] transition-colors flex-1 pt-0.5">
              {eventTitle}
            </h3>
          </div>
        </div>

        {/* Outcome Rows matching the user's screenshot */}
        <div className="space-y-2 my-2.5 z-10 relative">
          {displaySubmarkets.map((sm) => {
            const rawSmPrice =
              sm.ref_yes_price !== null && sm.ref_yes_price !== undefined
                ? sm.ref_yes_price
                : 0.5;
            const smYesPercent = Math.max(
              1,
              Math.min(99, Math.round(rawSmPrice * 100)),
            );
            const outcomeName = cleanOutcomeName(sm);

            return (
              <div
                key={sm.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(sm.id);
                }}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-[#140e0b]/90 hover:bg-[#1a120e] border border-[#7c2d12]/30 hover:border-[#fb923c]/40 transition-all cursor-pointer group/row"
              >
                {/* Outcome Title */}
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  {(sm.icon || sm.image || isBlitz) && (
                    <MarketAvatar
                      src={isBlitz ? "/zcash.svg" : (sm.icon || sm.image)}
                      title={outcomeName}
                      category={market.category}
                      size="sm"
                    />
                  )}
                  <span className="text-xs sm:text-sm font-sans font-medium text-[#fef3c7]/90 truncate group-hover/row:text-[#fef3c7]">
                    {outcomeName}
                  </span>
                </div>

                {/* Probability % */}
                <span className="text-xs sm:text-sm font-bold font-mono text-[#fef3c7] shrink-0 min-w-[36px] text-right">
                  {smYesPercent}%
                </span>

                {/* Yes & No Trade Buttons (Solid flat green & red, no glow, shadow, or gradient) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleTradeYes(e, sm.id)}
                    className="py-1 px-3 rounded-lg bg-[#12281c] hover:bg-[#183525] active:bg-[#0d1e15] text-[#22c55e] font-sans font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleTradeNo(e, sm.id)}
                    className="py-1 px-3 rounded-lg bg-[#361212] hover:bg-[#461717] active:bg-[#290d0d] text-[#f87171] font-sans font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
                  >
                    No
                  </button>
                </div>
              </div>
            );
          })}

          {/* Expand / Collapse Toggle for Events with > 3 outcomes */}
          {hasMore && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="w-full text-center py-1 text-[11px] font-mono text-[#fb923c]/80 hover:text-[#fb923c] hover:underline transition-colors cursor-pointer"
            >
              {isExpanded
                ? "Show fewer outcomes"
                : `+${sortedSubmarkets.length - 3} more outcomes`}
            </button>
          )}
        </div>

        {/* Bottom Section: Combined Parimutuel Pool */}
        <div className="pt-3 border-t border-[#7c2d12]/25 flex items-center justify-between text-xs font-mono text-[#fef3c7]/60 z-10 relative">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#fb923c]/70 shrink-0" />
            <span>
              Pot:{" "}
              <strong className="text-[#fef3c7] font-bold">
                {combinedPotZec > 0 ? combinedPotZec.toFixed(2) : "0.00"} {currency}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-[#fef3c7]/40">
            {submarkets.length} Outcomes · Parimutuel
          </span>
        </div>

        {isNavigating && (
          <div className="absolute inset-0 bg-[#0e0a08]/85 backdrop-blur-[2px] rounded-2xl z-30 flex flex-col items-center justify-center gap-2.5 transition-all">
            <div className="w-6 h-6 border-2 border-[#fb923c] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-[#fb923c] font-semibold tracking-wide">
              Loading Market...
            </span>
          </div>
        )}
      </div>
    );
  }

  // ========================================================
  // RENDER 2: Single-Outcome Binary Market Card (with Arc Gauge)
  // ========================================================
  return (
    <div
      ref={cardRef}
      onClick={() => handleCardClick()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="article"
      tabIndex={0}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-[#0e0a08] border transition-all duration-300 overflow-hidden cursor-pointer ${
        isBlitz
          ? "border-[#ea580c]/50 hover:border-[#fb923c]"
          : "border-[#7c2d12]/35 hover:border-[#fb923c]/60"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" />

      {/* Top Header: Category / Blitz Tag + Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 z-10 relative">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isBlitz ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#431407] text-[#fb923c] border border-[#ea580c]/60">
                  <Zap className="w-2.5 h-2.5 text-[#fb923c]" />
                  <span>10M {currency} BLITZ</span>
                </span>
                <span className="inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#12281c] text-[#22c55e] border border-[#22c55e]/30">
                  1.52x
                </span>
                <span className="inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#431407] text-[#fb923c] border border-[#ea580c]/50 uppercase">
                  DEMO
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#160f0c] text-[#fef3c7]/70 border border-[#7c2d12]/40">
                {market.category || "General"}
              </span>
            )}

            {timeRemaining && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#fef3c7]/50 px-1.5 py-0.5">
                <Clock className="w-2.5 h-2.5 text-[#fef3c7]/40" />
                <span>{timeRemaining}</span>
              </span>
            )}
          </div>

          {/* Status Badge */}
          <div className="text-[10px] font-mono shrink-0">
            {market.status === "SETTLED" ? (
              <span className="px-1.5 py-0.5 rounded bg-[#201510] text-[#fef3c7]/60 border border-[#7c2d12]/40">
                SETTLED
              </span>
            ) : market.status === "CLOSED" ? (
              <span className="px-1.5 py-0.5 rounded bg-[#201510] text-amber-400 border border-amber-900/40">
                RESOLVING
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">LIVE</span>
              </span>
            )}
          </div>
        </div>

        {/* Market Title & Semi-Circular Chance Gauge */}
        <div className="flex items-start justify-between gap-3 mb-4 z-10 relative">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <MarketAvatar
              src={isBlitz ? "/zcash.svg" : (market.icon || market.image)}
              title={market.title}
              category={market.category}
              size="md"
            />
            <h3 className="text-sm sm:text-base font-heading font-semibold text-[#fef3c7] line-clamp-2 leading-snug group-hover:text-[#fed7aa] transition-colors flex-1 pt-0.5">
              {market.title}
            </h3>
          </div>

          {/* Arc Gauge for Probability */}
          <div className="relative shrink-0 w-[68px] h-[46px] flex items-center justify-center select-none pt-1">
            <svg
              viewBox="0 0 68 46"
              className="w-[68px] h-[46px] overflow-visible"
            >
              <path
                d="M 8 34 A 26 26 0 0 1 60 34"
                fill="none"
                stroke="#2a1d17"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M 8 34 A 26 26 0 0 1 60 34"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="81.68"
                strokeDashoffset={81.68 * (1 - yesPercent / 100)}
                className="transition-all duration-500"
              />
              <circle
                cx={dotX}
                cy={dotY}
                r="2.5"
                fill={gaugeColor}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xs sm:text-sm font-bold text-[#fef3c7] leading-none">
                {yesPercent}%
              </span>
              <span className="text-[9px] text-[#fef3c7]/50 font-medium leading-none mt-0.5">
                chance
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Shielded Pot & Trade YES / NO Buttons */}
      <div className="pt-3 border-t border-[#7c2d12]/25 space-y-3 z-10 relative">
        <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/60">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#fb923c]/70 shrink-0" />
            <span>
              {isBlitz ? (
                <>
                  Payout: <strong className="text-[#22c55e] font-bold">1.52x Fixed</strong>
                </>
              ) : (
                <>
                  Pot:{" "}
                  <strong className="text-[#fef3c7] font-bold">
                    {potZec > 0 ? potZec.toFixed(2) : "0.00"} {currency}
                  </strong>
                </>
              )}
            </span>
          </div>
          <span className="text-[11px] text-[#fef3c7]/40">
            {isBlitz ? "Resolves YES · Demo" : "Parimutuel Pool"}
          </span>
        </div>

        {/* Action Trade YES / NO Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={(e) => handleTradeYes(e)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#12281c] hover:bg-[#183525] active:bg-[#0d1e15] text-[#22c55e] font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
          >
            {isBlitz ? "Up (Yes)" : "Yes"}
          </button>

          <button
            type="button"
            onClick={(e) => handleTradeNo(e)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#361212] hover:bg-[#461717] active:bg-[#290d0d] text-[#f87171] font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
          >
            {isBlitz ? "Down (No)" : "No"}
          </button>
        </div>
      </div>

      {isNavigating && (
        <div className="absolute inset-0 bg-[#0e0a08]/85 backdrop-blur-[2px] rounded-2xl z-30 flex flex-col items-center justify-center gap-2.5 transition-all">
          <div className="w-6 h-6 border-2 border-[#fb923c] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-[#fb923c] font-semibold tracking-wide">
            Loading Market...
          </span>
        </div>
      )}
    </div>
  );
}

// Shimmer Skeleton Loader matching Nocturne Obsidian/Ember Design
export function MarketCardSkeleton() {
  return (
    <div className="relative flex flex-col justify-between p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/25 overflow-hidden animate-pulse min-h-[200px]">
      {/* Top Header skeleton */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-20 rounded bg-[#1f1510]" />
          <div className="h-4 w-12 rounded bg-[#1f1510]" />
        </div>

        {/* Title + Gauge skeleton */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-full rounded bg-[#261711]" />
            <div className="h-4 w-3/4 rounded bg-[#261711]" />
          </div>
          <div className="w-[60px] h-[40px] rounded-lg bg-[#1f1510] shrink-0" />
        </div>
      </div>

      {/* Footer skeleton with two buttons */}
      <div className="pt-3 border-t border-[#7c2d12]/20 space-y-3">
        <div className="h-3.5 w-24 rounded bg-[#1f1510]" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-10 rounded-xl bg-[#1f1510]" />
          <div className="h-10 rounded-xl bg-[#1f1510]" />
        </div>
      </div>
    </div>
  );
}
