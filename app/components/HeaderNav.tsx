"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MyBetsDrawer } from "./MyBetsDrawer";
import { getBetReceipts } from "@/lib/vault";

export function HeaderNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);

  const updateCount = () => {
    setVaultCount(getBetReceipts().length);
  };

  useEffect(() => {
    updateCount();
    window.addEventListener("nocturne-vault-updated", updateCount);
    window.addEventListener("storage", updateCount);
    return () => {
      window.removeEventListener("nocturne-vault-updated", updateCount);
      window.removeEventListener("storage", updateCount);
    };
  }, []);

  return (
    <>
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-bold text-black text-lg">
              Z
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Nocturne Markets
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400">
              TESTNET v0.2
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-2"
            >
              <span>💼 My Private Bets</span>
              {vaultCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold">
                  {vaultCount}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400 pl-2 border-l border-zinc-800">
              <span>Testnet</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
          </div>
        </div>
      </header>

      <MyBetsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
