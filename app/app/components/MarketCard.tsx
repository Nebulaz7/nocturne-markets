"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Zap, Clock } from "lucide-react";

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

export default function MarketCard({ market }: MarketCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
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

  // Arc gauge calculation (semi-circle from 180deg to 0deg)
  const rad = (yesPercent / 100) * Math.PI;
  const dotX = Number((34 - 26 * Math.cos(rad)).toFixed(2));
  const dotY = Number((34 - 26 * Math.sin(rad)).toFixed(2));
  const gaugeColor = yesPercent >= 50 ? "#22c55e" : "#ef4444";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleCardClick = () => {
    router.push(`/market/${market.id}`);
  };

  const handleTradeYes = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/market/${market.id}?side=YES`);
  };

  const handleTradeNo = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/market/${market.id}?side=NO`);
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
    <div
      ref={cardRef}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      role="article"
      tabIndex={0}
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

        {/* Market Title & Semi-Circular Chance Gauge */}
        <div className="flex items-start justify-between gap-3 mb-4 z-10 relative">
          <h3 className="text-sm sm:text-base font-heading font-semibold text-[#fef3c7] line-clamp-2 leading-snug group-hover:text-[#fed7aa] transition-colors flex-1">
            {market.title}
          </h3>

          {/* Arc Gauge for Probability */}
          <div className="relative shrink-0 w-[68px] h-[46px] flex items-center justify-center select-none pt-1">
            <svg viewBox="0 0 68 46" className="w-[68px] h-[46px] overflow-visible">
              {/* Background Arc Track */}
              <path
                d="M 8 34 A 26 26 0 0 1 60 34"
                fill="none"
                stroke="#2a1d17"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* Active Progress Arc */}
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
              {/* Indicator Dot */}
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
        {/* Pot Info */}
        <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/60">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#fb923c]/70 shrink-0" />
            <span>
              Pot:{" "}
              <strong className="text-[#fef3c7] font-bold">
                {potZec > 0 ? potZec.toFixed(2) : "0.00"} ZEC
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-[#fef3c7]/40">
            Parimutuel Pool
          </span>
        </div>

        {/* Action Trade YES / NO Buttons (Dark muted green & dark red, flat - no glow, no shadow, no gradient) */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleTradeYes}
            className="w-full py-2.5 px-3 rounded-xl bg-[#12281c] hover:bg-[#183525] active:bg-[#0d1e15] text-[#22c55e] font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
          >
            Yes
          </button>

          <button
            type="button"
            onClick={handleTradeNo}
            className="w-full py-2.5 px-3 rounded-xl bg-[#361212] hover:bg-[#461717] active:bg-[#290d0d] text-[#f87171] font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none"
          >
            No
          </button>
        </div>
      </div>
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
