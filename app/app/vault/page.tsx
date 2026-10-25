"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import {
  Shield,
  Copy,
  Check,
  Download,
  Upload,
  Trash2,
  QrCode,
  Search,
  ArrowLeft,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getBetReceipts,
  deleteBetReceipt,
  exportVaultJson,
  importVaultJson,
  type PreparedBetReceipt,
} from "@/lib/vault";
import { AuditDrawer } from "@/components/AuditDrawer";

type VaultFilter = "ALL" | "ACTIVE" | "SETTLED";

export default function PrivateVaultPage() {
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
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/#markets"
            className="flex items-center gap-1.5 text-xs font-mono text-[#fef3c7]/60 hover:text-[#fb923c] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Markets</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="py-1.5 px-3 rounded-xl bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="py-1.5 px-3 rounded-xl bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/40 text-xs font-mono text-[#fef3c7]/80 hover:text-[#fb923c] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>
          </div>
        </div>

        {/* Header & Metrics Strip */}
        <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 p-6 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#140e0b] border border-[#7c2d12]/50 flex items-center justify-center text-[#fb923c] shrink-0">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-[#fef3c7]">
                  Private Vault
                </h1>
                <span className="text-xs font-mono text-[#fef3c7]/50 block mt-0.5">
                  {receipts.length} Recorded Position
                  {receipts.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 text-center min-w-[90px]">
                <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
                  Staked
                </span>
                <span className="text-sm font-bold text-[#fef3c7]">
                  {totalStakedZec.toFixed(2)} ZEC
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 text-center min-w-[90px]">
                <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
                  Active
                </span>
                <span className="text-sm font-bold text-[#22c55e]">
                  {activeCount}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 text-center min-w-[90px]">
                <span className="text-[10px] text-[#fef3c7]/40 block uppercase">
                  Settled
                </span>
                <span className="text-sm font-bold text-[#fb923c]">
                  {settledCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex rounded-xl bg-[#0e0a08] p-1 border border-[#7c2d12]/30 text-xs font-mono w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "ALL"
                  ? "bg-[#24150e] text-[#fb923c] font-bold shadow-sm"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              All ({receipts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("ACTIVE")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "ACTIVE"
                  ? "bg-[#24150e] text-[#fb923c] font-bold shadow-sm"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("SETTLED")}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "SETTLED"
                  ? "bg-[#24150e] text-[#fb923c] font-bold shadow-sm"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7]"
              }`}
            >
              Settled ({settledCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#fef3c7]/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipts..."
              className="w-full bg-[#0e0a08] border border-[#7c2d12]/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#fef3c7] placeholder-[#fef3c7]/30 outline-none focus:border-[#fb923c]/60"
            />
          </div>
        </div>

        {/* Grid of Receipts */}
        {filteredReceipts.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30">
            <div className="w-12 h-12 rounded-2xl bg-[#140e0b] border border-[#7c2d12]/40 flex items-center justify-center text-[#fef3c7]/40 mb-3">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#fef3c7] mb-1">
              Vault Empty
            </h3>
            <p className="text-xs font-mono text-[#fef3c7]/40 mb-5">
              {receipts.length === 0
                ? "No cryptographic bet slips recorded in this browser."
                : "No receipts match the selected filter."}
            </p>
            {receipts.length === 0 && (
              <Link
                href="/#markets"
                className="px-5 py-2.5 rounded-xl bg-[#fb923c] hover:bg-[#ea580c] text-[#431407] font-bold font-sans text-xs transition-colors"
              >
                Explore Markets
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReceipts.map((r) => {
              const isQrExpanded = expandedQrId === r.id;
              const isConfirming = confirmDeleteId === r.id;

              return (
                <div
                  key={r.id}
                  className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 hover:border-[#fb923c]/50 p-5 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Side, Amount, Status & Date */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                            r.side === "YES"
                              ? "bg-[#12281c] text-[#22c55e] border border-[#22c55e]/40"
                              : "bg-[#361212] text-[#f87171] border border-[#f87171]/40"
                          }`}
                        >
                          {r.side}
                        </span>
                        <span className="text-sm font-mono font-bold text-[#fef3c7]">
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

                    {/* Market Title */}
                    <div>
                      <Link
                        href={`/market/${r.marketId}`}
                        className="text-base font-heading font-semibold text-[#fef3c7] hover:text-[#fb923c] transition-colors line-clamp-2 block"
                      >
                        {r.marketTitle || `Market #${r.marketId}`}
                      </Link>
                    </div>

                    {/* Proof Data Strip */}
                    <div className="p-3 rounded-xl bg-[#140e0b] border border-[#7c2d12]/25 font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#fef3c7]/40">Commitment</span>
                        <button
                          type="button"
                          onClick={() => copyText(r.commitment, `${r.id}-comm`)}
                          className="flex items-center gap-1.5 text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors cursor-pointer"
                          title="Click to copy full 64-char commitment"
                        >
                          <span>
                            {r.commitment.slice(0, 12)}...
                            {r.commitment.slice(-6)}
                          </span>
                          {copiedKey === `${r.id}-comm` ? (
                            <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[#fef3c7]/40">Beacon Round</span>
                        <span className="text-[#fb923c]">#{r.drandRound}</span>
                      </div>
                    </div>

                    {/* Collapsible QR Code */}
                    {isQrExpanded && (
                      <div className="p-4 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col items-center space-y-3">
                        <div className="p-2.5 bg-white rounded-xl shadow">
                          <QRCodeSVG
                            value={r.paymentUri}
                            size={160}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-[#7c2d12]/20 text-xs font-mono">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(r.paymentUri, `${r.id}-uri`)
                            }
                            className="flex items-center gap-1.5 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors cursor-pointer"
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
                            className="flex items-center gap-1.5 text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors cursor-pointer"
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
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#7c2d12]/20">
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
                        className="py-1.5 px-3 rounded-lg bg-[#140e0b] hover:bg-[#1f140f] border border-[#7c2d12]/35 text-xs font-mono text-[#fb923c] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Audit Proof</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQrId(isQrExpanded ? null : r.id)
                        }
                        className={`py-1.5 px-3 rounded-lg border text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isQrExpanded
                            ? "bg-[#24150e] text-[#fb923c] border-[#fb923c]/50"
                            : "bg-[#140e0b] hover:bg-[#1f140f] border-[#7c2d12]/35 text-[#fef3c7]/80 hover:text-[#fb923c]"
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>{isQrExpanded ? "Hide Slip" : "Pay Slip"}</span>
                      </button>
                    </div>

                    <div>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#361212] text-[#f87171] border border-[#f87171]/40 hover:bg-[#4a1717] cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#140e0b] text-[#fef3c7]/60 hover:text-[#fef3c7] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="p-2 rounded-lg text-[#fef3c7]/40 hover:text-[#f87171] hover:bg-[#361212]/30 transition-colors cursor-pointer"
                          title="Remove receipt from local vault"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

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
