"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#070504] border-t border-[#7c2d12]/35 text-[#fef3c7] relative overflow-hidden mt-auto">
      {/* Ambient background glow layers matching Nocturne Warm Ember identity */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(124,45,18,0.14),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_85%_100%,rgba(234,88,12,0.06),transparent)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-8 sm:pb-12 relative z-10">
        {/* ========================================================
            Top Section: Brand Info + Organized Columns
            ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 pb-12 border-b border-[#7c2d12]/25">
          {/* Brand Identity & Social Channels (Left 5 Cols) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              {/* Brand Logo & Name */}
              <Link
                href="/"
                className="inline-flex items-center gap-2 group mb-3.5"
              >
                <div className="relative w-7 h-7 sm:w-8 sm:h-8 overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105">
                  <Image
                    src="/logo.png"
                    alt="Nocturne Logo"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#fef3c7]">
                    Nocturne
                  </span>
                  <span className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#fb923c]">
                    Markets
                  </span>
                </div>
              </Link>

              {/* Tagline & Mission */}
              <p className="text-xs sm:text-sm text-[#fef3c7]/65 leading-relaxed font-sans max-w-sm mb-5">
                Public prices. Private people. Shielded parimutuel prediction
                pools on Zcash powered by drand timelock encryption.
              </p>
            </div>

            {/* Social & Community Links */}
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-[#fef3c7]/40 uppercase mb-3">
                Community & Source
              </div>
              <div className="flex items-center gap-2.5">
                {/* X / Twitter */}
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X (formerly Twitter)"
                  className="w-9 h-9 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c] text-[#fef3c7]/70 hover:text-[#fb923c] flex items-center justify-center transition-all group"
                >
                  <svg
                    className="w-4 h-4 fill-current group-hover:scale-110 transition-transform"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>

                {/* GitHub */}
                <a
                  href="https://github.com/Nebulaz7/nocturne-markets"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub Repository"
                  className="w-9 h-9 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c] text-[#fef3c7]/70 hover:text-[#fb923c] flex items-center justify-center transition-all group"
                >
                  <svg
                    className="w-4 h-4 fill-current group-hover:scale-110 transition-transform"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                </a>

                {/* Discord */}
                <a
                  href="https://discord.gg"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Discord Community"
                  className="w-9 h-9 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c] text-[#fef3c7]/70 hover:text-[#fb923c] flex items-center justify-center transition-all group"
                >
                  <svg
                    className="w-4 h-4 fill-current group-hover:scale-110 transition-transform"
                    viewBox="0 0 24 24"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </a>

                {/* Documentation */}
                <Link
                  href="/docs"
                  aria-label="Documentation"
                  className="w-9 h-9 rounded-lg bg-[#140e0b] border border-[#7c2d12]/40 hover:border-[#fb923c] text-[#fef3c7]/70 hover:text-[#fb923c] flex items-center justify-center transition-all group"
                >
                  <svg
                    className="w-4 h-4 fill-none stroke-current group-hover:scale-110 transition-transform"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Columns: Structured Navigation (7 Cols) */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {/* Column 1: Markets */}
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-[#fb923c] uppercase mb-4">
                Markets
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm font-sans">
                <li>
                  <Link
                    href="/#markets"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    All Prediction Pools
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?cat=blitz"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors flex items-center gap-1.5"
                  >
                    <span>5m Blitz Cycles</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/60">
                      FAST
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?cat=crypto"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Crypto & Assets
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?cat=politics"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Politics & World
                  </Link>
                </li>
                <li>
                  <Link
                    href="/?cat=sports"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Sports & Culture
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Architecture & Security */}
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-[#fb923c] uppercase mb-4">
                Architecture
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm font-sans">
                <li>
                  <Link
                    href="/docs"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Zero-POST Protocol
                  </Link>
                </li>
                <li>
                  <a
                    href="https://drand.love"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    <span>drand Timelock</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fef3c7]/40" />
                  </a>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Parimutuel Math
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Dual-Envelope Memos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Audit Proofs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Ecosystem */}
            <div className="col-span-2 sm:col-span-1">
              <div className="text-xs font-mono font-bold tracking-wider text-[#fb923c] uppercase mb-4">
                Ecosystem
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm font-sans">
                <li>
                  <a
                    href="https://thezecathon.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    <span>ZECATHON Track</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fef3c7]/40" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://z.cash"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Zcash Network</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fef3c7]/40" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://polymarket.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Polymarket Data</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fef3c7]/40" />
                  </a>
                </li>
                <li>
                  <Link
                    href="/docs"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors"
                  >
                    Developer API
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/Nebulaz7/nocturne-markets"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#fef3c7]/70 hover:text-[#fef3c7] hover:underline underline-offset-4 transition-colors inline-flex items-center gap-1"
                  >
                    <span>GitHub Source</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fef3c7]/40" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ========================================================
            Middle Section: Copyright + Direct Legal/Protocol Links
            ======================================================== */}
        <div className="pt-6 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono text-[#fef3c7]/50">
          <div>
            <span>© 2026 Nocturne Markets. Built for ZECATHON.</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <Link
              href="/docs"
              className="hover:text-[#fb923c] transition-colors"
            >
              Zero-POST Invariant
            </Link>
            <span className="text-[#7c2d12]/50">•</span>
            <Link
              href="/docs"
              className="hover:text-[#fb923c] transition-colors"
            >
              Privacy Architecture
            </Link>
            <span className="text-[#7c2d12]/50">•</span>
            <Link
              href="/docs"
              className="hover:text-[#fb923c] transition-colors"
            >
              Terms of Protocol
            </Link>
          </div>
        </div>

        {/* ========================================================
            Bottom Section: Risk & Cryptographic Disclaimer
            ======================================================== */}
        <div className="pt-4 border-t border-[#7c2d12]/20">
          <p className="text-[11px] leading-relaxed text-[#fef3c7]/40 font-sans">
            Prediction markets involve financial risk. Nocturne Markets provides
            a non-custodial, client-side zero-POST cryptographic interface for
            shielded parimutuel prediction pools on Zcash. Bets are encrypted
            via drand timelock beacons and transmitted directly inside shielded
            transactions (z-to-z). Outcomes mirror public Polymarket settlement
            without central custody. Nocturne does not log IP addresses, run
            tracker telemetry, or store user private keys.
          </p>
        </div>
      </div>
    </footer>
  );
}
