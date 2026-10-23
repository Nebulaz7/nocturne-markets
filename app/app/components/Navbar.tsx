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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
        setIsMoreOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Automatically close mobile menu on screen resize to tablet/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Close mobile menu if open
    setIsMobileMenuOpen(false);

    // Zero-leak URL teleporter: if user pasted a polymarket URL, teleport immediately
    if (query.includes("polymarket.com")) {
      const cleanUrl = query.startsWith("http") ? query : `https://${query}`;
      router.push(`/${cleanUrl}`);
    } else {
      router.push(`/?q=${encodeURIComponent(query)}`);
    }
  };

  const openMobileSearch = () => {
    setIsMobileMenuOpen(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 100);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#090706]/95 backdrop-blur-md border-b border-[#7c2d12]/30 text-[#fef3c7]">
        {/* ========================================================
            Primary Top Bar (Kalshi Style Navigation + Search + Vault)
            ======================================================== */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Logo & Primary Navigation Links */}
          <div className="flex items-center gap-4 md:gap-6 lg:gap-7 shrink-0">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-1.5 sm:gap-2 group"
            >
              <div className="relative w-7 h-7 sm:w-8 sm:h-8 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105">
                <Image
                  src="/logo.png"
                  alt="Nocturne Logo"
                  className="object-contain"
                  height={26}
                  width={26}
                  priority
                />
              </div>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="font-heading text-lg sm:text-xl font-bold tracking-tight text-[#fef3c7]">
                  Nocturne
                </span>
                <span className="font-heading text-lg sm:text-xl font-bold tracking-tight text-[#fb923c]">
                  Markets
                </span>
              </div>
            </Link>

            {/* Kalshi-style Uppercase Primary Navigation (Desktop) */}
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
                  10+
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
                      ZECATHON Track ↗
                    </a>
                    <a
                      href="https://drand.love"
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setIsMoreOpen(false)}
                      className="block px-4 py-2 text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                    >
                      drand Quicknet Beacon ↗
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

          {/* Center: Sleek Kalshi-style Search Bar (Desktop & Tablets) */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-md mx-2 sm:mx-4 relative hidden md:flex items-center"
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

          {/* Right: Actions & Responsive Hamburger Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Quick Search Button */}
            <button
              type="button"
              onClick={openMobileSearch}
              className="md:hidden p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c]/70 text-[#fef3c7]/80 hover:text-[#fb923c] transition-colors"
              aria-label="Open search bar"
            >
              <svg
                className="w-4 h-4"
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
            </button>

            {/* Public Merkle Audit Trigger (Desktop only - strictly hidden on smaller screens requiring hamburger) */}
            <div className="hidden md:flex items-center">
              <Link
                href="/audit"
                className="btn-monad-base btn-void h-8 px-3 text-[11px]"
              >
                <span>Audit Proofs</span>
              </Link>
            </div>

            {/* Private Local Vault CTA */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setDrawerOpen(true);
              }}
              className="btn-monad-base btn-ember h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-mono font-bold flex items-center gap-1.5 sm:gap-2"
              title="View your locally stored shielded receipts"
            >
              <span className="flex items-center gap-1.5">
                <span className="hidden xs:inline sm:inline">Private </span>
                <span>Vault</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#431407] text-[#fb923c] border border-[#ea580c] text-[10px] font-mono font-bold">
                  {vaultCount}
                </span>
              </span>
            </button>

            {/* Hamburger Menu Toggle Button (Mobile / Small Devices) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden relative flex flex-col justify-center items-center w-9 h-9 rounded-lg bg-[#140e0b] border border-[#7c2d12]/50 hover:border-[#fb923c]/80 text-[#fef3c7] hover:text-[#fb923c] focus:outline-none focus:ring-1 focus:ring-[#fb923c]/50 transition-all cursor-pointer"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Toggle navigation menu</span>
              <div className="w-4.5 h-3.5 relative flex flex-col justify-between">
                <span
                  className={`block h-0.5 w-full bg-current rounded-full transition-all duration-300 ease-out origin-center ${
                    isMobileMenuOpen ? "rotate-45 translate-y-[6px]" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current rounded-full transition-all duration-200 ease-out ${
                    isMobileMenuOpen ? "opacity-0 scale-x-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`block h-0.5 w-full bg-current rounded-full transition-all duration-300 ease-out origin-center ${
                    isMobileMenuOpen ? "-rotate-45 -translate-y-[6px]" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================
            Secondary Sub-Nav Bar (Trending & Category Ticker)
            ======================================================== */}
        <div className="border-t border-[#7c2d12]/20 bg-[#090706]/90 px-3 sm:px-6 py-2.5 sm:py-3 overflow-x-auto no-scrollbar flex items-center gap-4 sm:gap-5 text-xs font-mono select-none">
          {/* Trending Label */}
          <div className="flex items-center gap-1.5 font-bold text-[#fef3c7] shrink-0 uppercase tracking-wider text-[11px]">
            <span>Trending</span>
          </div>

          {/* Category Chips with Hover Glow */}
          <div className="flex items-center gap-3.5 sm:gap-5 shrink-0">
            <Link
              href="/?cat=blitz"
              className="text-[#fb923c] font-bold hover:text-[#fed7aa] transition-colors shrink-0 flex items-center gap-1"
            >
              <span>5m Blitz</span>
            </Link>
            <Link
              href="/?cat=crypto"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Crypto
            </Link>
            <Link
              href="/?cat=others"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Macro & Fed
            </Link>
            <Link
              href="/?cat=politics"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Politics
            </Link>
            <Link
              href="/?cat=others"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Tech & AI
            </Link>
            <Link
              href="/?cat=others"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Geopolitics
            </Link>
            <Link
              href="/?cat=others"
              className="text-[#fef3c7]/70 hover:text-[#fb923c] transition-colors shrink-0"
            >
              Culture
            </Link>
            <Link
              href="/?cat=others"
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

        {/* ========================================================
            Mobile Responsive Hamburger Drawer / Slide-Down Menu
            ======================================================== */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop Blur Overlay */}
            <div
              className="fixed inset-0 top-[64px] sm:top-[72px] bg-black/80 backdrop-blur-md z-30 md:hidden transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Mobile Drawer Panel */}
            <div className="fixed inset-x-0 top-[64px] sm:top-[72px] max-h-[calc(100dvh-64px)] sm:max-h-[calc(100dvh-72px)] overflow-y-auto bg-[#0d0a08]/98 border-b border-[#7c2d12]/40 shadow-2xl z-40 md:hidden animate-menu-slide-down flex flex-col divide-y divide-[#7c2d12]/20 no-scrollbar">
              {/* 1. Mobile Search Bar */}
              <div className="p-4 bg-[#120d0a]/80">
                <form onSubmit={handleSearchSubmit}>
                  <div className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/60 focus-within:border-[#fb923c] focus-within:ring-1 focus-within:ring-[#fb923c]/40 transition-all">
                    <svg
                      className="w-4 h-4 text-[#fb923c] shrink-0"
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
                      ref={mobileSearchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Trade on anything / paste Polymarket link..."
                      className="bg-transparent text-xs text-[#fef3c7] placeholder-[#fef3c7]/40 outline-none w-full font-sans"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-[#fef3c7]/40 hover:text-[#fef3c7] text-xs font-mono px-1"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded-md bg-[#7c2d12] hover:bg-[#ea580c] text-[#fef3c7] text-[11px] font-mono font-bold transition-colors shrink-0"
                    >
                      Go
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. Primary Navigation Links */}
              <div className="p-4 flex flex-col gap-2 font-mono">
                <div className="text-[10px] font-bold text-[#fef3c7]/40 uppercase tracking-widest px-2 mb-1">
                  Navigation
                </div>
                <Link
                  href="/#markets"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-lg text-sm text-[#fef3c7] hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                >
                  <span className="font-bold flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-[#fb923c]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    MARKETS
                  </span>
                  <span className="text-xs text-[#fef3c7]/40 font-sans">
                    View active pools →
                  </span>
                </Link>

                <Link
                  href="/#live"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2.5 rounded-lg text-sm text-[#fef3c7] hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                >
                  <span className="font-bold flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fb923c] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ea580c]"></span>
                    </span>
                    LIVE MARKETS
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#431407] text-[#fb923c] border border-[#ea580c]/60 font-bold">
                    12 Active
                  </span>
                </Link>
              </div>

              {/* 3. Mobile Action Button (Vault only - Audit Proofs hidden on mobile) */}
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setDrawerOpen(true);
                  }}
                  className="btn-monad-base btn-ember h-10 px-4 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 w-full cursor-pointer"
                >
                  <span>Private Vault</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-[#431407] text-[#fb923c] border border-[#ea580c] text-[10px] font-mono font-bold">
                    {vaultCount}
                  </span>
                </button>
              </div>

              {/* 4. Trending Categories Quick Grid */}
              <div className="p-4 font-mono">
                <div className="text-[10px] font-bold text-[#fef3c7]/40 uppercase tracking-widest px-2 mb-2.5">
                  Trending Categories
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    href="/?cat=blitz"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fb923c] font-bold hover:border-[#fb923c]/50 transition-colors flex items-center gap-1.5"
                  >
                    <span>5m Blitz</span>
                  </Link>
                  <Link
                    href="/?cat=crypto"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Crypto
                  </Link>
                  <Link
                    href="/?cat=macro"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Macro & Fed
                  </Link>
                  <Link
                    href="/?cat=elections"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Elections
                  </Link>
                  <Link
                    href="/?cat=tech"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Tech & AI
                  </Link>
                  <Link
                    href="/?cat=geopolitics"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Geopolitics
                  </Link>
                  <Link
                    href="/?cat=culture"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#140e0b] border border-[#7c2d12]/30 text-[#fef3c7]/80 hover:text-[#fb923c] hover:border-[#fb923c]/50 transition-colors"
                  >
                    Culture
                  </Link>
                  <Link
                    href="/#markets"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg bg-[#201510] border border-[#ea580c]/40 text-[#fb923c] font-bold hover:border-[#fb923c] transition-colors text-center"
                  >
                    All Markets →
                  </Link>
                </div>
              </div>

              {/* 5. Protocol & Ecosystem Links */}
              <div className="p-4 flex flex-col gap-1 text-xs font-mono">
                <div className="text-[10px] font-bold text-[#fef3c7]/40 uppercase tracking-widest px-2 mb-1">
                  Protocol & Resources
                </div>
                <Link
                  href="/docs"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2 rounded-lg text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                >
                  <span>Documentation</span>
                  <span className="text-[#fef3c7]/40">→</span>
                </Link>
                <a
                  href="https://thezecathon.com"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2 rounded-lg text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                >
                  <span>ZECATHON Track</span>
                  <span className="text-[#fef3c7]/40">↗</span>
                </a>
                <a
                  href="https://drand.love"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-2 rounded-lg text-[#fef3c7]/80 hover:bg-[#201510] hover:text-[#fb923c] transition-colors"
                >
                  <span>drand Quicknet Beacon</span>
                  <span className="text-[#fef3c7]/40">↗</span>
                </a>
              </div>

              {/* 6. Privacy Invariant Banner */}
              {/* <div className="p-4">
                <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/40 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#fb923c] font-bold uppercase tracking-wider mb-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#fb923c]"></span>
                    Zero-POST Shielded Pools
                  </div>
                  <p className="text-[11px] text-[#fef3c7]/60 font-sans leading-relaxed">
                    Timelock encrypted to drand Quicknet. Zero IP write leaks
                    and pure local client-side vaults.
                  </p>
                </div>
              </div> */}

              {/* 7. Footer Status */}
              <div className="p-4 text-center text-[10px] font-mono text-[#fef3c7]/40 flex items-center justify-center gap-2">
                <span>Testnet v0.2</span>
                <span>•</span>
                <span className="text-[#fb923c]">
                  Public Prices. Private People.
                </span>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Slide-over Private Bets Drawer */}
      <MyBetsDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
