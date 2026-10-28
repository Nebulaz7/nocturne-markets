"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  Minimize2,
  ExternalLink,
} from "lucide-react";

const TOTAL_SCENES = 5;

export default function PitchDeckPage() {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setCurrentSceneIdx((prev) => Math.min(TOTAL_SCENES - 1, prev + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSceneIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const goToScene = (idx: number) => {
    setCurrentSceneIdx(idx);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-[#090706] text-[#fef3c7] font-sans overflow-hidden flex flex-col justify-between selection:bg-[#fb923c] selection:text-[#431407]"
    >
      {/* ========================================================
          Top Header Bar: Minimalist Identity & Numbered Scene Tabs
          ======================================================== */}
      <header className="w-full max-w-7xl mx-auto px-6 pt-6 pb-4 flex items-center justify-between border-b border-[#7c2d12]/20 z-20 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 group hover:opacity-90 transition-opacity"
        >
          <div className="relative w-8 h-8 rounded-lg bg-[#140e0b] border border-[#7c2d12]/50 flex items-center justify-center p-1">
            <Image
              src="/logo.png"
              alt="Nocturne Logo"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading font-bold text-lg text-[#fef3c7]">
              Nocturne
            </span>
            <span className="font-heading font-bold text-lg text-[#fb923c]">
              Markets
            </span>
          </div>
        </Link>

        {/* Minimal Numbered Scene Pills */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {[0, 1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              onClick={() => goToScene(idx)}
              className={`px-3 py-1 rounded-md border transition-all cursor-pointer ${
                currentSceneIdx === idx
                  ? "bg-[#201510] border-[#fb923c] text-[#fb923c] font-bold"
                  : "bg-[#0e0a08] border-[#7c2d12]/30 text-[#fef3c7]/40 hover:text-[#fef3c7] hover:border-[#7c2d12]/60"
              }`}
            >
              0{idx + 1}
            </button>
          ))}
        </div>

        {/* Minimal Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title="Fullscreen (F)"
          className="p-2 rounded-lg bg-[#0e0a08] border border-[#7c2d12]/30 text-[#fef3c7]/50 hover:text-[#fef3c7] transition-colors cursor-pointer"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </header>

      {/* ========================================================
          Center Stage: Minimalist Kinetic Motion Canvas
          ======================================================== */}
      <main
        onClick={(e) => {
          // If clicking on an interactive element (button/link/card action), do nothing
          const target = e.target as HTMLElement;
          if (target.closest("button") || target.closest("a")) return;
          // Otherwise advance on click
          if (currentSceneIdx < TOTAL_SCENES - 1) {
            setCurrentSceneIdx((prev) => prev + 1);
          }
        }}
        className="flex-1 w-full max-w-5xl mx-auto px-6 py-6 flex flex-col justify-center items-center relative z-10 overflow-hidden cursor-default select-none"
      >
        <AnimatePresence mode="wait">
          {currentSceneIdx === 0 && <SceneOnePremise key="scene-1" />}
          {currentSceneIdx === 1 && <SceneTwoProblem key="scene-2" />}
          {currentSceneIdx === 2 && <SceneThreeSolution key="scene-3" />}
          {currentSceneIdx === 3 && <SceneFourUnderTheHood key="scene-4" />}
          {currentSceneIdx === 4 && <SceneFiveLiveWalkthrough key="scene-5" />}
        </AnimatePresence>
      </main>

      {/* Empty bottom spacer to maintain vertical optical balance */}
      <div className="h-6 shrink-0" />
    </div>
  );
}

// ========================================================
// SCENE 1: The Premise
// "Predict the future. Keep your positions private."
// ========================================================
function SceneOnePremise() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-2xl flex flex-col items-center text-center"
    >
      <motion.h1
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-8"
      >
        Put Your Money Behind <br />
        <span className="text-[#fb923c]">What You Believe Will Happen.</span>
      </motion.h1>

      {/* Minimalist Prediction Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", damping: 20 }}
        className="w-full max-w-md p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 shadow-2xl text-left"
      >
        <h3 className="text-base sm:text-lg font-heading font-semibold text-[#fef3c7] mb-5">
          Will Bitcoin surpass $100k before December 31, 2026?
        </h3>

        {/* Probability Gauge */}
        <div className="mb-5">
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-[#22c55e] font-bold">YES 74%</span>
            <span className="text-[#f87171] font-bold">NO 26%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1a120e] overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "74%" }}
              transition={{ delay: 0.45, duration: 0.7, ease: "easeOut" }}
              className="h-full bg-[#22c55e]"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "26%" }}
              transition={{ delay: 0.45, duration: 0.7, ease: "easeOut" }}
              className="h-full bg-[#ef4444]"
            />
          </div>
        </div>

        {/* Flat Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <div className="py-3 px-3 rounded-xl bg-[#12281c] border border-[#22c55e]/30 text-[#22c55e] font-mono font-bold text-xs flex items-center justify-center">
            YES 74¢
          </div>
          <div className="py-3 px-3 rounded-xl bg-[#361212] border border-[#f87171]/30 text-[#f87171] font-mono font-bold text-xs flex items-center justify-center">
            NO 26¢
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 2: The Problem
// "Your bets are only as private as your public wallet address."
// ========================================================
function SceneTwoProblem() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-8"
      >
        Your Bets Are Only As Private <br />
        <span className="text-red-400">As Your Public Wallet Address.</span>
      </motion.h2>

      {/* Surveillance Tracker Layout */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-mono"
      >
        {/* Card 1: Public Wallet */}
        <div className="p-5 rounded-2xl bg-[#0e0a08] border border-red-900/30 flex flex-col justify-center min-h-[140px]">
          <span className="text-xs text-[#fef3c7]/50 block mb-2">Wallet</span>
          <span className="text-sm font-bold text-[#fef3c7] break-all">
            0x71C...4a9B
          </span>
        </div>

        {/* Card 2: Exposed Bets */}
        <div className="p-5 rounded-2xl bg-[#0e0a08] border border-red-900/30 flex flex-col justify-center min-h-[140px] space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#fef3c7]/60">Fed Rate Cut</span>
            <span className="text-red-400 font-bold">$5,000 NO</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#fef3c7]/60">Election Winner</span>
            <span className="text-red-400 font-bold">$12,500 YES</span>
          </div>
        </div>

        {/* Card 3: Result */}
        <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/40 flex flex-col justify-center min-h-[140px]">
          <span className="text-xs text-red-400/80 block mb-1">Exposure</span>
          <span className="text-xl font-heading font-bold text-[#fef3c7]">
            Financial Privacy = 0%
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 3: Enter Nocturne Markets
// "Public Prices. Private People."
// ========================================================
function SceneThreeSolution() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-8"
      >
        Public Prices. <br />
        <span className="text-[#fb923c]">Private People.</span>
      </motion.h2>

      {/* Architecture Split-Screen Diagram */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 text-left font-mono"
      >
        {/* Left: Polymarket Oracle Mirror */}
        <div className="p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 flex flex-col justify-between min-h-[160px]">
          <span className="text-xs text-[#fb923c] font-bold">
            Polymarket Gamma API
          </span>
          <h4 className="text-xl font-heading font-bold text-[#fef3c7]">
            Public Oracle Mirror
          </h4>
          <span className="text-xs text-[#fef3c7]/40">
            Read-Only Reference Odds
          </span>
        </div>

        {/* Right: Shielded Zcash Pool */}
        <div className="p-6 rounded-2xl bg-[#0e0a08] border border-[#fb923c]/50 flex flex-col justify-between min-h-[160px] shadow-xl">
          <span className="text-xs text-[#fb923c] font-bold">
            Zcash Shielded Pool
          </span>
          <h4 className="text-xl font-heading font-bold text-[#fef3c7]">
            Private Parimutuel Pot
          </h4>
          <span className="text-xs text-[#22c55e]">
            Shielded Balances · Batched Payouts
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 4: Under The Hood
// "Zero Accounts. Zero Sign-Ins. Zero HTTP Write Requests."
// ========================================================
function SceneFourUnderTheHood() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-8"
      >
        Zero Accounts. Zero Sign-Ins. <br />
        <span className="text-[#fb923c]">Zero HTTP Write Requests.</span>
      </motion.h2>

      {/* Dual Envelope Wireframe Diagram */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 shadow-2xl text-left font-mono"
      >
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#7c2d12]/20">
          <span className="text-sm font-bold text-[#fef3c7]">
            NOC2: Wire Memo
          </span>
          <span className="text-xs text-[#fb923c] font-bold">
            500 Characters Padded
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Envelope 1 */}
          <div className="p-4 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#fb923c] font-bold">Timelock Envelope</span>
              <span className="text-[#fef3c7]/40">217B</span>
            </div>
            <span className="text-sm font-heading font-bold text-[#22c55e]">
              drand Quicknet Round
            </span>
          </div>

          {/* Envelope 2 */}
          <div className="p-4 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex flex-col justify-between min-h-[110px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#fb923c] font-bold">Payout Envelope</span>
              <span className="text-[#fef3c7]/40">120B</span>
            </div>
            <span className="text-sm font-heading font-bold text-[#fef3c7]">
              TweetNaCl Box · Orchard UA
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 5: Live Walkthrough Bridge
// "Nocturne Markets In Action."
// ========================================================
function SceneFiveLiveWalkthrough() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-8"
      >
        Nocturne Markets In Action.
      </motion.h2>

      {/* 3 Direct Quick-Launch Doors */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left font-mono"
      >
        {/* Door 1: Homepage & Teleporter */}
        <Link
          href="/"
          target="_blank"
          className="p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 hover:border-[#fb923c] transition-all group flex flex-col justify-between min-h-[140px]"
        >
          <span className="text-xs text-[#fb923c] font-bold">01</span>
          <h4 className="text-lg font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors">
            Browse & Teleport
          </h4>
          <div className="flex items-center gap-1 text-xs text-[#fef3c7]/50 group-hover:text-[#fb923c]">
            <span>Open</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Door 2: 5-Minute Blitz Demo Market */}
        <Link
          href="/blitz"
          target="_blank"
          className="p-6 rounded-2xl bg-[#0e0a08] border border-[#ea580c]/50 hover:border-[#fb923c] transition-all group flex flex-col justify-between min-h-[140px] shadow-xl"
        >
          <span className="text-xs text-emerald-400 font-bold">02</span>
          <h4 className="text-lg font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors">
            Blitz Demo
          </h4>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <span>Open</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Door 3: Private Vault & Audit Drawer */}
        <Link
          href="/vault"
          target="_blank"
          className="p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 hover:border-[#fb923c] transition-all group flex flex-col justify-between min-h-[140px]"
        >
          <span className="text-xs text-[#fb923c] font-bold">03</span>
          <h4 className="text-lg font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors">
            Vault & Audit
          </h4>
          <div className="flex items-center gap-1 text-xs text-[#fef3c7]/50 group-hover:text-[#fb923c]">
            <span>Open</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
