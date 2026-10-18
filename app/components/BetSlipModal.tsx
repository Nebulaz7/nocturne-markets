"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  prepareZeroPostBet,
  type BetSide,
  type PreparedBetReceipt,
} from "@/lib/bet_builder";
import { saveBetReceipt } from "@/lib/vault";

export interface BetSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: {
    id: string;
    title: string;
    pot_address: string;
    coordinator_public_key: string;
    drand_round: string | number;
  };
  initialSide?: BetSide;
}

export function BetSlipModal({
  isOpen,
  onClose,
  market,
  initialSide = "YES",
}: BetSlipModalProps) {
  const [side, setSide] = useState<BetSide>(initialSide);
  const [amountZec, setAmountZec] = useState<string>("1.0");
  const [returnAddress, setReturnAddress] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<PreparedBetReceipt | null>(null);
  const [copiedType, setCopiedType] = useState<"uri" | "memo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset demo testnet Orchard address for convenient testing
  const DEMO_TESTNET_UA =
    "utest1mepu5ag7trhrhuaaza3p30gjg89kkduv9tqjdrd8yujywwhdm4s30vtgf2xajppv0hrjldra8et4rfwnvsuvqqrmff0d4qcwwycfvex8";

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amountZec);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid ZEC amount greater than 0");
      return;
    }

    const trimmedAddress = returnAddress.trim();
    if (!trimmedAddress) {
      setError("Please provide a shielded return address for winning payouts");
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await prepareZeroPostBet({
        marketId: market.id,
        side,
        amountZec: parsedAmount,
        potAddress: market.pot_address,
        returnAddress: trimmedAddress,
        coordinatorPublicKeyHex: market.coordinator_public_key,
        drandRound: market.drand_round,
        marketTitle: market.title,
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

  const resetForm = () => {
    setReceipt(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-sans text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Wireframe Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                ZERO-POST SLIP
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                ID: {market.id}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-white line-clamp-1 mt-1">
              {market.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {!receipt ? (
            /* STEP 1: Bet Configuration Form */
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Side Selection Toggle */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-2">
                  1. CHOOSE YOUR SIDE
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSide("YES")}
                    className={`py-3 px-4 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${
                      side === "YES"
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span>YES</span>
                    <span className="text-xs font-mono font-normal">
                      (Predict True)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSide("NO")}
                    className={`py-3 px-4 rounded-xl font-bold text-sm transition-all border flex items-center justify-center gap-2 ${
                      side === "NO"
                        ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <span>NO</span>
                    <span className="text-xs font-mono font-normal">
                      (Predict False)
                    </span>
                  </button>
                </div>
              </div>

              {/* Stake Amount */}
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-2">
                  2. STAKE AMOUNT (ZEC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountZec}
                    onChange={(e) => setAmountZec(e.target.value)}
                    placeholder="1.0"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <span className="absolute right-4 top-3 text-xs font-mono text-zinc-500">
                    ZEC
                  </span>
                </div>

                {/* Quick Amount Chips */}
                <div className="flex gap-2 mt-2">
                  {["0.5", "1.0", "2.0", "5.0"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountZec(preset)}
                      className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                        amountZec === preset
                          ? "bg-cyan-950 border-cyan-500 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {preset} ZEC
                    </button>
                  ))}
                </div>
              </div>

              {/* Payout Return Address */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-mono text-zinc-400">
                    3. SHIELDED RETURN ADDRESS (ORCHARD / UA)
                  </label>
                  <button
                    type="button"
                    onClick={() => setReturnAddress(DEMO_TESTNET_UA)}
                    className="text-[10px] font-mono text-cyan-400 hover:underline"
                  >
                    Use Testnet Demo UA
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={returnAddress}
                  onChange={(e) => setReturnAddress(e.target.value)}
                  placeholder="utest1... (Your Zashi / YWallet Unified Address for shielded payouts)"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500 resize-none break-all"
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  🔒 Encrypted with X25519 to Coordinator. Never stored in
                  plaintext or exposed on public ledger.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-black font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                    <span>Encrypting to drand Round #{market.drand_round}...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Shielded Bet Slip</span>
                    <span className="font-mono text-xs opacity-75">
                      (0 Network Calls)
                    </span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* STEP 2: Generated QR Code & Payment Instructions */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between font-mono">
                <span>🛡️ Bet Generated & Vaulted Locally</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200">
                  Side: {receipt.side} ({receipt.amountZec} ZEC)
                </span>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl">
                <QRCodeSVG
                  value={receipt.paymentUri}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
                <p className="text-[11px] text-zinc-700 font-mono mt-3 text-center">
                  Scan with Zashi, YWallet, or any ZIP-321 Zcash Wallet
                </p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(receipt.paymentUri, "uri")}
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedType === "uri" ? "✔ Copied URI" : "📋 Copy Payment URI"}
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(receipt.memoUtf8, "memo")}
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-mono text-zinc-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedType === "memo" ? "✔ Copied Memo" : "📋 Copy NOC2: Memo"}
                </button>
              </div>

              {/* Inspection Box */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-[11px] font-mono text-zinc-400">
                <div className="flex justify-between items-center">
                  <span>Commitment (SHA256):</span>
                  <span className="text-zinc-200 truncate max-w-[180px]">
                    {receipt.commitment.slice(0, 16)}...
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>drand Timelock Round:</span>
                  <span className="text-cyan-400">#{receipt.drandRound}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Local Secret (Vaulted):</span>
                  <span className="text-zinc-500 truncate max-w-[180px]">
                    {receipt.secret.slice(0, 8)}... (Saved in browser)
                  </span>
                </div>
              </div>

              {/* Back / Done Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  ← Edit Bet
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-black font-semibold text-xs transition-colors"
                >
                  Done (Keep in Vault)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
