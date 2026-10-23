"use client";

import React, { useEffect, useState } from "react";
import {
  Shield,
  Copy,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  generateMerkleProof,
  type MerkleProofResult,
  computeMerkleRootClient,
} from "@/lib/merkle";
import { getBetReceipts } from "@/lib/vault";

export interface AuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: string;
  marketTitle?: string;
  initialCommitment?: string;
}

export interface AuditCommitment {
  id: string;
  commitment: string;
  amount_zats: number;
  amount_zec: number;
  decrypted_side: string;
  deposit_txid: string;
  block_height: number;
}

export interface AuditData {
  market_id: string;
  title: string;
  status: string;
  outcome: string | null;
  drand_round: number | string;
  merkle_root: string | null;
  pot_address: string;
  pot_uvk: string | null;
  total_pot_zats: number;
  yes_pot_zats: number;
  no_pot_zats: number;
  total_bets: number;
  commitments: AuditCommitment[];
}

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

export function AuditDrawer({
  isOpen,
  onClose,
  marketId,
  marketTitle,
  initialCommitment,
}: AuditDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // In-browser verification state
  const [targetCommitment, setTargetCommitment] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] =
    useState<MerkleProofResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [showPathDetails, setShowPathDetails] = useState(false);

  // Read local vault receipts for quick verification chip
  const [vaultedBets, setVaultedBets] = useState<
    Array<{ commitment: string; side: string; amountZec: number }>
  >([]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCommitment) {
      setTargetCommitment(initialCommitment);
    }

    try {
      const allVault = getBetReceipts();
      const matching = allVault.filter((r) => r.marketId === marketId);
      setVaultedBets(
        matching.map((m) => ({
          commitment: m.commitment,
          side: m.side,
          amountZec: m.amountZec,
        }))
      );
    } catch {
      // Local vault access fallback
    }

    async function fetchAudit() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${COORDINATOR_URL}/api/markets/${encodeURIComponent(
            marketId
          )}/audit`
        );
        if (!res.ok) {
          throw new Error(`Coordinator returned HTTP ${res.status}`);
        }
        const data = await res.json();
        setAudit(data);

        // Auto-verify if initialCommitment provided
        if (initialCommitment && data.commitments?.length > 0) {
          handleVerifyWithData(initialCommitment, data);
        }
      } catch (err: any) {
        setError(`Failed to fetch audit data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchAudit();
  }, [isOpen, marketId, initialCommitment]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleVerifyWithData = async (
    comm: string,
    auditData: AuditData
  ) => {
    const trimmed = comm.trim();
    if (!trimmed || !auditData || auditData.commitments.length === 0) return;

    setIsVerifying(true);
    setVerificationError(null);
    try {
      const allCommitments = auditData.commitments.map((c) => c.commitment);
      const expectedRoot = auditData.merkle_root || undefined;
      const proof = await generateMerkleProof(
        allCommitments,
        trimmed,
        expectedRoot
      );

      if (!proof) {
        setVerificationError(
          `Commitment "${trimmed.slice(0, 12)}..." was not found in settled pool.`
        );
        setVerificationResult(null);
      } else {
        setVerificationResult(proof);
      }
    } catch (err: any) {
      setVerificationError(`Verification failed: ${err.message}`);
      setVerificationResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async (commitmentToVerify?: string) => {
    const comm = (commitmentToVerify || targetCommitment).trim();
    if (!comm) {
      setVerificationError("Provide a commitment hash to verify");
      setVerificationResult(null);
      return;
    }

    if (!audit || audit.commitments.length === 0) {
      setVerificationError("No commitments available in pool yet");
      setVerificationResult(null);
      return;
    }

    await handleVerifyWithData(comm, audit);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-2xl h-full bg-[#090706] border-l border-[#7c2d12]/40 shadow-2xl flex flex-col font-sans text-[#fef3c7] select-none">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#7c2d12]/30 bg-[#0e0a08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#140e0b] border border-[#7c2d12]/50 flex items-center justify-center text-[#fb923c]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-bold text-[#fef3c7] tracking-tight">
                  Merkle Audit
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#160f0c] text-[#fb923c] border border-[#7c2d12]/40">
                  {marketId}
                </span>
              </div>
              <span className="text-xs font-heading font-medium text-[#fef3c7]/60 line-clamp-1 mt-0.5">
                {audit?.title || marketTitle || "Cryptographic Audit Package"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/30 text-[#fef3c7]/70 hover:text-[#fef3c7] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="p-8 text-center font-mono text-xs text-[#fef3c7]/50">
              <span className="w-4 h-4 border-2 border-[#fb923c] border-t-transparent rounded-full inline-block animate-spin mr-2"></span>
              Fetching Merkle proof package...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-[#361212] border border-[#f87171]/40 text-[#f87171] text-xs font-mono">
              {error}
            </div>
          )}

          {audit && (
            <>
              {/* Section 1: Published Root & Pot Breakdown */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#fef3c7]/50">
                    MARKET STATUS
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                        audit.status === "SETTLED"
                          ? "bg-[#12281c] text-[#22c55e] border border-[#22c55e]/40"
                          : audit.status === "CLOSED"
                          ? "bg-[#29170e] text-[#fb923c] border border-[#fb923c]/40"
                          : "bg-[#160f0c] text-[#fb923c] border border-[#7c2d12]/40"
                      }`}
                    >
                      {audit.status}
                    </span>
                    {audit.outcome && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#160f0c] text-[#fef3c7] font-bold border border-[#7c2d12]/40">
                        Outcome: {audit.outcome}
                      </span>
                    )}
                  </div>
                </div>

                {/* Published Merkle Root */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/50">
                    <span>PUBLISHED MERKLE ROOT</span>
                    {audit.merkle_root && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(audit.merkle_root!, "root")
                        }
                        className="text-[11px] text-[#fb923c] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "root" ? (
                          <>
                            <Check className="w-3 h-3 text-[#22c55e]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Root</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 font-mono text-xs text-[#fef3c7] break-all select-all">
                    {audit.merkle_root ||
                      `Pending market close (drand round #${audit.drand_round})`}
                  </div>
                </div>

                {/* Pot UVK (Viewing Key) if Settled */}
                {audit.pot_uvk && (
                  <div className="space-y-1.5 pt-3 border-t border-[#7c2d12]/20">
                    <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/50">
                      <span>POT VIEWING KEY (UVK)</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(audit.pot_uvk!, "uvk")}
                        className="text-[11px] text-[#fb923c] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "uvk" ? (
                          <>
                            <Check className="w-3 h-3 text-[#22c55e]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy UVK</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 font-mono text-[11px] text-[#fb923c] break-all select-all">
                      {audit.pot_uvk}
                    </div>
                  </div>
                )}

                {/* Pot Tally Breakdown */}
                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-[#7c2d12]/20 text-center font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30">
                    <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
                      Total Pot
                    </span>
                    <span className="font-bold text-[#fef3c7]">
                      {(audit.total_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#12281c] border border-[#22c55e]/30">
                    <span className="text-[10px] text-[#22c55e] block uppercase">
                      YES Pot
                    </span>
                    <span className="font-bold text-[#22c55e]">
                      {(audit.yes_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#361212] border border-[#f87171]/30">
                    <span className="text-[10px] text-[#f87171] block uppercase">
                      NO Pot
                    </span>
                    <span className="font-bold text-[#f87171]">
                      {(audit.no_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: In-Browser Merkle Verifier */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#fb923c]"></span>
                    <h3 className="text-sm font-heading font-bold text-[#fef3c7]">
                      Client-Side Inclusion Verifier
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#160f0c] text-[#fef3c7]/50 border border-[#7c2d12]/30">
                    Zero Coordinator Trust
                  </span>
                </div>

                {/* Vaulted Bets Quick Chips */}
                {vaultedBets.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 space-y-2">
                    <span className="text-[11px] font-mono text-[#fef3c7]/60 block">
                      Local Vault Receipts ({vaultedBets.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {vaultedBets.map((vb) => (
                        <button
                          key={vb.commitment}
                          type="button"
                          onClick={() => {
                            setTargetCommitment(vb.commitment);
                            handleVerify(vb.commitment);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#1c120c] hover:bg-[#27150d] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7] flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span
                            className={
                              vb.side === "YES"
                                ? "text-[#22c55e] font-bold"
                                : "text-[#f87171] font-bold"
                            }
                          >
                            {vb.side}
                          </span>
                          <span>{vb.amountZec} ZEC</span>
                          <span className="text-[#fef3c7]/40">
                            {vb.commitment.slice(0, 8)}...
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commitment Input Bar */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetCommitment}
                      onChange={(e) => setTargetCommitment(e.target.value)}
                      placeholder="Paste 64-char commitment hash..."
                      className="flex-1 px-3 py-2 bg-[#140e0b] border border-[#7c2d12]/40 rounded-xl text-xs font-mono text-[#fef3c7] placeholder-[#fef3c7]/30 outline-none focus:border-[#fb923c]/70"
                    />
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerify()}
                      className="px-4 py-2 bg-[#fb923c] hover:bg-[#ea580c] disabled:opacity-50 text-[#431407] font-bold text-xs font-mono rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {isVerifying ? "Verifying..." : "Verify Proof"}
                    </button>
                  </div>
                </div>

                {/* Verification Error */}
                {verificationError && (
                  <div className="p-3 rounded-xl bg-[#361212] border border-[#f87171]/40 text-[#f87171] text-xs font-mono">
                    {verificationError}
                  </div>
                )}

                {/* Verification Success Box */}
                {verificationResult && (
                  <div className="p-4 rounded-xl bg-[#12281c] border border-[#22c55e]/40 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between text-[#22c55e] font-bold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                        <span>Proof Valid: Included in Merkle Root</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#183525] text-[#22c55e] border border-[#22c55e]/40">
                        Leaf #{verificationResult.leafIndex + 1} of{" "}
                        {verificationResult.totalLeaves}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#fef3c7]/70 space-y-1 pt-2 border-t border-[#22c55e]/20">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#fef3c7]/40">Target Commitment:</span>
                        <span className="text-[#22c55e] truncate max-w-[240px]">
                          {verificationResult.leaf}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#fef3c7]/40">Computed Root:</span>
                        <span className="text-[#fef3c7] truncate max-w-[240px]">
                          {verificationResult.computedRoot}
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Path Toggle */}
                    <div className="pt-2 border-t border-[#22c55e]/20">
                      <button
                        type="button"
                        onClick={() => setShowPathDetails(!showPathDetails)}
                        className="text-[11px] text-[#22c55e] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {showPathDetails ? "Hide" : "Inspect"} Merkle Path (
                          {verificationResult.steps.length} steps)
                        </span>
                      </button>

                      {showPathDetails && (
                        <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-[#0e0a08] border border-[#22c55e]/30 text-[10px]">
                          {verificationResult.steps.length === 0 ? (
                            <p className="text-[#fef3c7]/40">
                              Single-leaf tree: Leaf hash is directly the Merkle root.
                            </p>
                          ) : (
                            verificationResult.steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[#fef3c7]/60"
                              >
                                <span>
                                  Step {idx + 1} (Level {step.level},{" "}
                                  {step.position}):
                                </span>
                                <span className="text-[#fef3c7] truncate max-w-[200px]">
                                  {step.sibling.slice(0, 16)}...
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Commitments Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-[#fef3c7]/50 uppercase tracking-wider">
                    Commitments in Pool ({audit.commitments.length})
                  </h3>
                </div>

                {audit.commitments.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-[#0e0a08] border border-[#7c2d12]/30 text-xs text-[#fef3c7]/40 font-mono">
                    No bets recorded for this market yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#7c2d12]/30">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-[#0e0a08] text-[#fef3c7]/50 border-b border-[#7c2d12]/30 text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Commitment</th>
                          <th className="p-2.5">Side</th>
                          <th className="p-2.5">Stake</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#7c2d12]/20 bg-[#090706]">
                        {audit.commitments.map((c, idx) => {
                          const isTarget =
                            targetCommitment.toLowerCase() ===
                            c.commitment.toLowerCase();
                          return (
                            <tr
                              key={c.id || idx}
                              className={`transition-colors ${
                                isTarget
                                  ? "bg-[#24150e]"
                                  : "hover:bg-[#140e0b]"
                              }`}
                            >
                              <td className="p-2.5 text-[#fef3c7]/40">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 font-mono text-[#fef3c7] truncate max-w-[140px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCommitment(c.commitment);
                                    handleVerify(c.commitment);
                                  }}
                                  className="hover:text-[#fb923c] hover:underline text-left truncate block w-full cursor-pointer"
                                >
                                  {c.commitment.slice(0, 14)}...
                                </button>
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    c.decrypted_side === "YES"
                                      ? "bg-[#12281c] text-[#22c55e] border border-[#22c55e]/40"
                                      : c.decrypted_side === "NO"
                                      ? "bg-[#361212] text-[#f87171] border border-[#f87171]/40"
                                      : "bg-[#160f0c] text-[#fef3c7]/40 border border-[#7c2d12]/30"
                                  }`}
                                >
                                  {c.decrypted_side}
                                </span>
                              </td>
                              <td className="p-2.5 text-[#fef3c7]">
                                {c.amount_zec} ZEC
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCommitment(c.commitment);
                                    handleVerify(c.commitment);
                                  }}
                                  className="text-[11px] text-[#fb923c] hover:underline cursor-pointer"
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
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
