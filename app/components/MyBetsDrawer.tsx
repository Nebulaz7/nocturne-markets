"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  Copy,
  Check,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  QrCode,
  X,
  Search,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getBetReceipts,
  deleteBetReceipt,
  exportVaultJson,
  importVaultJson,
  clearVault,
  type PreparedBetReceipt,
} from "@/lib/vault";
import { AuditDrawer } from "./AuditDrawer";

export interface MyBetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type VaultFilter = "ALL" | "ACTIVE" | "SETTLED";

export function MyBetsDrawer({ isOpen, onClose }: MyBetsDrawerProps) {
  const [receipts, setReceipts] = useState<PreparedBetReceipt[]>([]);
  const [filter, setFilter] = useState<VaultFilter>("ALL");
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedQrId, setExpandedQrId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [auditTarget, setAuditTarget] = useState<{
    marketId: string;
    marketTitle?: string;
    commitment?: string;
  } | null>(null);

  const loadReceipts = () => {
    setReceipts(getBetReceipts());
  };

  useEffect(() => {
    loadReceipts();
    const handleUpdate = () => loadReceipts();
    window.addEventListener("nocturne-vault-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("nocturne-vault-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter & Search calculation
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (filter === "ACTIVE" && r.status === "SETTLED") return false;
      if (filter === "SETTLED" && r.status !== "SETTLED") return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const titleMatch = (r.marketTitle || "").toLowerCase().includes(query);
        const idMatch = r.marketId.toLowerCase().includes(query);
        const commMatch = r.commitment.toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !commMatch) return false;
      }
      return true;
    });
  }, [receipts, filter, search]);

  const totalStakedZec = useMemo(() => {
    return receipts.reduce((sum, r) => sum + (r.amountZec || 0), 0);
  }, [receipts]);

  const activeCount = useMemo(() => {
    return receipts.filter((r) => r.status !== "SETTLED").length;
  }, [receipts]);

  const settledCount = receipts.length - activeCount;

  if (!isOpen) return null;

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDelete = (id: string) => {
    deleteBetReceipt(id);
    setConfirmDeleteId(null);
    loadReceipts();
  };

  const handleExport = () => {
    const jsonStr = exportVaultJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nocturne-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importVaultJson(content);
        loadReceipts();
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm transition-opacity">
      {/* Hidden file input for vault backup restoration */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="w-full max-w-lg h-full bg-[#090706] border-l border-[#7c2d12]/40 shadow-2xl flex flex-col font-sans text-[#fef3c7] select-none">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-[#7c2d12]/30 bg-[#0e0a08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#140e0b] border border-[#7c2d12]/50 flex items-center justify-center text-[#fb923c]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-heading font-bold text-[#fef3c7] tracking-tight">
                  Private Vault
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#160f0c] text-[#fb923c] border border-[#7c2d12]/40">
                  {receipts.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExport}
              title="Export Vault Backup"
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/30 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              title="Import Vault Backup"
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/30 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#1c120c] border border-[#7c2d12]/30 text-[#fef3c7]/70 hover:text-[#fef3c7] transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metric Summary Strip (Numbers First, Layout Explains Itself) */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-[#0c0806] border-b border-[#7c2d12]/20 font-mono text-center">
          <div className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/25">
            <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
              Staked
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#fef3c7]">
              {totalStakedZec.toFixed(2)} ZEC
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/25">
            <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
              Active
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#22c55e]">
              {activeCount}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/25">
            <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
              Settled
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#fb923c]">
              {settledCount}
            </span>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="p-3 border-b border-[#7c2d12]/20 bg-[#090706] flex items-center gap-2">
          <div className="flex rounded-lg bg-[#140e0b] p-0.5 border border-[#7c2d12]/30 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "ALL"
                  ? "bg-[#24150e] text-[#fb923c] font-bold"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("ACTIVE")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "ACTIVE"
                  ? "bg-[#24150e] text-[#fb923c] font-bold"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilter("SETTLED")}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === "SETTLED"
                  ? "bg-[#24150e] text-[#fb923c] font-bold"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              Settled
            </button>
          </div>

          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 text-[#fef3c7]/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipts..."
              className="w-full bg-[#140e0b] border border-[#7c2d12]/30 rounded-lg pl-8 pr-2.5 py-1 text-xs text-[#fef3c7] placeholder-[#fef3c7]/30 outline-none focus:border-[#fb923c]/60"
            />
          </div>
        </div>

        {/* Receipts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredReceipts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30">
              <div className="w-10 h-10 rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 flex items-center justify-center text-[#fef3c7]/40 mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-heading font-semibold text-[#fef3c7] mb-1">
                Vault Empty
              </h3>
              <p className="text-xs font-mono text-[#fef3c7]/40 mb-4">
                {receipts.length === 0
                  ? "No cryptographic bet slips recorded in this browser."
                  : "No receipts match the selected filter."}
              </p>
              {receipts.length === 0 && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-[#fb923c] hover:bg-[#ea580c] text-[#431407] font-bold font-sans text-xs transition-colors"
                >
                  Explore Markets
                </button>
              )}
            </div>
          ) : (
            filteredReceipts.map((r) => {
              const isQrExpanded = expandedQrId === r.id;
              const isConfirming = confirmDeleteId === r.id;

              return (
                <div
                  key={r.id}
                  className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 hover:border-[#fb923c]/50 p-4 transition-all space-y-3"
                >
                  {/* Top Bar: Side, Amount, Status & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          r.side === "YES"
                            ? "bg-[#12281c] text-[#22c55e] border border-[#22c55e]/40"
                            : "bg-[#361212] text-[#f87171] border border-[#f87171]/40"
                        }`}
                      >
                        {r.side}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#fef3c7]">
                        {r.amountZec} ZEC
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                          r.status === "SETTLED"
                            ? "bg-[#160f0c] text-[#fb923c] border border-[#7c2d12]/40"
                            : "bg-[#12281c]/70 text-[#22c55e] border border-[#22c55e]/30"
                        }`}
                      >
                        {r.status || "OPEN"}
                      </span>
                      <span className="text-[10px] font-mono text-[#fef3c7]/40">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Market Title Link */}
                  <div>
                    <Link
                      href={`/market/${r.marketId}`}
                      onClick={onClose}
                      className="text-sm font-heading font-semibold text-[#fef3c7] hover:text-[#fb923c] transition-colors line-clamp-2 block"
                    >
                      {r.marketTitle || `Market #${r.marketId}`}
                    </Link>
                  </div>

                  {/* Cryptographic Proof Data Strip */}
                  <div className="p-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/25 font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#fef3c7]/40">Commitment</span>
                      <button
                        type="button"
                        onClick={() => copyText(r.commitment, `${r.id}-comm`)}
                        className="flex items-center gap-1 text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors cursor-pointer"
                        title="Click to copy full 64-char commitment hash"
                      >
                        <span>
                          {r.commitment.slice(0, 10)}...{r.commitment.slice(-6)}
                        </span>
                        {copiedKey === `${r.id}-comm` ? (
                          <Check className="w-3 h-3 text-[#22c55e]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#fef3c7]/40">Beacon Round</span>
                      <span className="text-[#fb923c]">#{r.drandRound}</span>
                    </div>
                  </div>

                  {/* Collapsible QR Code and Payment URI View */}
                  {isQrExpanded && (
                    <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col items-center space-y-2.5">
                      <div className="p-2 bg-white rounded-lg shadow">
                        <QRCodeSVG
                          value={r.paymentUri}
                          size={140}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                      <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-[#7c2d12]/20 text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => copyText(r.paymentUri, `${r.id}-uri`)}
                          className="flex items-center gap-1 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>
                            {copiedKey === `${r.id}-uri`
                              ? "URI Copied"
                              : "Copy Payment URI"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(r.memoUtf8, `${r.id}-memo`)}
                          className="flex items-center gap-1 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>
                            {copiedKey === `${r.id}-memo`
                              ? "Memo Copied"
                              : "Copy Memo"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Card Action Controls */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#7c2d12]/20">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAuditTarget({
                            marketId: r.marketId,
                            marketTitle: r.marketTitle,
                            commitment: r.commitment,
                          })
                        }
                        className="py-1 px-2.5 rounded-lg bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/35 text-[11px] font-mono text-[#fb923c] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Shield className="w-3 h-3" />
                        <span>Audit Proof</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQrId(isQrExpanded ? null : r.id)
                        }
                        className={`py-1 px-2.5 rounded-lg border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isQrExpanded
                            ? "bg-[#24150e] text-[#fb923c] border-[#fb923c]/50"
                            : "bg-[#140e0b] hover:bg-[#1f140f] border-[#7c2d12]/35 text-[#fef3c7]/80 hover:text-[#fb923c]"
                        }`}
                      >
                        <QrCode className="w-3 h-3" />
                        <span>{isQrExpanded ? "Hide Slip" : "Pay Slip"}</span>
                      </button>
                    </div>

                    <div>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-[#361212] text-[#f87171] border border-[#f87171]/40 hover:bg-[#4a1717]"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] font-mono px-2 py-1 rounded bg-[#140e0b] text-[#fef3c7]/60 hover:text-[#fef3c7]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-1.5 rounded-lg text-[#fef3c7]/40 hover:text-[#f87171] hover:bg-[#361212]/30 transition-colors"
                          title="Remove receipt from local vault"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {auditTarget && (
        <AuditDrawer
          isOpen={Boolean(auditTarget)}
          onClose={() => setAuditTarget(null)}
          marketId={auditTarget.marketId}
          marketTitle={auditTarget.marketTitle}
          initialCommitment={auditTarget.commitment}
        />
      )}
    </div>
  );
}
