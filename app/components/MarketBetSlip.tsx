"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Shield,
  Lock,
  Copy,
  Check,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  prepareZeroPostBet,
  type BetSide,
  type PreparedBetReceipt,
} from "@/lib/bet_builder";
import { saveBetReceipt } from "@/lib/vault";

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
    ref_yes_price?: number | null;
  }>;
  onSelectRelated?: (marketId: string) => void;
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
  onSelectRelated,
}: MarketBetSlipProps) {
  const [stakeAmount, setStakeAmount] = useState<string>("0.5");
  const [returnAddress, setReturnAddress] = useState<string>(DEMO_TESTNET_UA);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<PreparedBetReceipt | null>(null);
  const [copiedType, setCopiedType] = useState<"uri" | "memo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Load saved UA on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nocturne_return_ua");
      if (saved && saved.trim()) {
        setReturnAddress(saved.trim());
      }
    }
  }, []);

  // Prices and Odds calculation
  const rawYesPrice = market.ref_yes_price ?? 0.5;
  const yesPrice = Math.max(0.01, Math.min(0.99, rawYesPrice));
  const noPrice = Math.max(0.01, Math.min(0.99, 1 - yesPrice));

  const activePrice = selectedSide === "YES" ? yesPrice : noPrice;
  const activeCents = (activePrice * 100).toFixed(1);

  const numStake = parseFloat(stakeAmount) || 0;
  // Estimated payout: in parimutuel/binary market, Stake / Price = Return
  const potentialWinZec = numStake > 0 ? (numStake / activePrice).toFixed(3) : "0.000";
  const multiplier = activePrice > 0 ? (1 / activePrice).toFixed(2) : "1.00";

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
      setError("Please enter a valid stake amount greater than 0 ZEC");
      return;
    }

    const trimmedAddr = returnAddress.trim();
    if (!trimmedAddr) {
      setError("Please provide a shielded return address for winning payouts");
      return;
    }

    // Save UA for future bets
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

      // Save to zero-leak browser localStorage vault
      saveBetReceipt(generated);
      setReceipt(generated);
    } catch (err: any) {
      setError(`Failed to prepare shielded bet: ${err.message}`);
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

  const isBlitz = market.id.startsWith("blitz-");

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ========================================================
          PANEL 1: The Main Bet Slip Card
          ======================================================== */}
      <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Header: Market / Outcome & Active Side */}
        <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-[#7c2d12]/20">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#fef3c7]/50 block">
              {market.title}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <h2 className="text-sm sm:text-base font-heading font-bold text-[#fef3c7] truncate">
                {submarketTitle || "Full Event Outcome"}
              </h2>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
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
          </div>

          <div className="shrink-0 text-right">
            <span className="text-[10px] font-mono text-[#fef3c7]/40 block">Execution</span>
            <span className="text-xs font-mono font-bold text-[#fb923c]">Zero-POST</span>
          </div>
        </div>

        {/* RECEIPT VIEW: Generated QR Code & Payment URI */}
        {receipt ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#12281c]/80 border border-[#22c55e]/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#22c55e] block">
                  Shielded Bet Slip Ready
                </span>
                <span className="text-[11px] font-mono text-[#fef3c7]/60">
                  Scan with Zashi or YWallet
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-[11px] font-mono text-[#fb923c] hover:underline cursor-pointer"
              >
                Edit Bet
              </button>
            </div>

            {/* QR Code Container */}
            <div className="p-4 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col items-center justify-center">
              <div className="p-2.5 bg-white rounded-xl shadow-lg mb-3">
                <QRCodeSVG
                  value={receipt.paymentUri}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <span className="text-[11px] font-mono text-[#fef3c7]/70 text-center">
                Stake: <strong className="text-[#fef3c7]">{receipt.amountZec} ZEC</strong> on{" "}
                <strong
                  className={
                    receipt.side === "YES" ? "text-[#22c55e]" : "text-[#f87171]"
                  }
                >
                  {receipt.side}
                </strong>
              </span>
            </div>

            {/* Action Copy Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => copyToClipboard(receipt.paymentUri, "uri")}
                className="py-2.5 px-3 rounded-xl bg-[#1c120c] hover:bg-[#27150d] border border-[#7c2d12]/40 text-xs font-mono font-bold text-[#fef3c7] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedType === "uri" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied URI!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#fb923c]" />
                    <span>Copy Zcash URI</span>
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
                    <span>Copied Memo!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#fb923c]" />
                    <span>Copy 500B Memo</span>
                  </>
                )}
              </button>
            </div>

            {/* Zashi Deep Link */}
            <a
              href={receipt.paymentUri}
              className="w-full py-2.5 px-4 rounded-xl bg-[#12281c] hover:bg-[#183525] text-[#22c55e] font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-colors text-center"
            >
              <span>Open in Zashi Wallet</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <div className="text-[11px] font-mono text-[#fef3c7]/40 text-center">
              Receipt saved to your local browser storage.
            </div>
          </div>
        ) : (
          /* BET BUILDER FORM */
          <div className="space-y-4">
            {/* Mode: Buy / Sell Tab */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 text-xs font-mono font-bold text-center">
              <div className="py-1.5 rounded-lg bg-[#27150d] text-[#fb923c] border border-[#fb923c]/30">
                Buy
              </div>
              <div className="py-1.5 rounded-lg text-[#fef3c7]/40 cursor-not-allowed">
                Sell
              </div>
            </div>

            {/* YES / NO Outcome Buttons (Flat solid green & red, no glow/shadow/gradient) */}
            <div className="grid grid-cols-2 gap-2.5">
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

            {/* Stake Amount Input */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/60 mb-1.5">
                <span>Amount</span>
                <span className="text-[#fb923c] font-bold">ZEC</span>
              </div>

              <div className="relative flex items-center rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 focus-within:border-[#fb923c] transition-colors">
                <span className="pl-4 text-base font-bold font-mono text-[#fef3c7]/40 select-none">
                  ⓩ
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full py-3 px-3 bg-transparent text-xl font-bold font-mono text-[#fef3c7] outline-none placeholder-[#fef3c7]/20"
                />
                <button
                  type="button"
                  onClick={() => setStakeAmount("0")}
                  className="pr-3 text-[11px] font-mono text-[#fef3c7]/40 hover:text-[#fb923c] cursor-pointer"
                >
                  Clear
                </button>
              </div>

              {/* Preset Amount Chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {[0.05, 0.1, 0.5, 1.0, 5.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddPreset(preset)}
                    className="py-1 px-2.5 rounded-lg bg-[#1c120c] hover:bg-[#27150d] active:bg-[#140e0b] border border-[#7c2d12]/30 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors cursor-pointer"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Shielded Return Address (UA) Input */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/60 mb-1.5">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-[#fb923c]" />
                  <span>Winning Payout Return Address</span>
                </span>
              </div>
              <input
                type="text"
                value={returnAddress}
                onChange={(e) => setReturnAddress(e.target.value)}
                placeholder="utest1... or u1... unified address"
                className="w-full py-2.5 px-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 focus:border-[#fb923c] text-xs font-mono text-[#fef3c7] outline-none placeholder-[#fef3c7]/20 truncate"
              />
              <span className="text-[10px] font-mono text-[#fef3c7]/40 block mt-1">
                Encrypted with X25519 directly to the Coordinator.
              </span>
            </div>

            {/* Live Return Calculator ("To win") */}
            <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-[#fef3c7]/50 block">To win</span>
                <span className="text-lg font-bold font-mono text-[#22c55e]">
                  {potentialWinZec} ZEC
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-[#fb923c] font-bold block">
                  {multiplier}x Payout
                </span>
                <span className="text-[11px] font-mono text-[#fef3c7]/40">
                  Avg. {activeCents}¢
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#361212] border border-[#f87171]/40 text-xs font-mono text-[#f87171]">
                {error}
              </div>
            )}

            {/* Primary Action Button: Trade / Generate Slip */}
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
                  <span>Encrypting Timelock Bet...</span>
                </>
              ) : market.status !== "OPEN" ? (
                <span>Market is {market.status}</span>
              ) : (
                <span>Generate Shielded Bet</span>
              )}
            </button>

            {/* Security Notice */}
            <p className="text-[11px] font-sans text-center text-[#fef3c7]/40 leading-tight">
              By trading, you agree to the Terms of Use. Zero HTTP write requests sent from your device.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================
          PANEL 2: Related Markets Section (Matching sample screenshot)
          ======================================================== */}
      {relatedMarkets.length > 0 && (
        <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#7c2d12]/20">
            <h3 className="text-xs font-heading font-bold text-[#fef3c7] uppercase tracking-wider">
              Related Markets
            </h3>
            <span className="text-[11px] font-mono text-[#fef3c7]/40">
              {market.category || "General"}
            </span>
          </div>

          <div className="space-y-2">
            {relatedMarkets.slice(0, 4).map((rel) => {
              const relPrice = rel.ref_yes_price ?? 0.5;
              const relPct = Math.round(relPrice * 100);
              const targetSlug = rel.slug || rel.event_slug || rel.id;

              return (
                <Link
                  key={rel.id}
                  href={`/market/${targetSlug}`}
                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-[#140e0b]/80 hover:bg-[#1c120c] border border-[#7c2d12]/20 hover:border-[#fb923c]/40 transition-all group"
                >
                  <span className="text-xs font-sans text-[#fef3c7]/80 group-hover:text-[#fef3c7] line-clamp-2 flex-1">
                    {rel.title}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#fef3c7] shrink-0 min-w-[36px] text-right">
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
