"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Share2,
  Check,
  Shield,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";
import { MarketGraph } from "./MarketGraph";
import { MultiOutcomeTable, type SubmarketItem } from "./MultiOutcomeTable";
import { MarketRulesContext } from "./MarketRulesContext";
import { MarketBetSlip } from "./MarketBetSlip";
import { MyBetsDrawer } from "./MyBetsDrawer";
import { AuditDrawer } from "./AuditDrawer";
import type { BetSide } from "@/lib/bet_builder";

export interface MarketTradeViewProps {
  market: {
    id: string;
    title: string;
    slug?: string;
    event_slug?: string | null;
    market_slug?: string | null;
    question?: string | null;
    group_item_title?: string | null;
    status: string;
    category?: string | null;
    close_time: number;
    drand_round: string | number;
    pot_address: string;
    coordinator_public_key: string;
    total_pot_zec: number;
    yes_pot_zec: number;
    no_pot_zec: number;
    ref_yes_price?: number | null;
    condition_id?: string;
  };
  submarkets?: SubmarketItem[];
  relatedMarkets?: Array<{
    id: string;
    slug?: string;
    event_slug?: string;
    title: string;
    category?: string;
    ref_yes_price?: number | null;
  }>;
}

// Clean event title parser (removes outcome suffixes like ': Draw')
function cleanEventTitle(title: string, question?: string | null): string {
  if (question && question.trim().length > 5) {
    return question.trim();
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

// Get 2-letter badge emblem
function getEventBadge(title: string, category?: string | null): string {
  if (category?.toLowerCase() === "crypto") return "₿";
  const words = title.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/);
  if (words.length >= 2 && words[0] && words[1]) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return title.slice(0, 2).toUpperCase() || "NM";
}

export function MarketTradeView({
  market,
  submarkets = [],
  relatedMarkets = [],
}: MarketTradeViewProps) {
  const [selectedSubmarketId, setSelectedSubmarketId] = useState<string>(
    market.id
  );
  const [selectedSide, setSelectedSide] = useState<BetSide>("YES");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Check URL query parameters for ?side=YES/NO and ?sub=ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const side = params.get("side");
      if (side) {
        const upper = side.toUpperCase();
        if (upper === "YES" || upper === "NO") {
          setSelectedSide(upper as BetSide);
        }
      }

      const subId = params.get("sub");
      if (subId) {
        setSelectedSubmarketId(subId);
      }
    }
  }, []);

  // Determine active target submarket
  const activeSubmarket =
    submarkets.find((s) => s.id === selectedSubmarketId) || market;

  const isMultiOutcome = submarkets.length > 1;
  const isBlitz =
    market.id.startsWith("blitz-") ||
    market.title.toLowerCase().includes("blitz");

  const eventTitle = isMultiOutcome
    ? cleanEventTitle(market.title, market.question)
    : market.title;

  const eventBadge = getEventBadge(eventTitle, market.category);

  // Combined pot across all submarkets
  const totalEventPot = isMultiOutcome
    ? submarkets.reduce((sum, s) => sum + (s.total_pot_zec ?? 0), 0)
    : market.total_pot_zec ?? 0;

  // Format close time
  const formatTimeRemaining = (closeTime?: number) => {
    if (!closeTime) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = closeTime - now;
    if (diff <= 0) return "Closed";
    if (diff < 3600) return `${Math.ceil(diff / 60)}m left`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h left`;
    return `${Math.floor(diff / 86400)}d left`;
  };

  const timeRemaining = formatTimeRemaining(market.close_time);

  // Copy share URL
  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-sans">
      {/* Top Navigation & Utility Breadcrumb Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#7c2d12]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/#markets"
            className="flex items-center gap-1.5 text-xs font-mono text-[#fef3c7]/60 hover:text-[#fb923c] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Markets</span>
          </Link>

          <span className="text-[#7c2d12]">/</span>

          <span className="text-xs font-mono font-semibold text-[#fb923c]">
            {market.category || "General"}
          </span>
        </div>

        {/* Action badges: Share, Audit, My Bets */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleShare}
            className="py-1 px-2.5 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#fb923c]" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="py-1 px-3 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Audit Proofs</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="py-1 px-3 rounded-lg bg-[#1c120c] hover:bg-[#27150d] border border-[#fb923c]/40 text-xs font-mono font-bold text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>My Private Bets</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          MAIN 2-COLUMN POLYMARKET LAYOUT
          Left: 7-8 cols on lg (Header, Graph, Outcomes, Rules)
          Right: 4-5 cols on lg (Persistent Bet Slip)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================
            LEFT COLUMN: Event Overview, Graph, Outcomes & Rules
            ======================================================== */}
        <div className="lg:col-span-8 flex flex-col">
          {/* Event Header Card */}
          <div className="mb-6">
            <div className="flex items-start gap-3 sm:gap-4 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#1c120c] border border-[#7c2d12]/50 text-[#fb923c] font-heading font-extrabold text-sm sm:text-base flex items-center justify-center shrink-0 tracking-wider">
                {eventBadge}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#160f0c] text-[#fb923c] border border-[#7c2d12]/40">
                    {market.category || "General"}
                  </span>

                  {timeRemaining && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#fef3c7]/50">
                      <Clock className="w-3 h-3 text-[#fef3c7]/40" />
                      <span>{timeRemaining}</span>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>LIVE</span>
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-[#fef3c7] tracking-tight leading-tight">
                  {eventTitle}
                </h1>
              </div>
            </div>

            {/* Stats Strip */}
            <div className="flex items-center gap-3 text-xs font-mono text-[#fef3c7]/60 pt-2 border-t border-[#7c2d12]/20">
              <span className="text-[#fef3c7] font-semibold">
                {totalEventPot > 0 ? `${totalEventPot.toFixed(2)} ZEC Pot` : "0.00 ZEC Pot"}
              </span>
              {timeRemaining && <span>· {timeRemaining}</span>}
            </div>
          </div>

          {/* Interactive Graph (Chart) */}
          <MarketGraph
            marketId={activeSubmarket.id}
            marketTitle={activeSubmarket.title}
            refYesPrice={activeSubmarket.ref_yes_price}
            isBlitz={isBlitz}
            closeTime={market.close_time}
          />

          {/* Multi-Outcome Options Table (When event has multiple outcomes) */}
          {isMultiOutcome && (
            <MultiOutcomeTable
              submarkets={submarkets}
              activeSubmarketId={selectedSubmarketId}
              activeSide={selectedSide}
              onSelect={(subId, side) => {
                setSelectedSubmarketId(subId);
                setSelectedSide(side);
              }}
            />
          )}

          {/* Collapsible Rules & Market Context Section */}
          <MarketRulesContext
            marketTitle={market.title}
            question={market.question}
            closeTime={market.close_time}
            drandRound={market.drand_round}
            potAddress={market.pot_address}
            coordinatorPublicKey={market.coordinator_public_key}
            conditionId={market.condition_id}
            onOpenAudit={() => setAuditOpen(true)}
          />
        </div>

        {/* ========================================================
            RIGHT COLUMN: The Persistent Bet Slip / Trading Panel
            ======================================================== */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <MarketBetSlip
            market={{
              id: activeSubmarket.id,
              title: eventTitle,
              event_slug: market.event_slug,
              pot_address: activeSubmarket.pot_address || market.pot_address,
              coordinator_public_key:
                activeSubmarket.coordinator_public_key ||
                market.coordinator_public_key,
              drand_round:
                activeSubmarket.drand_round || market.drand_round,
              ref_yes_price: activeSubmarket.ref_yes_price,
              status: market.status,
              category: market.category,
              total_pot_zec:
                activeSubmarket.total_pot_zec ?? market.total_pot_zec ?? 0,
              yes_pot_zec:
                (activeSubmarket as any).yes_pot_zec ?? market.yes_pot_zec ?? 0,
              no_pot_zec:
                (activeSubmarket as any).no_pot_zec ?? market.no_pot_zec ?? 0,
            }}
            submarketTitle={
              isMultiOutcome ? activeSubmarket.title : undefined
            }
            selectedSide={selectedSide}
            onSideChange={(side) => setSelectedSide(side)}
            relatedMarkets={relatedMarkets}
          />
        </div>
      </div>

      {/* Drawers */}
      <MyBetsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <AuditDrawer
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        marketId={activeSubmarket.id}
        marketTitle={activeSubmarket.title}
      />
    </div>
  );
}
