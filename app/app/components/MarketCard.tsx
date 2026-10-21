"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Shield, Zap, Clock } from "lucide-react";

export interface MarketItem {
  id: string;
  title: string;
  category?: string;
  ref_yes_price?: number | null;
  total_pot_zec?: number;
  total_pot_zats?: number;
  close_time?: number;
  drand_round?: number | string;
  status?: string;
  outcome?: string | null;
  pot_address?: string;
}

interface MarketCardProps {
  market: MarketItem;
}

// React Bits Spotlight Card effect with Nocturne Obsidian/Ember specular lighting
export default function MarketCard({ market }: MarketCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const isBlitz = market.id?.startsWith("blitz-");
  const rawPrice =
    market.ref_yes_price !== null && market.ref_yes_price !== undefined
      ? market.ref_yes_price
      : 0.5;

  const yesPercent = Math.max(1, Math.min(99, Math.round(rawPrice * 100)));
  const noPercent = 100 - yesPercent;
  const potZec = market.total_pot_zec ?? 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Format close time or drand round
  const formatTimeRemaining = () => {
    if (!market.close_time) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = market.close_time - now;
    if (diff <= 0) return "Ended";
    if (diff < 3600) return `${Math.ceil(diff / 60)}m left`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
    return `${Math.floor(diff / 86400)}d left`;
  };

  const timeRemaining = formatTimeRemaining();

  return (
    <Link
      ref={cardRef}
      href={`/market/${market.id}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-[#0e0a08] border transition-all duration-300 overflow-hidden cursor-pointer ${
        isBlitz
          ? "border-[#ea580c]/50 hover:border-[#fb923c]"
          : "border-[#7c2d12]/35 hover:border-[#fb923c]/60"
      }`}
    >
      {/* React Bits dynamic spotlight specular glow */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300" />

      {/* Top Header: Category / Blitz Tag + Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3 z-10 relative">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isBlitz ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#431407] text-[#fb923c] border border-[#ea580c]/60">
                <Zap className="w-2.5 h-2.5 text-[#fb923c]" />
                <span>5-MIN BLITZ</span>
              </span>
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

        {/* Market Title */}
        <h3 className="text-sm sm:text-base font-heading font-semibold text-[#fef3c7] line-clamp-2 leading-snug group-hover:text-[#fed7aa] transition-colors mb-4 z-10 relative">
          {market.title}
        </h3>
      </div>

      {/* Middle: Probabilities & Binary Price Bar */}
      <div className="space-y-2 my-2 z-10 relative">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#fb923c] font-bold flex items-center gap-1">
            <span>YES</span>
            <span className="text-sm font-extrabold">{yesPercent}¢</span>
          </span>
          <span className="text-[#fef3c7]/50 font-bold flex items-center gap-1">
            <span>NO</span>
            <span className="text-sm font-extrabold">{noPercent}¢</span>
          </span>
        </div>

        {/* Odds Indicator Bar with Specular Lighting */}
        <div className="relative w-full h-2 rounded-full overflow-hidden bg-[#24150f] border border-[#7c2d12]/30 flex">
          <div
            className="h-full bg-gradient-to-r from-[#ea580c] to-[#fb923c] transition-all duration-500 rounded-l-full relative"
            style={{ width: `${yesPercent}%` }}
          >
            <div className="absolute inset-0 bg-white/15 opacity-50" />
          </div>
          <div
            className="h-full bg-[#3d180d] transition-all duration-500 rounded-r-full"
            style={{ width: `${noPercent}%` }}
          />
        </div>
      </div>

      {/* Bottom: Shielded Pot & Action */}
      <div className="pt-3 border-t border-[#7c2d12]/25 flex items-center justify-between text-xs font-mono z-10 relative">
        <div className="flex items-center gap-1.5 text-[#fef3c7]/60">
          <Shield className="w-3.5 h-3.5 text-[#fb923c]/70 shrink-0" />
          <span>
            Pot:{" "}
            <strong className="text-[#fef3c7] font-bold">
              {potZec > 0 ? potZec.toFixed(2) : "0.00"} ZEC
            </strong>
          </span>
        </div>

        <span className="btn-monad-base btn-void text-[11px] px-3 py-1 rounded-full text-[#fef3c7] border border-[#7c2d12]/50 group-hover:border-[#fb923c] group-hover:text-[#fb923c] transition-all flex items-center gap-1">
          <span>Trade</span>
          <ArrowUpRight className="w-3 h-3 text-[#fb923c] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

// Shimmer Skeleton Loader matching Nocturne Obsidian/Ember Design
export function MarketCardSkeleton() {
  return (
    <div className="relative flex flex-col justify-between p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/25 overflow-hidden animate-pulse min-h-[190px]">
      {/* Top Header skeleton */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-20 rounded bg-[#1f1510]" />
          <div className="h-4 w-12 rounded bg-[#1f1510]" />
        </div>

        {/* Title skeleton */}
        <div className="space-y-2 mb-4">
          <div className="h-4 w-full rounded bg-[#261711]" />
          <div className="h-4 w-3/4 rounded bg-[#261711]" />
        </div>
      </div>

      {/* Probabilities bar skeleton */}
      <div className="space-y-2 my-2">
        <div className="flex justify-between">
          <div className="h-3 w-12 rounded bg-[#1f1510]" />
          <div className="h-3 w-12 rounded bg-[#1f1510]" />
        </div>
        <div className="h-2 w-full rounded-full bg-[#1f1510]" />
      </div>

      {/* Footer skeleton */}
      <div className="pt-3 border-t border-[#7c2d12]/20 flex items-center justify-between">
        <div className="h-3.5 w-24 rounded bg-[#1f1510]" />
        <div className="h-6 w-16 rounded-full bg-[#261711]" />
      </div>
    </div>
  );
}
