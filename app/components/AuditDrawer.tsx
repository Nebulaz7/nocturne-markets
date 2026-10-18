"use client";

import React, { useEffect, useState } from "react";
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
  "http://127.0.0.1:3001";

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

  // Verifier State
  const [targetCommitment, setTargetCommitment] = useState<string>("");
  const [verificationResult, setVerificationResult] =
    useState<MerkleProofResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showPathDetails, setShowPathDetails] = useState<boolean>(false);

  // User's vaulted bets for this market
  const [vaultedBets, setVaultedBets] = useState<
    { commitment: string; side: string; amountZec: number }[]
  >([]);

  useEffect(() => {
    if (!isOpen || !marketId) return;

    // Load matching vaulted bets for this market
    const allVault = getBetReceipts();
    const matching = allVault
      .filter((b) => String(b.marketId) === String(marketId))
      .map((b) => ({
        commitment: b.commitment,
        side: b.side,
        amountZec: b.amountZec,
      }));
    setVaultedBets(matching);

    // Set initial target commitment if passed or available in vault
    if (initialCommitment) {
      setTargetCommitment(initialCommitment);
    } else if (matching.length > 0) {
      setTargetCommitment(matching[0].commitment);
    }

    // Reset verification result
    setVerificationResult(null);
    setVerificationError(null);

    // Fetch live audit data
    async function fetchAudit() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${COORDINATOR_URL}/api/markets/${encodeURIComponent(marketId)}/audit`
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        setAudit(data.audit);
      } catch (err: any) {
        setError(`Failed to fetch audit package: ${err.message}`);
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

  const handleVerify = async (commitmentToVerify?: string) => {
    const comm = (commitmentToVerify || targetCommitment).trim();
    if (!comm) {
      setVerificationError("Please enter or select a commitment hash to verify");
      setVerificationResult(null);
      return;
    }

    if (!audit || audit.commitments.length === 0) {
      setVerificationError("No commitments available in this pool yet");
      setVerificationResult(null);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    try {
      const allCommitments = audit.commitments.map((c) => c.commitment);
      const expectedRoot = audit.merkle_root || undefined;

      const proof = await generateMerkleProof(
        allCommitments,
        comm,
        expectedRoot
      );

      if (!proof) {
        setVerificationError(
          `Commitment "${comm.slice(
            0,
            12
          )}..." was NOT found in this market's settled pool.`
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col font-sans text-zinc-100">
        {/* Wireframe Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-semibold">
                PUBLIC MERKLE AUDIT
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ID: {marketId}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-white line-clamp-1 mt-1">
              {audit?.title || marketTitle || "Market Audit Package"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="p-8 text-center font-mono text-xs text-zinc-500">
              <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full inline-block animate-spin mr-2"></span>
              Fetching cryptographic audit package...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {audit && (
            <>
              {/* Section 1: Audit Parameters & Published Keys */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-zinc-400">
                    MARKET STATUS
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded font-bold ${
                        audit.status === "SETTLED"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : audit.status === "CLOSED"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                      }`}
                    >
                      {audit.status}
                    </span>
                    {audit.outcome && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-white font-bold border border-zinc-700">
                        OUTCOME: {audit.outcome}
                      </span>
                    )}
                  </div>
                </div>

                {/* Published Merkle Root */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span>PUBLISHED MERKLE ROOT (SHA-256)</span>
                    {audit.merkle_root && (
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(audit.merkle_root!, "root")
                        }
                        className="text-[10px] text-cyan-400 hover:underline"
                      >
                        {copiedKey === "root" ? "✔ Copied" : "Copy Root"}
                      </button>
                    )}
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 font-mono text-xs text-zinc-200 break-all select-all">
                    {audit.merkle_root ||
                      "Pending market close (drand round #" +
                        audit.drand_round +
                        ")"}
                  </div>
                </div>

                {/* Pot UVK (Viewing Key) if Settled */}
                {audit.pot_uvk && (
                  <div className="space-y-1 pt-2 border-t border-zinc-800">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                      <span>PUBLISHED POT VIEWING KEY (UVK)</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(audit.pot_uvk!, "uvk")}
                        className="text-[10px] text-cyan-400 hover:underline"
                      >
                        {copiedKey === "uvk" ? "✔ Copied" : "Copy UVK"}
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 font-mono text-[11px] text-cyan-300 break-all select-all">
                      {audit.pot_uvk}
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      🔒 Public audit key: anyone can scan the testnet chain to
                      verify pot deposits without decrypting bettor return
                      addresses.
                    </p>
                  </div>
                )}

                {/* Pot Tally Breakdown */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800 text-center font-mono text-xs">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 block">
                      TOTAL POT
                    </span>
                    <span className="font-bold text-white">
                      {(audit.total_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                    <span className="text-[10px] text-emerald-400 block">
                      YES POT
                    </span>
                    <span className="font-bold text-emerald-300">
                      {(audit.yes_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-900/40">
                    <span className="text-[10px] text-rose-400 block">
                      NO POT
                    </span>
                    <span className="font-bold text-rose-300">
                      {(audit.no_pot_zats / 100_000_000).toFixed(2)} ZEC
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Interactive Client-Side Merkle Verifier */}
              <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Client-Side Inclusion Verifier
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    Zero-Coordinator-Trust
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Cryptographically proves your bet was included in the pool
                  using in-browser WebCrypto SHA-256. If any commitment was
                  altered or omitted, verification fails instantly.
                </p>

                {/* Vaulted Bets Shortcut */}
                {vaultedBets.length > 0 && (
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 space-y-2">
                    <span className="text-[11px] font-mono text-cyan-300 block">
                      Detected {vaultedBets.length} bet(s) in your local vault
                      for this market:
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
                          className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors"
                        >
                          <span
                            className={
                              vb.side === "YES"
                                ? "text-emerald-400 font-bold"
                                : "text-rose-400 font-bold"
                            }
                          >
                            {vb.side}
                          </span>
                          <span>({vb.amountZec} ZEC)</span>
                          <span className="text-zinc-500">
                            {vb.commitment.slice(0, 8)}...
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commitment Input Bar */}
                <div className="space-y-2">
                  <label className="block text-xs font-mono text-zinc-400">
                    COMMITMENT HASH TO VERIFY (32-BYTE SHA-256 HEX)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetCommitment}
                      onChange={(e) => setTargetCommitment(e.target.value)}
                      placeholder="Paste 64-character commitment hash..."
                      className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => handleVerify()}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold text-xs font-mono rounded-xl transition-colors whitespace-nowrap"
                    >
                      {isVerifying ? "Verifying..." : "Verify Proof"}
                    </button>
                  </div>
                </div>

                {/* Verification Error */}
                {verificationError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    {verificationError}
                  </div>
                )}

                {/* Verification Success Box */}
                {verificationResult && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between text-emerald-300 font-bold">
                      <div className="flex items-center gap-2">
                        <span>✔ PROOF VALID: INCLUDED IN MERKLE ROOT</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200">
                        Leaf #{verificationResult.leafIndex + 1} of{" "}
                        {verificationResult.totalLeaves}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-300 space-y-1 pt-1 border-t border-emerald-900/40">
                      <div className="flex justify-between">
                        <span>Target Commitment:</span>
                        <span className="text-emerald-400 truncate max-w-[240px]">
                          {verificationResult.leaf}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Computed Root:</span>
                        <span className="text-zinc-200 truncate max-w-[240px]">
                          {verificationResult.computedRoot}
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Path Toggle */}
                    <div className="pt-2 border-t border-emerald-900/40">
                      <button
                        type="button"
                        onClick={() => setShowPathDetails(!showPathDetails)}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <span>
                          {showPathDetails ? "▼ Hide" : "▶ Inspect"} Merkle
                          Proof Path ({verificationResult.steps.length} steps)
                        </span>
                      </button>

                      {showPathDetails && (
                        <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-black/60 border border-emerald-900/40 text-[10px]">
                          {verificationResult.steps.length === 0 ? (
                            <p className="text-zinc-400">
                              Single-leaf tree: Leaf hash is directly the Merkle
                              root.
                            </p>
                          ) : (
                            verificationResult.steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-zinc-400"
                              >
                                <span>
                                  Step {idx + 1} (Level {step.level},{" "}
                                  {step.position}):
                                </span>
                                <span className="text-zinc-300 truncate max-w-[200px]">
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

              {/* Section 3: All Commitments Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono text-zinc-400">
                    ALL PUBLIC COMMITMENTS IN POOL ({audit.commitments.length})
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Click commitment to verify
                  </span>
                </div>

                {audit.commitments.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-500 font-mono">
                    No bets recorded for this market yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 text-[10px]">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Commitment</th>
                          <th className="p-2.5">Side</th>
                          <th className="p-2.5">Stake</th>
                          <th className="p-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 bg-zinc-950">
                        {audit.commitments.map((c, idx) => {
                          const isTarget =
                            targetCommitment.toLowerCase() ===
                            c.commitment.toLowerCase();
                          return (
                            <tr
                              key={c.id || idx}
                              className={`transition-colors ${
                                isTarget ? "bg-cyan-950/20" : "hover:bg-zinc-900/50"
                              }`}
                            >
                              <td className="p-2.5 text-zinc-500">{idx + 1}</td>
                              <td className="p-2.5 font-mono text-zinc-300 truncate max-w-[140px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCommitment(c.commitment);
                                    handleVerify(c.commitment);
                                  }}
                                  className="hover:text-cyan-400 hover:underline text-left truncate block w-full"
                                >
                                  {c.commitment.slice(0, 14)}...
                                </button>
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    c.decrypted_side === "YES"
                                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                                      : c.decrypted_side === "NO"
                                      ? "bg-rose-950 text-rose-400 border border-rose-900"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {c.decrypted_side}
                                </span>
                              </td>
                              <td className="p-2.5 text-zinc-200">
                                {c.amount_zec} ZEC
                              </td>
                              <td className="p-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetCommitment(c.commitment);
                                    handleVerify(c.commitment);
                                  }}
                                  className="text-[10px] text-cyan-400 hover:underline"
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

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 text-center text-[10px] font-mono text-zinc-500">
          Nocturne Cryptographic Verifier — 100% In-Browser WebCrypto SHA-256
        </div>
      </div>
    </div>
  );
}
