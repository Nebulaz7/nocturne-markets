"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MarketAvatar from "./MarketAvatar";
import { useNetwork } from "@/context/NetworkContext";

export interface SubmarketItem {
  id: string;
  title: string;
  group_item_title?: string | null;
  question?: string | null;
  ref_yes_price?: number | null;
  total_pot_zec?: number;
  status?: string;
  close_time?: number;
  pot_address?: string;
  coordinator_public_key?: string;
  drand_round?: string | number;
  image?: string | null;
  icon?: string | null;
}

export interface MultiOutcomeTableProps {
  submarkets: SubmarketItem[];
  activeSubmarketId: string;
  activeSide: "YES" | "NO";
  onSelect: (submarketId: string, side: "YES" | "NO") => void;
}

// Clean outcome label parser
function cleanOutcomeName(item: SubmarketItem): string {
  if (item.group_item_title) {
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

export function MultiOutcomeTable({
  submarkets,
  activeSubmarketId,
  activeSide,
  onSelect,
}: MultiOutcomeTableProps) {
  const { currency } = useNetwork();
  const [showResolved, setShowResolved] = useState(false);

  // Sort submarkets descending by probability
  const sorted = [...submarkets].sort((a, b) => {
    const priceA = a.ref_yes_price ?? 0.5;
    const priceB = b.ref_yes_price ?? 0.5;
    return priceB - priceA;
  });

  return (
    <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-4 sm:p-5 mb-6">
      <div className="space-y-2">
        {sorted.map((sm) => {
          const rawPrice = sm.ref_yes_price ?? 0.5;
          const yesPct = Math.max(1, Math.min(99, Math.round(rawPrice * 100)));
          const yesCents = (rawPrice * 100).toFixed(1);
          const noCents = ((1 - rawPrice) * 100).toFixed(1);
          const outcomeName = cleanOutcomeName(sm);

          const isRowActive = sm.id === activeSubmarketId;
          const isYesActive = isRowActive && activeSide === "YES";
          const isNoActive = isRowActive && activeSide === "NO";

          const potZec = sm.total_pot_zec ?? 0;

          return (
            <div
              key={sm.id}
              onClick={() => onSelect(sm.id, activeSide)}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                isRowActive
                  ? "bg-[#18100b] border-[#fb923c]/60 ring-1 ring-[#fb923c]/20"
                  : "bg-[#140e0b]/80 hover:bg-[#1a120e] border-[#7c2d12]/30 hover:border-[#fb923c]/40"
              }`}
            >
              {/* Outcome Title & Pot Subtext */}
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                <MarketAvatar
                  src={
                    sm.id.startsWith("blitz-") || sm.title?.toLowerCase().includes("blitz")
                      ? "/zcash.svg"
                      : (sm.icon || sm.image)
                  }
                  title={outcomeName}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm sm:text-base font-sans font-semibold block truncate ${
                      isRowActive ? "text-[#fef3c7]" : "text-[#fef3c7]/90"
                    }`}
                  >
                    {outcomeName}
                  </span>
                  <span className="text-[11px] font-mono text-[#fef3c7]/40 block mt-0.5">
                    {potZec > 0 ? `${potZec.toFixed(2)} ${currency} Pot` : "Parimutuel Pool"}
                  </span>
                </div>
              </div>

              {/* Percentage Probability */}
              <div className="text-base sm:text-lg font-bold font-mono text-[#fef3c7] shrink-0 min-w-[50px] text-right">
                {yesPct < 1 ? "<1%" : `${yesPct}%`}
              </div>

              {/* Buy Yes & Buy No Trade Buttons (Solid flat green & red, no glow/shadow/gradient) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Buy Yes Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(sm.id, "YES");
                  }}
                  className={`py-1.5 px-3 sm:px-4 rounded-lg font-sans font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none ${
                    isYesActive
                      ? "bg-[#15803d] text-white ring-2 ring-[#22c55e]"
                      : "bg-[#12281c] hover:bg-[#183525] active:bg-[#0d1e15] text-[#22c55e]"
                  }`}
                >
                  Buy Yes {yesCents}¢
                </button>

                {/* Buy No Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(sm.id, "NO");
                  }}
                  className={`py-1.5 px-3 sm:px-4 rounded-lg font-sans font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none ${
                    isNoActive
                      ? "bg-[#b91c1c] text-white ring-2 ring-[#ef4444]"
                      : "bg-[#361212] hover:bg-[#461717] active:bg-[#290d0d] text-[#f87171]"
                  }`}
                >
                  Buy No {noCents}¢
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible View Resolved options */}
      <div className="mt-3 pt-3 border-t border-[#7c2d12]/20">
        <button
          type="button"
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs font-mono text-[#fef3c7]/40 hover:text-[#fb923c] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>View resolved</span>
          {showResolved ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showResolved && (
          <div className="mt-2 p-3 rounded-lg bg-[#140e0b] border border-[#7c2d12]/20 text-xs font-mono text-[#fef3c7]/50">
            No resolved sub-brackets for this event yet. All pools currently live.
          </div>
        )}
      </div>
    </div>
  );
}
