"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BetSlipModal } from "./BetSlipModal";
import { MyBetsDrawer } from "./MyBetsDrawer";
import { AuditDrawer } from "./AuditDrawer";
import type { BetSide } from "@/lib/bet_builder";

export interface MarketTradeViewProps {
  market: {
    id: string;
    title: string;
    status: string;
    close_time: number;
    drand_round: string | number;
    pot_address: string;
    coordinator_public_key: string;
    total_pot_zec: number;
    yes_pot_zec: number;
    no_pot_zec: number;
    ref_yes_price?: number | null;
  };
}

export function MarketTradeView({ market }: MarketTradeViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSide, setSelectedSide] = useState<BetSide>("YES");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const openBetModal = (side: BetSide) => {
    setSelectedSide(side);
    setModalOpen(true);
  };

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const side = params.get("side");
      if (side) {
        const upper = side.toUpperCase();
        if (upper === "YES" || upper === "NO") {
          setSelectedSide(upper as BetSide);
          setModalOpen(true);
        }
      }
    }
  }, []);

  const closeDateStr = new Date(market.close_time * 1000).toLocaleString();
  const isOpenForTrading = market.status === "OPEN";

  return (
    <div className="w-full max-w-3xl font-sans">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <span>← Back to Markets</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 hover:border-cyan-500/50 text-xs font-mono text-zinc-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
          >
            <span>Public Audit & Proofs</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>My Private Bets</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>SHIELDED POOL: {market.status}</span>
          </div>
        </div>
      </div>

      {/* Main Market Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
            ID: {market.id}
          </span>
          {market.ref_yes_price !== null &&
            market.ref_yes_price !== undefined && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                Polymarket Ref: {(market.ref_yes_price * 100).toFixed(1)}¢ YES
              </span>
            )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight mb-4">
          {market.title}
        </h1>

        {/* Pot Metrics */}
        <div className="grid grid-cols-3 gap-3 my-6">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-xs font-mono text-zinc-500 block mb-1">
              TOTAL POT
            </span>
            <span className="text-lg md:text-xl font-bold font-mono text-white">
              {market.total_pot_zec.toFixed(4)}{" "}
              <span className="text-xs text-zinc-400 font-normal">ZEC</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20">
            <span className="text-xs font-mono text-emerald-400 block mb-1">
              YES POT
            </span>
            <span className="text-lg md:text-xl font-bold font-mono text-emerald-300">
              {market.yes_pot_zec.toFixed(4)}{" "}
              <span className="text-xs text-emerald-500 font-normal">ZEC</span>
            </span>
          </div>

          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/20">
            <span className="text-xs font-mono text-rose-400 block mb-1">
              NO POT
            </span>
            <span className="text-lg md:text-xl font-bold font-mono text-rose-300">
              {market.no_pot_zec.toFixed(4)}{" "}
              <span className="text-xs text-rose-500 font-normal">ZEC</span>
            </span>
          </div>
        </div>

        {/* Action Trade Buttons */}
        {isOpenForTrading ? (
          <div className="grid grid-cols-2 gap-4 my-6">
            <button
              type="button"
              onClick={() => openBetModal("YES")}
              className="py-4 px-6 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-bold text-base transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-950/20"
            >
              <div className="flex items-center gap-2">
                <span>Trade Private YES</span>
                <span>🛡️</span>
              </div>
              <span className="text-xs font-mono font-normal text-emerald-400/80">
                Sealed Timelock Bet
              </span>
            </button>

            <button
              type="button"
              onClick={() => openBetModal("NO")}
              className="py-4 px-6 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 hover:border-rose-400 text-rose-300 font-bold text-base transition-all flex flex-col items-center justify-center gap-1 shadow-lg shadow-rose-950/20"
            >
              <div className="flex items-center gap-2">
                <span>Trade Private NO</span>
                <span>🛡️</span>
              </div>
              <span className="text-xs font-mono font-normal text-rose-400/80">
                Sealed Timelock Bet
              </span>
            </button>
          </div>
        ) : (
          <div className="p-4 my-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center font-mono text-xs text-zinc-400">
            Market is {market.status}. Betting is closed for this pool.
          </div>
        )}

        {/* Technical & Audit Parameters */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2 text-xs font-mono text-zinc-400">
          <div className="flex justify-between">
            <span>Closing Time:</span>
            <span className="text-zinc-200">{closeDateStr}</span>
          </div>
          <div className="flex justify-between">
            <span>drand Quicknet Round:</span>
            <span className="text-zinc-200">#{market.drand_round}</span>
          </div>
          <div className="flex justify-between">
            <span>Settlement Coordinator Key:</span>
            <span className="text-zinc-400 truncate max-w-[200px]">
              {market.coordinator_public_key?.slice(0, 16)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span>Pot Unified Address:</span>
            <span className="text-cyan-400 truncate max-w-[240px]">
              {market.pot_address}
            </span>
          </div>

          <div className="pt-2 border-t border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={() => setAuditOpen(true)}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
            >
              <span>Inspect Merkle Root & Inclusion Proofs →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Zero-POST Security Callout */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-cyan-500/20 rounded-2xl p-6 text-center shadow-xl">
        <h2 className="text-sm font-bold text-white mb-1">
          Zero-POST Shielded Architecture
        </h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Scan with Zashi or YWallet. Bets are sealed with timelock encryption
          and return addresses are boxed with X25519 directly to the
          Coordinator. Zero HTTP write requests sent from your device.
        </p>
      </div>

      {/* Bet Slip Modal */}
      <BetSlipModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        market={market}
        initialSide={selectedSide}
      />

      {/* My Bets Drawer */}
      <MyBetsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Public Audit Drawer */}
      <AuditDrawer
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
        marketId={market.id}
        marketTitle={market.title}
      />
    </div>
  );
}
