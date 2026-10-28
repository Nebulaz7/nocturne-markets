"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import {
  prepareZeroPostBet,
  type BetSide,
  type PreparedBetReceipt,
} from "@/lib/bet_builder";
import { saveBetReceipt, getBetReceipt } from "@/lib/vault";
import { verifyLocalReceipts } from "@/lib/market_api";
import MarketAvatar from "./MarketAvatar";

export interface MarketBetSlipProps {
  market: {
    id: string;
    title: string;
    event_slug?: string | null;
    pot_address: string;
    coordinator_public_key: string;
    drand_round: string | number;
    ref_yes_price?: number | null;
    status: string;
    category?: string | null;
    image?: string | null;
    icon?: string | null;
    total_pot_zec?: number;
    yes_pot_zec?: number;
    no_pot_zec?: number;
    market_type?: string | null;
    payout_multiplier?: number | null;
    seconds_left?: number | null;
  };
  submarketTitle?: string;
  selectedSide: BetSide;
  onSideChange: (side: BetSide) => void;
  relatedMarkets?: Array<{
    id: string;
    slug?: string;
    event_slug?: string;
    title: string;
    category?: string;
    image?: string | null;
    icon?: string | null;
    ref_yes_price?: number | null;
  }>;
}

// Demo Testnet Orchard address for rapid testing
const DEMO_TESTNET_UA =
  "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

export function MarketBetSlip({
  market,
  submarketTitle,
  selectedSide,
  onSideChange,
  relatedMarkets = [],
}: MarketBetSlipProps) {
  const [stakeAmount, setStakeAmount] = useState<string>("0.5");
  const [returnAddress, setReturnAddress] = useState<string>(DEMO_TESTNET_UA);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<PreparedBetReceipt | null>(null);
  const [copiedType, setCopiedType] = useState<"uri" | "memo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved UA on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nocturne_return_ua");
      if (saved && saved.trim()) {
        setReturnAddress(saved.trim());
      }
    }
  }, []);

  // Reference prices
  const rawYesPrice = market.ref_yes_price ?? 0.5;
  const yesPrice = Math.max(0.01, Math.min(0.99, rawYesPrice));
  const noPrice = Math.max(0.01, Math.min(0.99, 1 - yesPrice));

  const isBlitz = market.id.startsWith("blitz-");

  // ========================================================
  // EXACT PARIMUTUEL PAYOUT CALCULATION (Fee-on-Profit Math)
  // ========================================================
  const parimutuelEstimate = useMemo(() => {
    const stake = parseFloat(stakeAmount) || 0;
    if (stake <= 0) {
      return { payoutZec: "0.000", multiplier: "1.00", isFixed: false };
    }

    // Fixed House Payout for Sponsored Blitz Demo Markets
    const fixedMultiplier =
      market.payout_multiplier ||
      (isBlitz || market.market_type === "SPONSORED_DEMO" ? 1.52 : null);

    if (fixedMultiplier) {
      const grossPayout = stake * fixedMultiplier;
      return {
        payoutZec: grossPayout.toFixed(4),
        multiplier: Number(fixedMultiplier).toFixed(2),
        isFixed: true,
      };
    }

    const yesPot = market.yes_pot_zec ?? 0;
    const noPot = market.no_pot_zec ?? 0;

    const currentWinningPot = selectedSide === "YES" ? yesPot : noPot;
    const currentLosingPot = selectedSide === "YES" ? noPot : yesPot;

    // Case A: Existing opposing volume in the pot
    if (currentLosingPot > 0) {
      const newWinningPot = currentWinningPot + stake;
      const protocolFee = currentLosingPot * 0.02; // 2% fee strictly on losing pot (profit)
      const distributableLosing = currentLosingPot - protocolFee;
      const profit = (stake / newWinningPot) * distributableLosing;
      const grossPayout = stake + profit;
      return {
        payoutZec: grossPayout.toFixed(3),
        multiplier: (grossPayout / stake).toFixed(2),
        isFixed: false,
      };
    }

    // Case B: Fresh / newly seeded pool: estimate parimutuel equilibrium from reference odds
    const refP = selectedSide === "YES" ? yesPrice : noPrice;
    const cleanP = Math.max(0.01, Math.min(0.99, refP));
    const expectedProfit = stake * ((1 - cleanP) / cleanP) * 0.98;
    const grossPayout = stake + expectedProfit;
    return {
      payoutZec: grossPayout.toFixed(3),
      multiplier: (grossPayout / stake).toFixed(2),
      isFixed: false,
    };
  }, [
    stakeAmount,
    selectedSide,
    market.yes_pot_zec,
    market.no_pot_zec,
    market.payout_multiplier,
    market.market_type,
    isBlitz,
    yesPrice,
    noPrice,
  ]);

  // Preset chip increment
  const handleAddPreset = (val: number) => {
    const current = parseFloat(stakeAmount) || 0;
    setStakeAmount((current + val).toFixed(2).replace(/\.00$/, ""));
  };

  // Generate Zero-POST Bet
  const handlePlaceBet = async () => {
    setError(null);
    const parsed = parseFloat(stakeAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Enter a stake amount greater than 0 ZEC");
      return;
    }

    const trimmedAddr = returnAddress.trim();
    if (!trimmedAddr) {
      setError("Provide a shielded return address");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("nocturne_return_ua", trimmedAddr);
    }

    setIsGenerating(true);
    try {
      const generated = await prepareZeroPostBet({
        marketId: market.id,
        side: selectedSide,
        amountZec: parsed,
        potAddress: market.pot_address,
        returnAddress: trimmedAddr,
        coordinatorPublicKeyHex: market.coordinator_public_key,
        drandRound: market.drand_round,
        marketTitle: submarketTitle || market.title,
      });

      saveBetReceipt(generated);
      setReceipt(generated);
    } catch (err: any) {
      setError(`Failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: "uri" | "memo") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Live polling for instant payment confirmation & verification
  useEffect(() => {
    if (!receipt || receipt.status !== "PENDING_SCAN") return;
    const activeReceipt = receipt;
    let isMounted = true;

    async function checkConfirmation() {
      try {
        const results = await verifyLocalReceipts(market.id);
        const match = results.find(
          (r) =>
            r.commitment.toLowerCase() === activeReceipt.commitment.toLowerCase()
        );
        if (match && match.foundInAudit && isMounted) {
          const updated = getBetReceipt(activeReceipt.id);
          if (updated) {
            setReceipt(updated);
          } else {
            setReceipt((prev) =>
              prev
                ? {
                    ...prev,
                    status:
                      match.marketStatus === "SETTLED" ? "SETTLED" : "SEALED",
                  }
                : null
            );
          }
        }
      } catch {
        // Fallback
      }
    }

    const timer = setInterval(checkConfirmation, 3000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [receipt, market.id]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Main Trading Panel */}
      <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-5 shadow-2xl overflow-hidden">
        {/* Header: Clean Title & Active Side */}
        <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-[#7c2d12]/20">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <MarketAvatar
              src={market.icon || market.image}
              title={submarketTitle || market.title}
              category={market.category}
              size="sm"
            />
            <h2 className="text-sm font-heading font-bold text-[#fef3c7] truncate">
              {submarketTitle || market.title}
            </h2>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
              selectedSide === "YES"
                ? "bg-[#12281c] text-[#22c55e] border border-[#22c55e]/30"
                : "bg-[#361212] text-[#f87171] border border-[#f87171]/30"
            }`}
          >
            {isBlitz
              ? selectedSide === "YES"
                ? "Up"
                : "Down"
              : selectedSide}
          </span>
        </div>

        {/* RECEIPT VIEW */}
        {receipt ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-[#12281c]/80 border border-[#22c55e]/40 flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#22c55e]">
                Shielded Bet Slip Ready
              </span>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-xs font-mono text-[#fb923c] hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col items-center justify-center">
              <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-[#7c2d12]/20">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Payment Status
                </span>
                {receipt.status === "SEALED" || receipt.status === "SETTLED" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#12281c] text-[#22c55e] border border-emerald-500/30 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    CONFIRMED ON-CHAIN
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    SCANNING CHAIN...
                  </span>
                )}
              </div>

              <div className="p-2.5 bg-white rounded-xl shadow-lg mb-2">
                <QRCodeSVG
                  value={receipt.paymentUri}
                  size={175}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <span className="text-xs font-mono text-[#fef3c7]/80 text-center">
                <strong className="text-[#fef3c7]">{receipt.amountZec} ZEC</strong> on{" "}
                <strong
                  className={
                    receipt.side === "YES" ? "text-[#22c55e]" : "text-[#f87171]"
                  }
                >
                  {receipt.side}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(receipt.paymentUri, "uri")}
                className="py-2.5 px-3 rounded-xl bg-[#1c120c] hover:bg-[#27150d] border border-[#7c2d12]/40 text-xs font-mono font-bold text-[#fef3c7] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedType === "uri" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#fb923c]" />
                    <span>Copy URI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(receipt.memoUtf8, "memo")}
                className="py-2.5 px-3 rounded-xl bg-[#1c120c] hover:bg-[#27150d] border border-[#7c2d12]/40 text-xs font-mono font-bold text-[#fef3c7] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedType === "memo" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#fb923c]" />
                    <span>Copy Memo</span>
                  </>
                )}
              </button>
            </div>

            <a
              href={receipt.paymentUri}
              className="w-full py-2.5 px-4 rounded-xl bg-[#12281c] hover:bg-[#183525] text-[#22c55e] font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-colors text-center"
            >
              <span>Open in Wallet</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          /* BET FORM */
          <div className="space-y-4">
            {/* Outcome Selection Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSideChange("YES")}
                className={`py-3 px-3 rounded-xl font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none ${
                  selectedSide === "YES"
                    ? "bg-[#15803d] text-white ring-2 ring-[#22c55e]"
                    : "bg-[#12281c] hover:bg-[#183525] active:bg-[#0d1e15] text-[#22c55e]"
                }`}
              >
                {isBlitz ? "Up" : "Yes"} {(yesPrice * 100).toFixed(1)}¢
              </button>

              <button
                type="button"
                onClick={() => onSideChange("NO")}
                className={`py-3 px-3 rounded-xl font-sans font-bold text-sm flex items-center justify-center transition-colors cursor-pointer shadow-none outline-none border-none ${
                  selectedSide === "NO"
                    ? "bg-[#b91c1c] text-white ring-2 ring-[#ef4444]"
                    : "bg-[#361212] hover:bg-[#461717] active:bg-[#290d0d] text-[#f87171]"
                }`}
              >
                {isBlitz ? "Down" : "No"} {(noPrice * 100).toFixed(1)}¢
              </button>
            </div>

            {/* Stake Input */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/60 mb-1">
                <span>Amount</span>
                <span className="text-[#fb923c] font-bold">ZEC</span>
              </div>

              <div className="relative flex items-center rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 focus-within:border-[#fb923c] transition-colors">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full py-3 px-3.5 bg-transparent text-xl font-bold font-mono text-[#fef3c7] outline-none placeholder-[#fef3c7]/20"
                />
                <button
                  type="button"
                  onClick={() => setStakeAmount("0")}
                  className="pr-3 text-xs font-mono text-[#fef3c7]/40 hover:text-[#fb923c] cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {(isBlitz || market.market_type === "SPONSORED_DEMO"
                  ? [0.05, 0.1, 0.5, 1.0]
                  : [0.1, 0.5, 1.0, 5.0]
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="py-1 px-3 rounded-lg bg-[#1c120c] hover:bg-[#27150d] active:bg-[#140e0b] border border-[#7c2d12]/30 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Payout Return Address Input */}
            <div>
              <input
                type="text"
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
                placeholder="Payout Return Address (utest1...)"
                className="w-full py-2.5 px-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 focus:border-[#fb923c] text-xs font-mono text-[#fef3c7] outline-none placeholder-[#fef3c7]/30 truncate"
              />
            </div>

            {/* Payout Calculation Strip */}
            <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex items-center justify-between font-mono">
              <span className="text-xs text-[#fef3c7]/60">
                {isBlitz || market.payout_multiplier ? "Fixed Return" : "To win"}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-[#22c55e]">
                  {parimutuelEstimate.payoutZec} ZEC
                </span>
                <span className="text-xs text-[#fb923c] font-bold">
                  ({parimutuelEstimate.multiplier}x{isBlitz || market.payout_multiplier ? " Fixed" : ""})
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#361212] border border-[#f87171]/40 text-xs font-mono text-[#f87171]">
                {error}
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              disabled={isGenerating || market.status !== "OPEN"}
              onClick={handlePlaceBet}
              className={`w-full py-3.5 px-4 rounded-xl font-heading font-bold text-sm tracking-wide transition-all cursor-pointer shadow-none outline-none border-none flex items-center justify-center gap-2 ${
                market.status !== "OPEN"
                  ? "bg-[#1c120c] text-[#fef3c7]/30 cursor-not-allowed"
                  : "bg-[#ea580c] hover:bg-[#c2410c] active:bg-[#9a3412] text-white"
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Preparing Bet...</span>
                </>
              ) : market.status !== "OPEN" ? (
                <span>Market Closed</span>
              ) : (
                <span>Trade {selectedSide === "YES" ? "Yes" : "No"}</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Related Markets List */}
      {relatedMarkets.length > 0 && (
        <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-4">
          <div className="text-xs font-heading font-bold text-[#fef3c7]/80 uppercase tracking-wider mb-2.5">
            Related
          </div>

          <div className="space-y-1.5">
            {relatedMarkets.slice(0, 4).map((rel) => {
              const relPrice = rel.ref_yes_price ?? 0.5;
              const relPct = Math.round(relPrice * 100);
              const targetSlug = rel.slug || rel.event_slug || rel.id;

              return (
                <Link
                  key={rel.id}
                  href={`/market/${targetSlug}`}
                  className="flex items-center justify-between gap-2.5 p-2 rounded-xl hover:bg-[#1c120c] transition-all group"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MarketAvatar
                      src={rel.icon || rel.image}
                      title={rel.title}
                      category={rel.category}
                      size="sm"
                    />
                    <span className="text-xs font-sans text-[#fef3c7]/75 group-hover:text-[#fef3c7] line-clamp-1">
                      {rel.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#fef3c7] shrink-0">
                    {relPct}%
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
