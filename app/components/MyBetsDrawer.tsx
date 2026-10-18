"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getBetReceipts, deleteBetReceipt, type PreparedBetReceipt } from "@/lib/vault";

export interface MyBetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MyBetsDrawer({ isOpen, onClose }: MyBetsDrawerProps) {
  const [receipts, setReceipts] = useState<PreparedBetReceipt[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDelete = (id: string) => {
    deleteBetReceipt(id);
    loadReceipts();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col font-sans text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              My Private Bets
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-cyan-400 border border-zinc-700">
              {receipts.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Subheader info */}
        <div className="p-3 bg-zinc-900/40 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
          <span>🔒 Client-side vault only</span>
          <span>Zero server knowledge</span>
        </div>

        {/* Bets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {receipts.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">
              <p className="mb-2">No private bets in this browser vault.</p>
              <p className="text-[11px] text-zinc-600">
                When you generate a bet slip, your secret and commitment are saved
                here locally for audit verification.
              </p>
            </div>
          ) : (
            receipts.map((r) => (
              <div
                key={r.id}
                className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] ${
                      r.side === "YES"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-rose-950 text-rose-400 border border-rose-800"
                    }`}
                  >
                    {r.side} ({r.amountZec} ZEC)
                  </span>

                  <span className="text-[10px] font-mono text-zinc-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="font-medium text-white line-clamp-1">
                  {r.marketTitle || `Market ID: ${r.marketId}`}
                </div>

                <div className="space-y-1 font-mono text-[10px] text-zinc-400 pt-1 border-t border-zinc-800">
                  <div className="flex justify-between items-center">
                    <span>Commitment:</span>
                    <button
                      type="button"
                      onClick={() => copyText(r.commitment, `${r.id}-comm`)}
                      className="text-zinc-300 hover:text-cyan-400 truncate max-w-[150px]"
                    >
                      {copiedId === `${r.id}-comm` ? "✔ Copied" : `${r.commitment.slice(0, 14)}...`}
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Secret:</span>
                    <button
                      type="button"
                      onClick={() => copyText(r.secret, `${r.id}-sec`)}
                      className="text-zinc-500 hover:text-cyan-400 truncate max-w-[150px]"
                    >
                      {copiedId === `${r.id}-sec` ? "✔ Copied" : `${r.secret.slice(0, 10)}...`}
                    </button>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>drand Round:</span>
                    <span className="text-zinc-300">#{r.drandRound}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                  <Link
                    href={`/market/${r.marketId}`}
                    onClick={onClose}
                    className="text-[11px] text-cyan-400 hover:underline font-mono"
                  >
                    View Market →
                  </Link>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(r.paymentUri, `${r.id}-uri`)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    >
                      {copiedId === `${r.id}-uri` ? "Copied" : "Copy URI"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 text-center">
          <p className="text-[10px] font-mono text-zinc-500">
            Nocturne Markets Zero-POST Local Vault
          </p>
        </div>
      </div>
    </div>
  );
}
