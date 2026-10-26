"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import {
  Shield,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Lock,
  Unlock,
  RefreshCw,
} from "lucide-react";
import { fetchMarkets, type MarketAuditPackage } from "@/lib/market_api";
import { getBetReceipts, type PreparedBetReceipt } from "@/lib/vault";
import { generateMerkleProof, type MerkleProofResult } from "@/lib/merkle";
import type { MarketItem } from "@/app/components/MarketCard";

type StatusFilter = "ALL" | "OPEN" | "SETTLED";

export default function AuditExplorerPage() {
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Universal commitment checker
  const [queryCommitment, setQueryCommitment] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    found: boolean;
    marketId?: string;
    marketTitle?: string;
    proof?: MerkleProofResult;
    error?: string;
  } | null>(null);

  // Local vault receipts
  const [vaultReceipts, setVaultReceipts] = useState<PreparedBetReceipt[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarkets();
      setMarkets(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load markets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    try {
      setVaultReceipts(getBetReceipts());
    } catch {
      // Fallback
    }
  }, []);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleUniversalVerify = async (commitmentInput?: string) => {
    const raw = (commitmentInput || queryCommitment).trim();
    if (!raw) return;

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      // 1. Scan across markets
      for (const m of markets) {
        try {
          const res = await fetch(`/api/markets/${encodeURIComponent(m.id)}/audit`);
          if (!res.ok) continue;
          const json = await res.json();
          const audit: MarketAuditPackage = json.audit || json;
          const leaves = (audit.commitments || []).map((c) =>
            c.commitment.toLowerCase().trim()
          );

          const target = raw.toLowerCase().trim();
          if (leaves.includes(target)) {
            const proof = await generateMerkleProof(
              leaves,
              target,
              audit.merkle_root || undefined
            );
            setVerifyResult({
              found: true,
              marketId: m.id,
              marketTitle: audit.title || m.title,
              proof: proof || undefined,
            });
            setIsVerifying(false);
            return;
          }
        } catch {
          // Continue searching next market
        }
      }

      setVerifyResult({
        found: false,
        error: `Commitment "${raw.slice(0, 16)}..." was not located in any active or settled parimutuel pool.`,
      });
    } catch (err: any) {
      setVerifyResult({
        found: false,
        error: err?.message || "Failed to complete verification query",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      if (statusFilter === "OPEN" && m.status !== "OPEN") return false;
      if (statusFilter === "SETTLED" && m.status !== "SETTLED") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (m.title || "").toLowerCase().includes(q);
        const idMatch = m.id.toLowerCase().includes(q);
        const slugMatch = (m.slug || "").toLowerCase().includes(q);
        if (!titleMatch && !idMatch && !slugMatch) return false;
      }
      return true;
    });
  }, [markets, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Strip */}
        <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#140e0b] border border-[#7c2d12]/50 flex items-center justify-center text-[#fb923c] shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-[#fef3c7]">
                  Merkle Audit Explorer
                </h1>
                <span className="text-xs font-mono text-[#fef3c7]/50 block mt-0.5">
                  Cryptographic verification of Zero-POST parimutuel pools & Drand beacon rounds
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="py-1.5 px-3 rounded-xl bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh market audits"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#fb923c]" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Universal Commitment Lookup Card */}
        <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#fb923c]" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#fef3c7]">
                Universal Commitment Verifier
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#fef3c7]/40">
              SHA-256 Merkle Inclusion Proof
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUniversalVerify();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={queryCommitment}
                onChange={(e) => setQueryCommitment(e.target.value)}
                placeholder="Paste 64-character commitment hash (e.g. 28ead8867f...c8f1ec)"
                className="w-full px-4 py-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/35 focus:border-[#fb923c] focus:ring-1 focus:ring-[#fb923c]/40 text-xs font-mono text-[#fef3c7] placeholder:text-[#fef3c7]/30 transition-all outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying || !queryCommitment.trim()}
              className="py-2.5 px-5 rounded-xl bg-[#12281c] hover:bg-[#183525] disabled:bg-[#140e0b] border border-[#22c55e]/40 disabled:border-[#7c2d12]/30 text-xs font-mono text-[#22c55e] disabled:text-[#fef3c7]/30 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verify Commitment</span>
                </>
              )}
            </button>
          </form>

          {/* Quick-select chips from user's local vault */}
          {vaultReceipts.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <span className="text-[#fef3c7]/40 text-[11px]">From Your Vault:</span>
              {vaultReceipts.slice(0, 3).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setQueryCommitment(r.commitment);
                    handleUniversalVerify(r.commitment);
                  }}
                  className="py-0.5 px-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] border border-[#7c2d12]/30 text-[11px] text-[#fb923c] transition-colors cursor-pointer"
                  title={r.marketTitle}
                >
                  {r.commitment.slice(0, 10)}...{r.commitment.slice(-4)} ({r.side})
                </button>
              ))}
            </div>
          )}

          {/* Verification Result Output */}
          {verifyResult && (
            <div
              className={`p-4 rounded-xl border font-mono text-xs space-y-2 mt-4 ${
                verifyResult.found
                  ? "bg-[#12281c]/50 border-[#22c55e]/50 text-[#22c55e]"
                  : "bg-[#361212]/50 border-[#f87171]/50 text-[#f87171]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold">
                  {verifyResult.found ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valid Merkle Inclusion Proof Confirmed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      <span>Commitment Not Found</span>
                    </>
                  )}
                </div>

                {verifyResult.found && verifyResult.marketId && (
                  <Link
                    href={`/audit/${verifyResult.marketId}`}
                    className="flex items-center gap-1 text-[#fef3c7] hover:text-[#fb923c] underline text-[11px] transition-colors"
                  >
                    <span>View Market Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {verifyResult.found ? (
                <div className="text-[11px] text-[#fef3c7]/80 space-y-1 pt-1 border-t border-[#22c55e]/20">
                  <div>Market: <span className="text-[#fef3c7] font-semibold">{verifyResult.marketTitle}</span></div>
                  <div>Root: <span className="text-[#fb923c]">{verifyResult.proof?.computedRoot}</span></div>
                  <div>Leaf Index: #{verifyResult.proof?.leafIndex} ({verifyResult.proof?.steps.length} proof steps)</div>
                </div>
              ) : (
                <p className="text-[11px] text-[#f87171]/90">
                  {verifyResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Auditable Markets Ledger */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-heading font-bold text-[#fef3c7]">
                Market Audit Ledgers
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#140e0b] border border-[#7c2d12]/40 text-[#fb923c]">
                {filteredMarkets.length}
              </span>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 font-mono text-xs">
                {(["ALL", "OPEN", "SETTLED"] as StatusFilter[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      statusFilter === tab
                        ? "bg-[#24150e] text-[#fb923c] font-bold"
                        : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter markets..."
                  className="px-3 py-1.5 pl-8 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7] placeholder:text-[#fef3c7]/30 focus:border-[#fb923c] outline-none w-40 sm:w-52"
                />
                <Search className="w-3.5 h-3.5 text-[#fef3c7]/40 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Grid of Markets */}
          {filteredMarkets.length === 0 ? (
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-12 text-center text-sm font-mono text-[#fef3c7]/40">
              No matching markets located.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMarkets.map((m) => {
                const isSettled = m.status === "SETTLED";
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 hover:border-[#fb923c]/50 p-5 space-y-3.5 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isSettled
                              ? "bg-[#12281c] text-[#22c55e] border-[#22c55e]/40"
                              : "bg-[#24150e] text-[#fb923c] border-[#fb923c]/40"
                          }`}
                        >
                          {isSettled ? (
                            <span className="flex items-center gap-1">
                              <Unlock className="w-3 h-3" /> SETTLED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> OPEN (SEALED)
                            </span>
                          )}
                        </span>

                        <span className="text-xs font-mono text-[#fef3c7]/40">
                          Round #{m.drand_round}
                        </span>
                      </div>

                      <Link
                        href={`/audit/${m.id}`}
                        className="text-base font-heading font-semibold text-[#fef3c7] hover:text-[#fb923c] transition-colors line-clamp-2 block"
                      >
                        {m.title}
                      </Link>
                    </div>

                    <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/20 font-mono text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[#fef3c7]/70">
                        <span className="text-[#fef3c7]/40">Parimutuel Pot</span>
                        <span className="font-bold text-[#fef3c7]">
                          {isSettled
                            ? `${((m.total_pot_zats || 0) / 100_000_000).toFixed(2)} ZEC`
                            : "Sealed Pool"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[#fef3c7]/70">
                        <span className="text-[#fef3c7]/40">Pot Address</span>
                        {m.pot_address ? (
                          <button
                            type="button"
                            onClick={() => copyText(m.pot_address!, `${m.id}-pot`)}
                            className="flex items-center gap-1 hover:text-[#fb923c] transition-colors cursor-pointer"
                            title="Copy pot address"
                          >
                            <span>
                              {m.pot_address.slice(0, 8)}...{m.pot_address.slice(-6)}
                            </span>
                            {copiedKey === `${m.id}-pot` ? (
                              <Check className="w-3 h-3 text-[#22c55e]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#fef3c7]/40" />
                            )}
                          </button>
                        ) : (
                          <span className="text-[#fef3c7]/40">Zero-POST Pot</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#7c2d12]/20 flex items-center justify-between">
                      <span className="text-xs font-mono text-[#fef3c7]/50">
                        Market #{m.id}
                      </span>
                      <Link
                        href={`/audit/${m.id}`}
                        className="py-1.5 px-3 rounded-xl bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/40 text-xs font-mono text-[#fb923c] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Inspect Merkle Proof</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
