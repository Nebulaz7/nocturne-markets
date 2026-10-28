"use client";

import React, { useState } from "react";
import { Shield, Lock, FileText, ExternalLink, Info } from "lucide-react";
import { useNetwork } from "@/context/NetworkContext";

export interface MarketRulesContextProps {
  marketTitle: string;
  question?: string | null;
  closeTime?: number;
  drandRound?: string | number;
  potAddress?: string;
  coordinatorPublicKey?: string;
  conditionId?: string;
  isBlitz?: boolean;
  marketType?: string | null;
  onOpenAudit: () => void;
}

export function MarketRulesContext({
  marketTitle,
  question,
  closeTime,
  drandRound,
  potAddress,
  coordinatorPublicKey,
  conditionId,
  isBlitz = false,
  marketType,
  onOpenAudit,
}: MarketRulesContextProps) {
  const { currency } = useNetwork();
  const [activeTab, setActiveTab] = useState<"rules" | "context">("rules");

  const isBlitzDemo =
    isBlitz ||
    marketType === "SPONSORED_DEMO" ||
    marketTitle.toLowerCase().includes("blitz");

  const closeDateStr = closeTime
    ? new Date(closeTime * 1000).toLocaleString()
    : "Event close";

  return (
    <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-5 sm:p-6 mb-6">
      {/* Tabs Header */}
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-[#7c2d12]/20">
        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer pb-1 relative ${
            activeTab === "rules"
              ? "text-[#fb923c] border-b-2 border-[#fb923c]"
              : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
          }`}
        >
          Rules
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("context")}
          className={`text-xs font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer pb-1 relative ${
            activeTab === "context"
              ? "text-[#fb923c] border-b-2 border-[#fb923c]"
              : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
          }`}
        >
          Market Context
        </button>

        {isBlitzDemo && (
          <span className="ml-auto px-2 py-0.5 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/50 text-[10px] font-mono font-bold uppercase tracking-wider">
            DEMO
          </span>
        )}
      </div>

      {/* Tab 1: Rules */}
      {activeTab === "rules" && (
        <div className="space-y-4 text-xs sm:text-sm text-[#fef3c7]/80 leading-relaxed font-sans">
          {isBlitzDemo ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#140e0b] border border-[#ea580c]/30 font-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ALWAYS RESOLVES TO YES
                </div>
                <p className="text-[#fef3c7]/70 text-[11px] leading-relaxed">
                  This is a live sponsored demo market. It is programmed to always resolve to &quot;Yes&quot; every 10 minutes for testing and judging demonstrations.
                </p>
              </div>

              <p className="text-xs text-[#fef3c7]/80">
                Winning tickets receive a guaranteed 1.52x return sponsored by the house {currency} reserve. Settled automatically on-chain by the coordinator settlement worker upon reaching the 10-minute closing timestamp.
              </p>

              <div className="pt-2 text-xs font-mono text-[#fef3c7]/50 flex items-center gap-4">
                <span>Cycle: 10 Minutes</span>
                <span>Outcome: Always YES</span>
                <span>Oracle: Quicknet #{drandRound}</span>
              </div>
            </div>
          ) : (
            <>
              <p>
                {question
                  ? `This market will resolve to "Yes" if ${question.toLowerCase().replace(/^(will|is)\s*/, "")} Otherwise, this market will resolve to "No".`
                  : `This market will resolve to "Yes" if the conditions specified in "${marketTitle}" are met prior to the closing timestamp. Otherwise, this market will resolve to "No".`}
              </p>

              <p className="text-xs text-[#fef3c7]/60">
                The primary resolution source for this market is the official Polymarket UMA Oracle settlement, verified against the cryptographic Drand Quicknet beacon round.
              </p>

              <div className="pt-2 text-xs font-mono text-[#fef3c7]/50 flex items-center gap-4">
                <span>Closes: {closeDateStr}</span>
                <span>Oracle: #{drandRound}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Market Context */}
      {activeTab === "context" && (
        <div className="space-y-3 text-xs sm:text-sm text-[#fef3c7]/80 leading-relaxed font-sans">
          <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 space-y-2 text-xs font-mono">
            {isBlitzDemo && (
              <div className="flex justify-between items-center text-emerald-400 font-bold">
                <span>Resolution Rule:</span>
                <span>Always Resolves to YES</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[#fef3c7]/50">Pot Address:</span>
              <span className="text-[#fb923c] truncate max-w-[220px]">
                {potAddress || "Orchard Shielded Pool"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#fef3c7]/50">Settlement Key:</span>
              <span className="text-[#fef3c7]/80 truncate max-w-[220px]">
                {coordinatorPublicKey
                  ? `${coordinatorPublicKey.slice(0, 16)}...`
                  : "Coordinator Sealed"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Resolver & Audit Bar */}
      <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 flex items-center justify-between text-xs font-mono">
        <span className="text-[#fef3c7]/60">UMA &amp; Drand Quicknet</span>
        <button
          type="button"
          onClick={onOpenAudit}
          className="text-[#fb923c] hover:underline flex items-center gap-1 cursor-pointer font-bold"
        >
          <span>Audit Proofs</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
