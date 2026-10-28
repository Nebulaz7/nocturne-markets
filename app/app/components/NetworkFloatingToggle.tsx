"use client";

import React, { useState } from "react";
import { useNetwork, type NetworkType } from "@/context/NetworkContext";
import { Globe, Shield, Check, Info } from "lucide-react";

export default function NetworkFloatingToggle() {
  const { network, setNetwork, isMainnet } = useNetwork();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSelect = (net: NetworkType) => {
    if (net === network) return;
    setNetwork(net);

    if (net === "mainnet") {
      setToastMessage("Mainnet Preview: Active payouts and faucet are currently running on Testnet (TAZ).");
    } else {
      setToastMessage("Connected to Testnet: Live shielded Orchard payouts and TAZ demo pool active.");
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-2 font-mono">
      {/* Toast Notification upon Switching */}
      {showToast && (
        <div className="p-3 rounded-xl bg-[#0e0a08]/95 backdrop-blur-md border border-[#ea580c]/50 text-xs text-[#fef3c7] shadow-2xl max-w-xs transition-all animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[#fb923c] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-[#fef3c7]/80">
              {toastMessage}
            </p>
          </div>
        </div>
      )}

      {/* Floating Segmented Pill */}
      <div className="p-1 rounded-full bg-[#0e0a08]/90 backdrop-blur-md border border-[#7c2d12]/50 shadow-2xl flex items-center gap-1 hover:border-[#fb923c]/50 transition-colors">
        {/* Testnet (TAZ) Button */}
        <button
          type="button"
          onClick={() => handleSelect("testnet")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            !isMainnet
              ? "bg-[#16100d] text-[#22c55e] border border-[#22c55e]/40 shadow-sm"
              : "text-[#fef3c7]/50 hover:text-[#fef3c7] hover:bg-[#140e0b]"
          }`}
          title="Switch to Zcash Testnet (TAZ)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !isMainnet ? "bg-[#22c55e] animate-pulse" : "bg-[#fef3c7]/30"
            }`}
          />
          <span>Testnet (TAZ)</span>
        </button>

        {/* Mainnet (ZEC) Button */}
        <button
          type="button"
          onClick={() => handleSelect("mainnet")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            isMainnet
              ? "bg-[#16100d] text-[#fb923c] border border-[#ea580c]/50 shadow-sm"
              : "text-[#fef3c7]/50 hover:text-[#fef3c7] hover:bg-[#140e0b]"
          }`}
          title="Switch to Zcash Mainnet (ZEC)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isMainnet ? "bg-[#fb923c]" : "bg-[#fef3c7]/30"
            }`}
          />
          <span>Mainnet (ZEC)</span>
        </button>
      </div>
    </div>
  );
}
