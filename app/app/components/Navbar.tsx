"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MyBetsDrawer } from "@/components/MyBetsDrawer";
import { getBetReceipts } from "@/lib/vault";

export default function Navbar() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Sync vault count reactively from localStorage
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Zero-leak URL teleporter: if user pasted a polymarket URL, teleport immediately
    if (query.includes("polymarket.com")) {
      const cleanUrl = query.startsWith("http") ? query : `https://${query}`;
      router.push(`/${cleanUrl}`);
    } else {
      router.push(`/?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#090706]/95 backdrop-blur-md border-b border-[#7c2d12]/30 text-[#fef3c7]">
        {/* ========================================================
            Primary Top Bar (Kalshi Style Navigation + Search + Vault)
            ======================================================== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Logo & Primary Navigation Links */}
          <div className="flex items-center gap-5 lg:gap-7 shrink-0">
            <Link href="/" className="flex items-center gap-0.5 group">
              <div className="relative w-8 h-8 overflow-hidden flex items-center justify-center transition-colors">
                <Image
                  src="/logo.png"
                  alt="Nocturne Logo"
                  className="object-contain"
                  height={24}
                  width={24}
                  priority
                />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headin text-2xl sm:text-xl tracking-tight text-[#fef3c7]">
                  Nocturne
                </span>
                <span className="font-heading text-2xl sm:text-xl tracking-tight text-[#fb923c]">
                  Markets
                </span>
              </div>
            </Link>

            {/* Kalshi-style Uppercase Primary Navigation */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-mono font-bold tracking-wider">
              <Link
                href="/#markets"
                className="text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors py-1"
              >
                MARKETS
              </Link>
              <Link
                href="/#live"
                className="text-[#fef3c7] hover:text-[#fb923c] transition-colors py-1 flex items-center gap-1.5"
              >
                <span>LIVE</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fb923c] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ea580c]"></span>
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#431407] text-[#fb923c] border border-[#ea580c]/60 font-mono font-bold">
                  12
                </span>
              </Link>

              {/* MORE Dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className="text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors py-1 flex items-center gap-1 cursor-pointer"
                >
                  <span>MORE</span>
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isMoreOpen ? "rotate-180 text-[#fb923c]" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {isMoreOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 rounded-md bg-[#120d0a] border border-[#7c2d12]/50 shadow-2xl py-2 z-50 text-xs font-mono">
                    <Link
                      href="/docs"
                      onClick={() => setIsMoreOpen(false)}
                      className="block px-4 py-2 text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                    >
                      Documentation
                    </Link>
                    <a
                      href="https://thezecathon.com"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsMoreOpen(false)}
                      className="block px-4 py-2 text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                    >
                      ZECATHON Track
                    </a>
                    <a
                      href="https://drand.love"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsMoreOpen(false)}
                      className="block px-4 py-2 text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                    >
                      drand Quicknet Beacon
                    </a>
                    <div className="border-t border-[#7c2d12]/30 my-1"></div>
                    <div className="px-4 py-1.5 text-[10px] text-[#fef3c7]/40 uppercase tracking-wider">
                      Privacy Invariant
                    </div>
                    <div className="px-4 py-1 text-[11px] text-[#fb923c] font-medium">
                      Zero-POST Shielded Pools
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Center: Sleek Kalshi-style Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-md mx-2 sm:mx-4 relative hidden sm:flex items-center"
          >
            <div className="w-full flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c]/60 focus-within:border-[#fb923c] focus-within:ring-1 focus-within:ring-[#fb923c]/40 transition-all">
              <svg
                className="w-4 h-4 text-[#fef3c7]/50 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Trade on anything / paste Polymarket link..."
                className="bg-transparent text-xs sm:text-sm text-[#fef3c7] placeholder-[#fef3c7]/40 outline-none w-full font-sans"
              />
              <kbd className="hidden lg:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#201510] text-[#fef3c7]/50 border border-[#7c2d12]/40 shrink-0">
                ↵
              </kbd>
            </div>
          </form>

          {/* Right: Privacy Actions (NO SIGN IN / NO LOGIN) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Public Merkle Audit Trigger */}
            <Link
              href="/#markets"
              className="btn-monad-base btn-void h-8 px-3 rounded-full text-[11px] hidden sm:inline-flex"
            >
              <span> Audit Proofs</span>
            </Link>

            {/* Private Local Vault CTA (Replaces Login/Signup with pure privacy) */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="btn-monad-base btn-ember h-8.5 px-3.5 sm:px-4 rounded-full text-xs font-mono font-bold flex items-center gap-2"
              title="View your locally stored shielded receipts"
            >
              <span className="flex items-center gap-1.5">
                <span>Private Vault</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#431407] text-[#fb923c] border border-[#ea580c] text-[10px] font-mono font-bold">
                  {vaultCount}
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================
            Secondary Sub-Nav Bar (Kalshi's Trending & Category Ticker)
            ======================================================== */}
        <div className="border-t border-[#7c2d12]/20 bg-[#090706]/90 px-4 sm:px-6 py-3 overflow-x-auto no-scrollbar flex items-center gap-5 text-xs font-mono select-none">
          {/* Trending Label */}
          <div className="flex items-center gap-1.5 font-bold text-[#fef3c7] shrink-0 uppercase tracking-wider text-[11px]">
            <span>Trending</span>
          </div>

          {/* Category Chips with Hover Glow */}
          <div className="flex items-center gap-4 sm:gap-5 shrink-0">
            <Link
              href="/?cat=blitz"
              className="text-[#fb923c] font-bold hover:text-[#fed7aa] transition-colors shrink-0 flex items-center gap-1"
            >
              <span>🔥 5m Blitz</span>
            </Link>
            <Link
              href="/?cat=crypto"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Crypto
            </Link>
            <Link
              href="/?cat=macro"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Macro & Fed
            </Link>
            <Link
              href="/?cat=elections"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Elections
            </Link>
            <Link
              href="/?cat=tech"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Tech & AI
            </Link>
            <Link
              href="/?cat=geopolitics"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Geopolitics
            </Link>
            <Link
              href="/?cat=culture"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Culture
            </Link>
            <Link
              href="/?cat=commodities"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Commodities
            </Link>
            <Link
              href="/?cat=science"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Science
            </Link>
            <Link
              href="/#markets"
              className="text-[#fef3c7]/50 hover:text-[#fb923c] transition-colors shrink-0"
            >
              All Markets →
            </Link>
          </div>
        </div>
      </header>

      {/* Slide-over Private Bets Drawer */}
      <MyBetsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
