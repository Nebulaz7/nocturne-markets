"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { MarketGraph } from "@/components/MarketGraph";
import { MarketBetSlip } from "@/components/MarketBetSlip";
import {
  fetchBlitzMarket,
  type BlitzMarketItem,
} from "@/lib/market_api";
import type { BetSide } from "@/lib/bet_builder";
import {
  Clock,
  Zap,
  Shield,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default function BlitzPage() {
  const [blitz, setBlitz] = useState<BlitzMarketItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<BetSide>("YES");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Track active fetch to avoid race conditions
  const fetchingRef = useRef(false);

  const loadMarket = useCallback(async (isManual = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (isManual) setIsRefreshing(true);

    try {
      const data = await fetchBlitzMarket();
      setBlitz(data);
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, (data.close_time || now) - now);
      setSecondsRemaining(diff);
      setError(null);
    } catch (err: any) {
      console.error("[Blitz] Failed to fetch active blitz market:", err);
      if (!blitz) {
        setError(err?.message || "Failed to load active Blitz market.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      fetchingRef.current = false;
    }
  }, [blitz]);

  // Initial load
  useEffect(() => {
    loadMarket();
  }, [loadMarket]);

  // 1-second countdown interval
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Round expired -> auto-roll fresh round
          loadMarket();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loadMarket]);

  // Periodic poll fallback every 20 seconds to sync status/pots
  useEffect(() => {
    const poll = setInterval(() => {
      loadMarket();
    }, 20000);
    return () => clearInterval(poll);
  }, [loadMarket]);

  // Format MM:SS
  const mins = Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, "0");
  const secs = (secondsRemaining % 60).toString().padStart(2, "0");

  const multiplier = blitz?.payout_multiplier ?? 1.52;
  const drandRound = blitz?.drand_round ?? 0;

  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Navigation Breadcrumb & Refresh Bar */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[#7c2d12]/20">
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[#fef3c7]/60 hover:text-[#fb923c] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Markets</span>
            </Link>
            <span className="text-[#7c2d12]">/</span>
            <span className="text-[#fb923c] font-bold">10M ZEC BLITZ</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/50 text-[10px] font-bold">
              SPONSORED DEMO
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadMarket(true)}
              disabled={isRefreshing}
              className="px-2.5 py-1 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Sync latest round"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#fb923c]" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {blitz && (
              <Link
                href={`/audit/${blitz.id}`}
                className="px-2.5 py-1 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors"
              >
                <Shield className="w-3.5 h-3.5 text-[#fb923c]" />
                <span className="hidden sm:inline">Audit Proof</span>
              </Link>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading && !blitz && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-28 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 animate-pulse" />
              <div className="h-72 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 animate-pulse" />
            </div>
            <div className="lg:col-span-4 h-96 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 animate-pulse" />
          </div>
        )}

        {/* Error State */}
        {error && !blitz && (
          <div className="p-8 rounded-2xl bg-[#0e0a08] border border-rose-900/40 text-center max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-400 flex items-center justify-center mx-auto mb-4 font-mono font-bold">
              !
            </div>
            <h2 className="text-lg font-heading font-bold text-[#fef3c7] mb-2">
              Coordinator Unavailable
            </h2>
            <p className="text-xs font-mono text-[#fef3c7]/60 mb-6">{error}</p>
            <button
              type="button"
              onClick={() => loadMarket(true)}
              className="px-5 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-mono font-bold transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Active Blitz Trading Workspace */}
        {blitz && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Live Blitz Header, Clock Banner, Chart & Verification */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* High-Frequency Live Metric Header */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-[#ea580c]/10 to-transparent pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1c120c] border border-[#ea580c]/40 flex items-center justify-center text-[#fb923c] shrink-0">
                      <Zap className="w-5 h-5 fill-[#fb923c]/20" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/50">
                          10-Minute Blitz
                        </span>
                        <span className="text-[10px] font-mono text-[#fef3c7]/60">
                          ID: {blitz.id}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#fef3c7] tracking-tight mt-1">
                        {blitz.title}
                      </h1>
                    </div>
                  </div>

                  {/* Primary Countdown Display */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/50 shrink-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#fef3c7]/50 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#fb923c]" />
                      Round Closes In
                    </span>
                    <span className="text-2xl sm:text-3xl font-mono font-bold text-[#fb923c] tracking-wider">
                      {mins}:{secs}
                    </span>
                  </div>
                </div>

                {/* Key Numbers Grid (Numbers-First Architecture) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#7c2d12]/20 font-mono">
                  <div className="p-3 rounded-xl bg-[#140e0b]/70 border border-[#7c2d12]/30">
                    <div className="text-[10px] text-[#fef3c7]/50 uppercase">Fixed Payout</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      {multiplier}x
                    </div>
                    <div className="text-[10px] text-[#fef3c7]/40">TAZ Sponsored</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#140e0b]/70 border border-[#7c2d12]/30">
                    <div className="text-[10px] text-[#fef3c7]/50 uppercase">Outcome</div>
                    <div className="text-lg font-bold text-[#fef3c7] mt-0.5">
                      Resolves YES
                    </div>
                    <div className="text-[10px] text-[#fef3c7]/40">Every 10 Mins</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#140e0b]/70 border border-[#7c2d12]/30">
                    <div className="text-[10px] text-[#fef3c7]/50 uppercase">drand Round</div>
                    <div className="text-lg font-bold text-[#fb923c] mt-0.5">
                      #{drandRound}
                    </div>
                    <div className="text-[10px] text-[#fef3c7]/40">Quicknet 3s</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#140e0b]/70 border border-[#7c2d12]/30">
                    <div className="text-[10px] text-[#fef3c7]/50 uppercase">Total Pot</div>
                    <div className="text-lg font-bold text-[#fef3c7] mt-0.5">
                      {(blitz.total_pot_zec ?? 0).toFixed(4)} ZEC
                    </div>
                    <div className="text-[10px] text-[#fef3c7]/40">Shielded Orchard</div>
                  </div>
                </div>
              </div>

              {/* Interactive Market Graph */}
              <div className="rounded-2xl overflow-hidden border border-[#7c2d12]/30 bg-[#0e0a08]">
                <MarketGraph
                  marketId={blitz.id}
                  marketTitle={blitz.title}
                  refYesPrice={blitz.ref_yes_price ?? 0.5}
                  isBlitz={true}
                  closeTime={blitz.close_time}
                />
              </div>

              {/* Protocol Spec Strip */}
              <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 font-mono text-xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#7c2d12]/20">
                  <span className="font-bold text-[#fef3c7] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#fb923c]" />
                    Zero-POST Protocol Invariants
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Autonomous Settlement
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[#fef3c7]/70">
                  <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/20">
                    <div className="text-[#fb923c] font-bold mb-1">Non-Parimutuel Guarantee</div>
                    <div>
                      Winning tickets receive a fixed {multiplier}x return from the house sponsorship pool, regardless of round volume.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/20">
                    <div className="text-[#fb923c] font-bold mb-1">Cryptographic Auditability</div>
                    <div>
                      All bets and payouts are verified through post-settlement Merkle inclusion proofs without revealing shielded addresses.
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#7c2d12]/20 flex items-center justify-between flex-wrap gap-2 text-[10px] text-[#fef3c7]/50">
                  <div className="truncate max-w-md">
                    Pot: {blitz.pot_address}
                  </div>
                  <Link
                    href={`/audit/${blitz.id}`}
                    className="text-[#fb923c] hover:underline flex items-center gap-1 shrink-0 font-bold"
                  >
                    <span>View Audit Package</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Column: Persistent Bet Slip */}
            <div className="lg:col-span-4 sticky top-20">
              <MarketBetSlip
                market={blitz}
                selectedSide={selectedSide}
                onSideChange={setSelectedSide}
              />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
