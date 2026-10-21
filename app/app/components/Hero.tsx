"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Shield,
  Lock,
  ArrowUpRight,
  Activity,
  Zap,
  Layers,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// Platform stats matching Nocturne Markets architectural invariants
const PLATFORM_STATS = [
  { label: "Active Pools", value: "12" },
  { label: "Protocol Fee", value: "2% on Profit" },
  { label: "Resolution", value: "Polymarket Gamma" },
  { label: "Timelock Beacon", value: "drand Quicknet" },
  { label: "Privacy Invariant", value: "Zero-POST (100%)" },
];

// Live prediction ticker data (Clean text, no emojis)
const TICKER_ITEMS = [
  { title: "Fed Rate Cut Q2", yes: 68, change: 1 },
  { title: "BTC $150K in 2026", yes: 31, change: 3 },
  { title: "ETH > $10K", yes: 42, change: -2 },
  { title: "US Recession 2026", yes: 19, change: 1 },
  { title: "5m BTC Blitz Demo", yes: 54, change: 4 },
  { title: "SOL > ETH Flippening", yes: 9, change: 2 },
  { title: "OpenAI IPO 2026", yes: 38, change: 0 },
  { title: "EU AI Act Fine", yes: 24, change: -1 },
  { title: "Arctic Ice Record 2026", yes: 33, change: -1 },
];

const HERO_CARD_IMAGES = {
  main: "https://www.cryptotimes.io/wp-content/uploads/2026/07/Zcash-ZEC-Rockets-Past-500-on-Ironwood-Upgrade-Momentum-Whats-Next.jpg",
  crypto:
    "https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80",
  portfolio:
    "https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&q=80",
} as const;

function RightBlendLayer({
  imageUrl,
  widthClass = "w-[52%]",
  tintColor = "rgba(124,45,18,0.25)",
}: {
  imageUrl: string;
  widthClass?: string;
  tintColor?: string;
}) {
  const blendMask =
    "linear-gradient(to left, rgba(0,0,0,1) 48%, rgba(0,0,0,0.88) 63%, rgba(0,0,0,0.34) 82%, rgba(0,0,0,0.06) 94%, transparent 100%)";

  return (
    <div
      className={`absolute inset-y-0 right-0 ${widthClass} pointer-events-none`}
    >
      <div
        className="absolute inset-0 opacity-[0.82]"
        style={{
          backgroundImage: `url("${imageUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.7) saturate(1.15) contrast(1.1)",
          WebkitMaskImage: blendMask,
          maskImage: blendMask,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to left, rgba(9,7,6,0.92) 0%, rgba(20,14,11,0.65) 46%, ${tintColor} 76%, rgba(9,7,6,0.12) 100%)`,
          WebkitMaskImage: blendMask,
          maskImage: blendMask,
        }}
      />
    </div>
  );
}

export default function Hero() {
  const openVault = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nocturne-vault-updated"));
      // Trigger native click on the Private Vault button in navbar if available
      const vaultBtn = document.querySelector<HTMLButtonElement>(
        'button[title*="shielded receipts"]',
      );
      if (vaultBtn) {
        vaultBtn.click();
      }
    }
  };

  return (
    <section className="relative overflow-hidden bg-[#090706] text-[#fef3c7]">
      {/* Ambient background glow layers matching Nocturne Warm Ember identity */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(234,88,12,0.14),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_85%_50%,rgba(124,45,18,0.10),transparent)] pointer-events-none" />
      {/* <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(254,243,199,1) 1px, transparent 1px), linear-gradient(90deg, rgba(254,243,199,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      /> */}

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        {/* Hero banner grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-auto md:h-80">
          {/* Big primary banner (col-span-2) */}
          <Link
            href="/#markets"
            className="md:col-span-2 relative group rounded-2xl overflow-hidden cursor-pointer block h-full min-h-[260px] md:min-h-0 border border-[#7c2d12]/40 hover:border-[#fb923c]/70 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          >
            {/* Deep Obsidian Rust Background */}
            <div className="absolute inset-0 bg-linear-to-br from-[#2a1209]/95 via-[#1a0c06] to-[#090706] transition-transform duration-700 group-hover:scale-[1.01]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,0.18),transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(124,45,18,0.35),transparent_60%)]" />

            <RightBlendLayer
              imageUrl={HERO_CARD_IMAGES.main}
              tintColor="rgba(124,45,18,0.3)"
            />

            {/* Rotating decorative concentric rings in Nocturne Ember */}
            {[170, 250, 330].map((size, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-[#fb923c]/10"
                style={{
                  width: size,
                  height: size,
                  right: -size / 3.5,
                  top: -size / 3.5,
                }}
                animate={{ rotate: [0, 360] }}
                transition={{
                  duration: 28 + i * 14,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}

            <div className="relative h-full flex flex-col justify-between p-6 sm:p-8 z-10">
              <div className="space-y-3 max-w-lg">
                {/* Main Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 }}
                  className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-[#fef3c7] tracking-tight leading-tight"
                >
                  Trade on public outcomes.{" "}
                  <span className="text-[#fb923c]">Privately & shielded.</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.12 }}
                  className="text-[#fef3c7]/75 text-xs sm:text-sm md:text-base leading-relaxed font-sans"
                >
                  Mirroring Polymarket events with shielded Zcash parimutuel
                  pools. Time-sealed to the drand Quicknet beacon with zero IP
                  write leaks.
                </motion.p>
              </div>

              {/* Action Buttons & Shield Illustration */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.18 }}
                className="flex items-end justify-between pt-4"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="btn-monad-base btn-ember px-5 py-2.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 shadow-lg group/btn cursor-pointer">
                    <span>Browse Markets</span>
                    <ChevronRight
                      className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform"
                      strokeWidth={2.5}
                    />
                  </span>
                  <Link
                    href="/docs"
                    className="btn-monad-base btn-void px-4 py-2.5 rounded-full text-xs font-mono flex items-center gap-1.5 text-[#fef3c7]/80 hover:text-[#fb923c] border border-[#7c2d12]/60 hover:border-[#fb923c]/60 transition-all cursor-pointer"
                  >
                    <Lock
                      className="w-3.5 h-3.5 text-[#fb923c]"
                      strokeWidth={2}
                    />
                    <span>How Privacy Works</span>
                  </Link>
                </div>

                {/* Animated Shield Graphic */}
                <div className="relative shrink-0 opacity-60 group-hover:opacity-90 transition-opacity duration-500 hidden xs:block">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#fb923c]/20 blur-2xl"
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <Shield className="relative w-20 h-20 md:w-24 md:h-24 text-[#7c2d12]/50 stroke-1 fill-[#140e0b]/70" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock
                      className="w-8 h-8 md:w-9 md:h-9 text-[#fb923c]"
                      strokeWidth={1.75}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </Link>

          {/* Side stacked cards (col-span-1) */}
          <div className="flex flex-col gap-4 h-full">
            {/* Card 1: 5-Minute Blitz / Crypto */}
            <Link
              href="/?cat=blitz"
              className="flex-1 relative rounded-2xl overflow-hidden group cursor-pointer border border-[#7c2d12]/40 hover:border-[#fb923c]/60 block min-h-[130px] transition-all duration-300 shadow-md"
            >
              <div className="absolute inset-0 bg-linear-to-br from-[#301308] to-[#0c0806] transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,146,60,0.22),transparent_70%)]" />
              <RightBlendLayer
                widthClass="w-[58%]"
                imageUrl={HERO_CARD_IMAGES.crypto}
                tintColor="rgba(124,45,18,0.25)"
              />
              <div className="relative p-4 sm:p-5 h-full flex flex-col justify-between z-10">
                <div>
                  <div className="text-[10px] font-mono font-bold text-[#fb923c] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Zap className="w-3 h-3 text-[#fb923c]" />
                    <span>5-Minute Blitz</span>
                  </div>
                  <h3 className="text-lg font-heading font-bold text-[#fef3c7] tracking-tight">
                    ZEC · BTC · ETH
                  </h3>
                  <p className="text-[#fef3c7]/60 text-xs mt-0.5 font-sans">
                    Fast 5m settlement demo cycle
                  </p>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="btn-monad-base btn-void text-[11px] font-mono px-3 py-1.5 rounded-full text-[#fef3c7] border border-[#7c2d12]/50 hover:border-[#fb923c] transition-colors flex items-center gap-1">
                    <span>Trade Blitz</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fb923c]" />
                  </span>
                  <span className="text-3xl font-mono font-black text-[#fef3c7]/5 leading-none select-none tracking-tighter">
                    BLITZ
                  </span>
                </div>
              </div>
            </Link>

            {/* Card 2: Shielded Private Vault / Portfolio */}
            <div
              onClick={openVault}
              className="flex-1 relative rounded-2xl overflow-hidden group cursor-pointer border border-[#7c2d12]/40 hover:border-[#ea580c]/60 block min-h-[130px] transition-all duration-300 shadow-md"
            >
              <div className="absolute inset-0 bg-linear-to-br from-[#1c120c] to-[#090706] transition-transform duration-500 group-hover:scale-[1.02]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(254,243,199,0.1),transparent_65%)]" />
              <RightBlendLayer
                widthClass="w-[58%]"
                imageUrl={HERO_CARD_IMAGES.portfolio}
                tintColor="rgba(67,20,7,0.3)"
              />
              <div className="relative p-4 sm:p-5 h-full flex flex-col justify-between z-10">
                <div>
                  <div className="text-[10px] font-mono font-bold text-[#fed7aa] uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Layers className="w-3 h-3 text-[#fed7aa]" />
                    <span>Private Local Vault</span>
                  </div>
                  <h3 className="text-lg font-heading font-bold text-[#fef3c7] tracking-tight">
                    Shielded Receipts
                  </h3>
                  <p className="text-[#fef3c7]/60 text-xs mt-0.5 font-sans">
                    Client-side encrypted · Zero sign-in
                  </p>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <button
                    type="button"
                    className="btn-monad-base btn-void text-[11px] font-mono px-3 py-1.5 rounded-full text-[#fef3c7] border border-[#7c2d12]/50 hover:border-[#fb923c] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Vault</span>
                    <ArrowUpRight className="w-3 h-3 text-[#fb923c]" />
                  </button>
                  {/* Micro sparkline indicator bars in Nocturne Ember */}
                  <div className="flex items-end gap-1">
                    {[3, 5, 4, 7, 5, 8, 6, 9].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-xs bg-[#fb923c]/40 group-hover:bg-[#fb923c] transition-colors"
                        style={{ height: h * 2.5 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform stats strip */}
        <div className="mt-4 flex items-center justify-between overflow-x-auto no-scrollbar gap-4 sm:gap-6 border-t border-b border-[#7c2d12]/30 py-3 text-xs font-mono">
          {PLATFORM_STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="flex items-baseline gap-2 shrink-0"
            >
              <span className="text-xs sm:text-sm font-bold text-[#fef3c7] tabular-nums">
                {stat.value}
              </span>
              <span className="text-[11px] text-[#fef3c7]/50 font-sans">
                {stat.label}
              </span>
              {i < PLATFORM_STATS.length - 1 && (
                <span className="ml-3 sm:ml-4 text-[#7c2d12]/50 select-none">
                  |
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Live market ticker (Smooth continuous marquee, no emojis) */}
        <div className="mt-3 relative overflow-hidden rounded-xl bg-[#120d0a] border border-[#7c2d12]/40 h-9 flex items-center select-none">
          {/* Subtle edge fade overlays */}
          <div className="absolute left-0 z-10 h-full w-20 bg-linear-to-r from-[#120d0a] to-transparent pointer-events-none" />
          <div className="absolute right-0 z-10 h-full w-20 bg-linear-to-l from-[#120d0a] to-transparent pointer-events-none" />

          {/* Sticky Activity Label (No emojis) */}
          <div className="absolute left-0 z-20 h-full flex items-center px-3 gap-1.5 text-[10px] font-mono font-bold text-[#fb923c] uppercase tracking-wider bg-[#120d0a] border-r border-[#7c2d12]/40">
            <Activity
              className="w-3 h-3 text-[#ea580c] animate-pulse"
              strokeWidth={2.5}
            />
            <span>LIVE</span>
          </div>

          {/* Scrolling ticker track */}
          <motion.div
            className="flex items-center gap-7 pl-20 pr-4"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 42, repeat: Infinity, ease: "linear" }}
            style={{ willChange: "transform" }}
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-2 text-xs font-mono whitespace-nowrap"
              >
                <span className="text-[#fef3c7]/80 font-sans font-medium text-xs">
                  {item.title}
                </span>
                <span
                  className={`font-mono font-bold ${
                    item.yes >= 50 ? "text-[#fb923c]" : "text-[#fef3c7]/60"
                  }`}
                >
                  {item.yes}¢ YES
                </span>
                {item.change !== 0 && (
                  <span
                    className={`inline-flex items-center text-[10px] font-mono font-semibold ${
                      item.change > 0 ? "text-emerald-400" : "text-amber-500"
                    }`}
                  >
                    {item.change > 0 ? (
                      <ArrowUp className="w-2.5 h-2.5 mr-0.5" strokeWidth={3} />
                    ) : (
                      <ArrowDown
                        className="w-2.5 h-2.5 mr-0.5"
                        strokeWidth={3}
                      />
                    )}
                    {Math.abs(item.change)}%
                  </span>
                )}
                <span className="text-[#7c2d12]/50 text-sm leading-none pl-1">
                  •
                </span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
