"use client";

import React, { useState, useMemo } from "react";
import {
  parsePolymarketUrl,
  matchPolymarketUrl,
  type MarketSummary,
  type PolymarketMatchResult,
} from "@/lib/polymarket_url";
import { useNetwork } from "@/context/NetworkContext";

interface ShieldUrlBarProps {
  markets: MarketSummary[];
  onSelectMarket?: (market: MarketSummary) => void;
  className?: string;
}

export function ShieldUrlBar({
  markets = [],
  onSelectMarket,
  className = "",
}: ShieldUrlBarProps) {
  const { currency } = useNetwork();
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // Match 100% locally in-memory — zero network calls!
  const matchResult: PolymarketMatchResult = useMemo(() => {
    if (!inputValue.trim()) {
      return {
        parsed: parsePolymarketUrl(""),
        matched: false,
        type: "NOT_FOUND",
      };
    }
    return matchPolymarketUrl(inputValue, markets);
  }, [inputValue, markets]);

  const handleSelect = (market: MarketSummary) => {
    if (onSelectMarket) {
      onSelectMarket(market);
    } else {
      window.location.href = `/market/${market.id}`;
    }
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* Outer Glow Container */}
      <div
        className={`relative transition-all duration-300 rounded-2xl p-[1px] ${
          isFocused || matchResult.matched
            ? "bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 shadow-[0_0_25px_rgba(6,182,212,0.3)]"
            : "bg-zinc-800 hover:bg-zinc-700"
        }`}
      >
        <div className="relative flex items-center bg-zinc-950/95 backdrop-blur-xl rounded-2xl px-4 py-3.5 gap-3">
          {/* Shield Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>

          {/* Search / Paste Input */}
          <div className="flex-1 flex flex-col">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 250)}
              placeholder={`Paste any Polymarket URL or slug to trade privately with shielded ${currency}...`}
              className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 text-sm md:text-base outline-none font-medium"
            />
          </div>

          {/* Clear or Quick Paste button */}
          {inputValue ? (
            <button
              onClick={() => setInputValue("")}
              className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Clear input"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (clip) setInputValue(clip);
                } catch {
                  // Ignore clipboard permissions error
                }
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
            >
              <kbd className="text-[10px]">PASTE</kbd>
            </button>
          )}
        </div>
      </div>

      {/* Zero-Leak Verification Badge */}
      {inputValue.trim() && matchResult.matched && (
        <div className="flex items-center gap-2 mt-2.5 px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-lg w-fit animate-fadeIn">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono font-medium text-emerald-300">
            Zero-Leak Local Match — 100% in-memory resolution (No network query sent)
          </span>
        </div>
      )}

      {/* Match Results Dropdown / Preview Panel */}
      {inputValue.trim() && (
        <div className="mt-3 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-slideDown">
          {matchResult.type === "SINGLE_MARKET" && matchResult.market && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                    Shielded Market Ready
                  </span>
                  {typeof matchResult.market.ref_yes_price === "number" && (
                    <span className="text-xs font-mono text-zinc-400">
                      Ref Price:{" "}
                      <span className="text-zinc-200 font-semibold">
                        {(matchResult.market.ref_yes_price * 100).toFixed(1)}¢ YES
                      </span>
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-zinc-100 leading-snug">
                  {matchResult.market.title}
                </h3>
              </div>

              <button
                onClick={() => handleSelect(matchResult.market!)}
                className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Enter Shielded Pool</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}

          {matchResult.type === "MULTI_MARKET" && matchResult.subMarkets && (
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                    Multi-Outcome Event
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-200 mt-1">
                    Select a binary outcome bracket to trade with shielded {currency}:
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {matchResult.subMarkets.length} brackets
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {matchResult.subMarkets.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => handleSelect(sub)}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800/40 transition-all text-left group"
                  >
                    <div className="flex-1 pr-3">
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-cyan-300 transition-colors">
                        {sub.group_item_title || sub.title}
                      </span>
                    </div>
                    {typeof sub.ref_yes_price === "number" && (
                      <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 shrink-0">
                        {(sub.ref_yes_price * 100).toFixed(0)}¢
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchResult.type === "NOT_FOUND" && (
            <div className="py-2 text-center text-zinc-400">
              <p className="text-sm font-medium text-zinc-300">
                No local match found for &ldquo;{matchResult.parsed.sanitized}&rdquo;
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Make sure the market is an active binary market in the top 300 volume events, or explore featured markets below.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
