"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import {
  Shield,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ArrowLeft,
  Download,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Binary,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  fetchMarketAudit,
  type MarketAuditPackage,
  type AuditCommitmentItem,
} from "@/lib/market_api";
import {
  generateMerkleProof,
  type MerkleProofResult,
  verifyMerkleProof,
} from "@/lib/merkle";
import { getBetReceipts } from "@/lib/vault";

export default function MarketAuditPage() {
  const params = useParams();
  const marketId = (params?.marketId as string) || "";

  const [audit, setAudit] = useState<MarketAuditPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // In-browser verification state
  const [targetCommitment, setTargetCommitment] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<MerkleProofResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showProofTrace, setShowProofTrace] = useState(false);

  // Search & filter commitments table
  const [searchCommitment, setSearchCommitment] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "YES" | "NO" | "SEALED">("ALL");

  // Local vault receipts for this market
  const [vaultCommitments, setVaultCommitments] = useState<
    Array<{ commitment: string; side: string; amountZec: number }>
  >([]);

  const loadAuditData = async () => {
    if (!marketId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketAudit(marketId);
      setAudit(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit package");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();

    try {
      const receipts = getBetReceipts();
      const matching = receipts.filter(
        (r) => r.marketId.toLowerCase() === marketId.toLowerCase()
      );
      setVaultCommitments(
        matching.map((m) => ({
          commitment: m.commitment,
          side: m.side,
          amountZec: m.amountZec,
        }))
      );
      if (matching.length > 0 && !targetCommitment) {
        setTargetCommitment(matching[0].commitment);
      }
    } catch {
      // Local vault fallback
    }
  }, [marketId]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleVerify = async (commToVerify?: string) => {
    const raw = (commToVerify || targetCommitment).trim();
    if (!raw) {
      setVerificationError("Provide a commitment hash to verify");
      setVerificationResult(null);
      return;
    }

    if (!audit || !audit.commitments || audit.commitments.length === 0) {
      setVerificationError("No commitments registered in this pool yet");
      setVerificationResult(null);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const allCommitments = audit.commitments.map((c) =>
        c.commitment.toLowerCase().trim()
      );
      const target = raw.toLowerCase().trim();
      const expectedRoot = audit.merkle_root || undefined;

      const proof = await generateMerkleProof(
        allCommitments,
        target,
        expectedRoot
      );

      if (!proof) {
        setVerificationError(
          `Commitment "${raw.slice(0, 16)}..." was not found in the coordinator Merkle tree.`
        );
        setVerificationResult(null);
      } else {
        const isValid = await verifyMerkleProof(
          target,
          proof.steps,
          expectedRoot || proof.computedRoot
        );
        if (isValid) {
          setVerificationResult(proof);
        } else {
          setVerificationError(
            "Merkle proof evaluation failed: computed root did not match published root."
          );
          setVerificationResult(null);
        }
      }
    } catch (err: any) {
      setVerificationError(`Verification error: ${err.message}`);
      setVerificationResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownloadBundle = () => {
    if (!audit) return;
    const jsonStr = JSON.stringify(audit, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nocturne-audit-${marketId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredCommitments = useMemo(() => {
    if (!audit?.commitments) return [];
    return audit.commitments.filter((c) => {
      if (sideFilter === "YES" && c.decrypted_side !== "YES") return false;
      if (sideFilter === "NO" && c.decrypted_side !== "NO") return false;
      if (sideFilter === "SEALED" && c.decrypted_side !== "SEALED") return false;
      if (searchCommitment.trim()) {
        const q = searchCommitment.toLowerCase().trim();
        const matchHash = c.commitment.toLowerCase().includes(q);
        const matchId = c.id.toLowerCase().includes(q);
        const matchTx = (c.deposit_txid || "").toLowerCase().includes(q);
        if (!matchHash && !matchId && !matchTx) return false;
      }
      return true;
    });
  }, [audit?.commitments, sideFilter, searchCommitment]);

  const isSettled = audit?.status === "SETTLED";

  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb & Download Action */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-mono">
            <Link
              href="/audit"
              className="flex items-center gap-1.5 text-[#fef3c7]/60 hover:text-[#fb923c] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Audit Explorer</span>
            </Link>
            <span className="text-[#fef3c7]/20">/</span>
            <span className="text-[#fb923c]">{marketId}</span>
          </div>

          <button
            type="button"
            onClick={handleDownloadBundle}
            disabled={!audit}
            className="py-1.5 px-3 rounded-xl bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Download full JSON audit package"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Audit Bundle</span>
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-12 text-center text-xs font-mono text-[#fef3c7]/50 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#fb923c]" />
            <span>Fetching cryptographic audit package for Market #{marketId}...</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-[#361212]/50 border border-[#f87171]/40 p-6 font-mono text-xs text-[#f87171] space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to load audit package</span>
            </div>
            <p className="text-[#f87171]/80">{error}</p>
          </div>
        )}

        {audit && (
          <>
            {/* Market Header Card */}
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-6 space-y-4 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
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
                          <Lock className="w-3 h-3" /> OPEN (PARIMUTUEL SEALED)
                        </span>
                      )}
                    </span>

                    {audit.outcome && (
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#12281c] text-[#22c55e] border border-[#22c55e]/40">
                        OUTCOME: {audit.outcome}
                      </span>
                    )}

                    <span className="text-xs font-mono text-[#fef3c7]/40">
                      Category: {audit.category || "General"}
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#fef3c7] leading-snug">
                    {audit.title}
                  </h1>
                </div>

                <div className="flex md:flex-col items-end gap-1.5 font-mono text-xs shrink-0">
                  <span className="text-[#fef3c7]/40">Drand Beacon Round</span>
                  <a
                    href={`https://api.drand.sh/52db929800c74d437c15c5e7aacaff52060217f46343b84766e4742150ea6da9/public/${audit.drand_round}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fb923c] hover:underline flex items-center gap-1"
                  >
                    <span>#{audit.drand_round}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Pot Address & Details Strip */}
              <div className="pt-3 border-t border-[#7c2d12]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-[#fef3c7]/40">Pot Address:</span>
                  <span className="text-[#fef3c7]/90 font-medium">
                    {audit.pot_address.slice(0, 16)}...{audit.pot_address.slice(-10)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(audit.pot_address, "pot_addr")}
                    className="p-1 text-[#fef3c7]/40 hover:text-[#fb923c] transition-colors"
                    title="Copy full pot address"
                  >
                    {copiedKey === "pot_addr" ? (
                      <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="text-[#fef3c7]/50">
                  Total Commitments Sealed: <span className="text-[#fef3c7] font-bold">{audit.total_bets}</span>
                </div>
              </div>
            </div>

            {/* Cryptographic Primitives & Pot Transparency Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              {/* Card 1: Merkle Root */}
              <div className="p-4 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#fef3c7]/40 uppercase tracking-wider">
                    Published Merkle Root
                  </span>
                  <Binary className="w-4 h-4 text-[#fb923c]" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#fef3c7] font-semibold break-all text-[11px]">
                    {audit.merkle_root
                      ? `${audit.merkle_root.slice(0, 16)}...${audit.merkle_root.slice(-10)}`
                      : "Awaiting tree construction"}
                  </span>
                  {audit.merkle_root && (
                    <button
                      type="button"
                      onClick={() => copyText(audit.merkle_root!, "m_root")}
                      className="text-[#fef3c7]/40 hover:text-[#fb923c]"
                      title="Copy full 64-char Merkle root"
                    >
                      {copiedKey === "m_root" ? (
                        <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Pot Balance Breakdown */}
              <div className="p-4 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#fef3c7]/40 uppercase tracking-wider">
                    Parimutuel Pot State
                  </span>
                  <Layers className="w-4 h-4 text-[#fb923c]" />
                </div>
                <div>
                  {isSettled ? (
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[#fef3c7]">
                        {((audit.total_pot_zats || 0) / 100_000_000).toFixed(4)} ZEC
                      </div>
                      <div className="text-[10px] text-[#fef3c7]/60 flex items-center justify-between">
                        <span>YES: {((audit.yes_pot_zats || 0) / 100_000_000).toFixed(2)} ZEC</span>
                        <span>NO: {((audit.no_pot_zats || 0) / 100_000_000).toFixed(2)} ZEC</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-[#fb923c]">
                        SEALED WHILE OPEN
                      </div>
                      <p className="text-[10px] text-[#fef3c7]/50">
                        Side pots remain hidden to prevent order-book manipulation
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Pot Unified Viewing Key (UVK) */}
              <div className="p-4 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#fef3c7]/40 uppercase tracking-wider">
                    Pot Unified Viewing Key (UVK)
                  </span>
                  {isSettled ? (
                    <Unlock className="w-4 h-4 text-[#22c55e]" />
                  ) : (
                    <Lock className="w-4 h-4 text-[#fb923c]" />
                  )}
                </div>
                {audit.pot_uvk ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#22c55e] font-semibold break-all text-[11px]">
                      {audit.pot_uvk.slice(0, 16)}...{audit.pot_uvk.slice(-8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(audit.pot_uvk!, "pot_uvk")}
                      className="text-[#fef3c7]/40 hover:text-[#fb923c]"
                      title="Copy public pot UVK"
                    >
                      {copiedKey === "pot_uvk" ? (
                        <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="text-[11px] text-[#fb923c] font-medium block">
                      Protected Viewing Key
                    </span>
                    <span className="text-[10px] text-[#fef3c7]/50 block">
                      Published automatically upon market settlement
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Client-Side Merkle Proof Engine */}
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#fb923c]" />
                  <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#fef3c7]">
                    In-Browser Merkle Proof Verifier
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-[#fef3c7]/40">
                  Client-side SHA-256 validation
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={targetCommitment}
                    onChange={(e) => setTargetCommitment(e.target.value)}
                    placeholder="Enter 64-char commitment hash..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/35 focus:border-[#fb923c] focus:ring-1 focus:ring-[#fb923c]/40 text-xs font-mono text-[#fef3c7] placeholder:text-[#fef3c7]/30 transition-all outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerify()}
                  disabled={isVerifying || !targetCommitment.trim()}
                  className="py-2.5 px-5 rounded-xl bg-[#12281c] hover:bg-[#183525] disabled:bg-[#140e0b] border border-[#22c55e]/40 disabled:border-[#7c2d12]/30 text-xs font-mono text-[#22c55e] disabled:text-[#fef3c7]/30 font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Computing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify Inclusion</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick-verify chips from user's vault */}
              {vaultCommitments.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  <span className="text-[#fef3c7]/40 text-[11px]">Your Vault Receipts:</span>
                  {vaultCommitments.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setTargetCommitment(v.commitment);
                        handleVerify(v.commitment);
                      }}
                      className="py-0.5 px-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] border border-[#7c2d12]/30 text-[11px] text-[#fb923c] transition-colors cursor-pointer"
                    >
                      {v.commitment.slice(0, 10)}...{v.commitment.slice(-4)} ({v.side})
                    </button>
                  ))}
                </div>
              )}

              {/* Proof Result Display */}
              {verificationResult && (
                <div className="p-4 rounded-xl bg-[#12281c]/50 border border-[#22c55e]/50 font-mono text-xs text-[#22c55e] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Merkle Inclusion Proof Verified Successfully</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowProofTrace(!showProofTrace)}
                      className="flex items-center gap-1 text-[11px] text-[#fef3c7]/70 hover:text-[#fef3c7] transition-colors cursor-pointer"
                    >
                      <span>{showProofTrace ? "Hide Trace" : "View Proof Trace"}</span>
                      {showProofTrace ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[#fef3c7]/80 pt-2 border-t border-[#22c55e]/20">
                    <div>Leaf Index: <span className="text-[#fef3c7] font-bold">#{verificationResult.leafIndex}</span></div>
                    <div>Proof Steps: <span className="text-[#fef3c7] font-bold">{verificationResult.steps.length}</span></div>
                    <div>Root Match: <span className="text-[#22c55e] font-bold">VALID (100%)</span></div>
                  </div>

                  {/* Sibling Path Breakdown */}
                  {showProofTrace && (
                    <div className="p-3 rounded-lg bg-[#0e0a08] border border-[#22c55e]/25 space-y-2 text-[10px] text-[#fef3c7]/70">
                      <div className="font-bold text-[#fef3c7] text-[11px]">
                        Cryptographic Hash Path Trace:
                      </div>
                      {verificationResult.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-1.5 rounded bg-[#140e0b] border border-[#7c2d12]/20"
                        >
                          <span className="text-[#fb923c] shrink-0">Level {idx}:</span>
                          <span className="text-[#fef3c7]/50 shrink-0">Position: {step.position}</span>
                          <span className="break-all font-mono text-[9px] text-[#fef3c7]/80">
                            Sibling: {step.sibling.slice(0, 20)}...{step.sibling.slice(-8)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-1 text-[11px] text-[#fb923c]">
                        Computed Root: {verificationResult.computedRoot}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {verificationError && (
                <div className="p-4 rounded-xl bg-[#361212]/50 border border-[#f87171]/50 font-mono text-xs text-[#f87171] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{verificationError}</span>
                </div>
              )}
            </div>

            {/* All Commitments Ledger Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-heading font-bold text-[#fef3c7]">
                    Commitment Ledger
                  </h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#140e0b] border border-[#7c2d12]/40 text-[#fb923c]">
                    {filteredCommitments.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Filter Side Pills */}
                  <div className="flex items-center p-1 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 font-mono text-xs">
                    {(["ALL", "YES", "NO", "SEALED"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSideFilter(tab)}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          sideFilter === tab
                            ? "bg-[#24150e] text-[#fb923c] font-bold"
                            : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Filter Hash Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchCommitment}
                      onChange={(e) => setSearchCommitment(e.target.value)}
                      placeholder="Filter commitments..."
                      className="px-3 py-1.5 pl-8 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7] placeholder:text-[#fef3c7]/30 focus:border-[#fb923c] outline-none w-40 sm:w-48"
                    />
                    <Search className="w-3.5 h-3.5 text-[#fef3c7]/40 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {filteredCommitments.length === 0 ? (
                <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-12 text-center text-xs font-mono text-[#fef3c7]/40">
                  No matching commitments found in this ledger.
                </div>
              ) : (
                <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 overflow-hidden shadow-xl font-mono text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#7c2d12]/30 bg-[#140e0b] text-[10px] uppercase text-[#fef3c7]/40">
                          <th className="py-3 px-4">#</th>
                          <th className="py-3 px-4">Commitment Hash</th>
                          <th className="py-3 px-4">Side</th>
                          <th className="py-3 px-4">Amount</th>
                          <th className="py-3 px-4">Block Height</th>
                          <th className="py-3 px-4">Deposit TxID</th>
                          <th className="py-3 px-4 text-right">Inclusion Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#7c2d12]/15">
                        {filteredCommitments.map((c, idx) => {
                          const isTarget =
                            targetCommitment.toLowerCase().trim() ===
                            c.commitment.toLowerCase().trim();
                          return (
                            <tr
                              key={c.id || idx}
                              className={`hover:bg-[#140e0b]/80 transition-colors ${
                                isTarget ? "bg-[#24150e]/60" : ""
                              }`}
                            >
                              <td className="py-3 px-4 text-[#fef3c7]/40">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-[#fef3c7]">
                                    {c.commitment.slice(0, 10)}...{c.commitment.slice(-6)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyText(c.commitment, `comm-${idx}`)}
                                    className="text-[#fef3c7]/40 hover:text-[#fb923c] transition-colors cursor-pointer"
                                    title="Copy commitment hash"
                                  >
                                    {copiedKey === `comm-${idx}` ? (
                                      <Check className="w-3 h-3 text-[#22c55e]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    c.decrypted_side === "YES"
                                      ? "bg-[#12281c] text-[#22c55e] border-[#22c55e]/40"
                                      : c.decrypted_side === "NO"
                                      ? "bg-[#361212] text-[#f87171] border-[#f87171]/40"
                                      : "bg-[#24150e] text-[#fb923c] border-[#fb923c]/40"
                                  }`}
                                >
                                  {c.decrypted_side}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[#fef3c7]/70">
                                {c.amount_zec !== null && c.amount_zec !== undefined
                                  ? `${c.amount_zec.toFixed(4)} ZEC`
                                  : "SEALED"}
                              </td>
                              <td className="py-3 px-4 text-[#fef3c7]/50">
                                {c.block_height ? `#${c.block_height}` : "-"}
                              </td>
                              <td className="py-3 px-4 text-[#fef3c7]/50">
                                {c.deposit_txid ? (
                                  <span className="font-mono text-[11px] text-[#fef3c7]/70">
                                    {c.deposit_txid.slice(0, 8)}...{c.deposit_txid.slice(-4)}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCommitment(c.commitment);
                                    handleVerify(c.commitment);
                                  }}
                                  className="py-1 px-2.5 rounded-lg bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/35 text-[11px] text-[#fb923c] font-semibold transition-colors cursor-pointer"
                                >
                                  Verify
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
