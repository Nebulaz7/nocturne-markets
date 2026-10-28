"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Lock,
  Eye,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Type,
  ExternalLink,
  CheckCircle2,
  FileCode2,
  Radio,
  Zap,
} from "lucide-react";

interface SceneConfig {
  id: number;
  timeRange: string;
  durationSec: number;
  title: string;
  tagline: string;
  voiceover: string;
}

const SCENES: SceneConfig[] = [
  {
    id: 1,
    timeRange: "0:00 – 0:14",
    durationSec: 14,
    title: "The Premise",
    tagline: "Predict the future. Keep your positions private.",
    voiceover:
      "Nocturne Markets. Predict the future. Keep your positions private. Prediction markets let you put your money behind what you believe will happen. Choose a market, pick an outcome, place your bet, and wait for the results.",
  },
  {
    id: 2,
    timeRange: "0:14 – 0:34",
    durationSec: 20,
    title: "The Problem",
    tagline: "Transparent blockchains expose your identity & bets.",
    voiceover:
      "But there's a problem: your bets are only as private as your wallet. On transparent blockchains, anyone with your public wallet address can trace your prediction market activity. They can see the positions you take, track your winnings and losses, monitor your transactions, and connect your financial activity to your real-world identity. It could be a friend you've sent tokens to, a website you've interacted with, or a stranger on the internet.",
  },
  {
    id: 3,
    timeRange: "0:34 – 0:50",
    durationSec: 16,
    title: "Enter Nocturne Markets",
    tagline: "Public prices. Shielded Zcash pools.",
    voiceover:
      "Your predictions are yours. Your financial activity should be, too. Introducing Nocturne Markets. Nocturne Markets brings true privacy to prediction markets by mirroring live Polymarket events into independent, shielded Zcash pools. Our goal is simple: let you trade on real-world outcomes without exposing your financial activity to the world.",
  },
  {
    id: 4,
    timeRange: "0:50 – 1:05",
    durationSec: 15,
    title: "Under The Hood",
    tagline: "Zero-POST · drand Timelock · Dual-Envelope Memos",
    voiceover:
      "With Nocturne, there are no accounts, no sign-ins, and no wallet connections. When you place a bet, your choice is time-locked until the market closes, and your payout address is sealed inside an encrypted Zcash memo. Because making predictions should be about what you believe will happen—not about who is watching you.",
  },
  {
    id: 5,
    timeRange: "1:05 – 2:00",
    durationSec: 55,
    title: "Live Walkthrough",
    tagline: "Screen record the live app in action.",
    voiceover:
      "Here is Nocturne Markets in action. You can browse live mirrored markets across Politics, Crypto, Sports, and more—or copy any trade link directly from Polymarket and paste it into our search bar. Nocturne matches the market instantly in local browser memory without leaking a single search query to outside servers.",
  },
];

export default function PitchDeckPage() {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentScene = SCENES[currentSceneIdx];

  // Cumulative start times
  const sceneStartTimes = [0, 14, 34, 50, 65];

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setCurrentSceneIdx((prev) => Math.min(SCENES.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSceneIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setShowSubtitles((prev) => !prev);
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

  // Fullscreen toggle
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

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 0.1;
        if (next >= 65) {
          setCurrentSceneIdx(4);
        } else if (next >= 50) {
          setCurrentSceneIdx(3);
        } else if (next >= 34) {
          setCurrentSceneIdx(2);
        } else if (next >= 14) {
          setCurrentSceneIdx(1);
        } else {
          setCurrentSceneIdx(0);
        }

        if (next >= 120) {
          setIsPlaying(false);
          return 120;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Jump to scene
  const goToScene = (idx: number) => {
    setCurrentSceneIdx(idx);
    setElapsedSec(sceneStartTimes[idx]);
  };

  const restartPresentation = () => {
    setCurrentSceneIdx(0);
    setElapsedSec(0);
    setIsPlaying(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen bg-[#090706] text-[#fef3c7] font-sans overflow-hidden flex flex-col justify-between selection:bg-[#fb923c] selection:text-[#431407]"
    >
      {/* ========================================================
          Top Header Bar: Minimalist Identity & Presenter HUD
          ======================================================== */}
      <header className="w-full max-w-7xl mx-auto px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#7c2d12]/20 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
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

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/40 font-bold uppercase tracking-wider ml-2">
            Pitch Deck · 60fps
          </span>
        </div>

        {/* Scene Pill Indicators */}
        <div className="hidden md:flex items-center gap-2 font-mono text-xs">
          {SCENES.map((scene, idx) => (
            <button
              key={scene.id}
              onClick={() => goToScene(idx)}
              className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                currentSceneIdx === idx
                  ? "bg-[#201510] border-[#fb923c] text-[#fb923c] font-bold shadow-sm"
                  : "bg-[#0e0a08] border-[#7c2d12]/30 text-[#fef3c7]/60 hover:text-[#fef3c7] hover:border-[#7c2d12]/70"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{scene.title}</span>
              <span className="text-[10px] text-[#fef3c7]/40 hidden lg:inline">
                ({scene.timeRange})
              </span>
            </button>
          ))}
        </div>

        {/* Presenter Utilities */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setShowSubtitles((prev) => !prev)}
            title="Toggle Voiceover Subtitles (T)"
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              showSubtitles
                ? "bg-[#201510] border-[#fb923c]/60 text-[#fb923c]"
                : "bg-[#0e0a08] border-[#7c2d12]/30 text-[#fef3c7]/60 hover:text-[#fef3c7]"
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen (F)"
            className="p-2 rounded-lg bg-[#0e0a08] border border-[#7c2d12]/30 text-[#fef3c7]/60 hover:text-[#fef3c7] hover:border-[#7c2d12]/70 transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* ========================================================
          Center Stage: Kinetic Motion Canvas (Scenes 1 - 5)
          ======================================================== */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col justify-center items-center relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {currentSceneIdx === 0 && <SceneOnePremise key="scene-1" />}
          {currentSceneIdx === 1 && <SceneTwoProblem key="scene-2" />}
          {currentSceneIdx === 2 && <SceneThreeSolution key="scene-3" />}
          {currentSceneIdx === 3 && <SceneFourUnderTheHood key="scene-4" />}
          {currentSceneIdx === 4 && <SceneFiveLiveWalkthrough key="scene-5" />}
        </AnimatePresence>
      </main>

      {/* ========================================================
          Bottom Bar: Subtitles / Voiceover Teleprompter & Controls
          ======================================================== */}
      <footer className="w-full max-w-5xl mx-auto px-6 pb-6 pt-2 z-20 shrink-0">
        {/* Animated Voiceover Caption */}
        {showSubtitles && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-4 p-3.5 rounded-xl bg-[#0e0a08]/90 border border-[#7c2d12]/40 backdrop-blur-md shadow-2xl text-center"
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#fb923c] font-bold block mb-1">
              ElevenLabs Voiceover · {currentScene.timeRange}
            </span>
            <p className="text-sm sm:text-base font-sans text-[#fef3c7] leading-relaxed max-w-4xl mx-auto font-medium">
              &ldquo;{currentScene.voiceover}&rdquo;
            </p>
          </motion.div>
        )}

        {/* Playback Controls & Progress Bar */}
        <div className="flex items-center justify-between gap-4 p-2.5 rounded-xl bg-[#0e0a08] border border-[#7c2d12]/30 font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] border border-[#7c2d12]/40 text-[#fb923c] transition-colors cursor-pointer flex items-center gap-1.5 font-bold"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Auto-Play</span>
                </>
              )}
            </button>

            <button
              onClick={restartPresentation}
              title="Restart Presentation"
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] border border-[#7c2d12]/40 text-[#fef3c7]/60 hover:text-[#fef3c7] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 rounded bg-[#140e0b] border border-[#7c2d12]/20 text-[#fef3c7]/80">
              <span className="text-[#fb923c] font-bold">
                {Math.floor(elapsedSec / 60)}:
                {String(Math.floor(elapsedSec % 60)).padStart(2, "0")}
              </span>{" "}
              / 2:00
            </div>
          </div>

          {/* Timeline scrubber bar */}
          <div className="flex-1 max-w-md mx-2 h-2 rounded-full bg-[#140e0b] border border-[#7c2d12]/30 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-[#7c2d12] to-[#fb923c] transition-all duration-100"
              style={{ width: `${(elapsedSec / 120) * 100}%` }}
            />
          </div>

          {/* Next / Previous Scene Arrows */}
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentSceneIdx === 0}
              onClick={() => goToScene(currentSceneIdx - 1)}
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] disabled:opacity-30 disabled:pointer-events-none border border-[#7c2d12]/40 text-[#fef3c7]/80 hover:text-[#fef3c7] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-[#fef3c7]/50 font-bold">
              {currentSceneIdx + 1} / {SCENES.length}
            </span>

            <button
              disabled={currentSceneIdx === SCENES.length - 1}
              onClick={() => goToScene(currentSceneIdx + 1)}
              className="p-2 rounded-lg bg-[#140e0b] hover:bg-[#201510] disabled:opacity-30 disabled:pointer-events-none border border-[#7c2d12]/40 text-[#fef3c7]/80 hover:text-[#fef3c7] transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ========================================================
// SCENE 1: The Premise (0:00 – 0:14)
// "Prediction markets let you put your money behind what you believe."
// ========================================================
function SceneOnePremise() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-3xl flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#140e0b] border border-[#7c2d12]/50 text-xs font-mono text-[#fb923c] mb-5 uppercase tracking-wider"
      >
        <Radio className="w-3.5 h-3.5 animate-pulse text-[#fb923c]" />
        <span>Public Prices · Live Prediction Markets</span>
      </motion.div>

      <motion.h1
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-3"
      >
        Put Your Money Behind <br />
        <span className="text-[#fb923c]">What You Believe Will Happen.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-base sm:text-lg text-[#fef3c7]/70 font-sans max-w-xl mb-8"
      >
        Pick a market. Choose an outcome. Place your trade. Wait for the resolution.
      </motion.p>

      {/* Minimalist Live Prediction Card */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, type: "spring", damping: 20 }}
        className="w-full max-w-md p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 shadow-2xl text-left"
      >
        <div className="flex items-center justify-between text-xs font-mono text-[#fef3c7]/50 mb-3">
          <span className="px-2 py-0.5 rounded bg-[#160f0c] border border-[#7c2d12]/30 text-[#fb923c] font-semibold">
            CRYPTO · MACRO
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE MARKET
          </span>
        </div>

        <h3 className="text-base font-heading font-semibold text-[#fef3c7] mb-4">
          Will Bitcoin surpass $100k before December 31, 2026?
        </h3>

        {/* Odds Probability Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs font-mono mb-1.5">
            <span className="text-[#22c55e] font-bold">YES 74%</span>
            <span className="text-[#f87171] font-bold">NO 26%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1a120e] overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "74%" }}
              transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
              className="h-full bg-[#22c55e]"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "26%" }}
              transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
              className="h-full bg-[#ef4444]"
            />
          </div>
        </div>

        {/* Flat High-Contrast Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="py-2.5 px-3 rounded-xl bg-[#12281c] border border-[#22c55e]/30 text-[#22c55e] font-mono font-bold text-xs flex items-center justify-center">
            Trade YES 74¢
          </div>
          <div className="py-2.5 px-3 rounded-xl bg-[#361212] border border-[#f87171]/30 text-[#f87171] font-mono font-bold text-xs flex items-center justify-center">
            Trade NO 26¢
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 2: The Problem (0:14 – 0:34)
// "On transparent blockchains, anyone can trace your activity."
// ========================================================
function SceneTwoProblem() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/40 text-xs font-mono text-red-400 mb-5 uppercase tracking-wider"
      >
        <Eye className="w-3.5 h-3.5" />
        <span>The Vulnerability · Public Blockchain Exposure</span>
      </motion.div>

      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-3"
      >
        Your Bets Are Only As Private <br />
        <span className="text-red-400">As Your Public Wallet Address.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-base sm:text-lg text-[#fef3c7]/70 font-sans max-w-2xl mb-8"
      >
        Positions, stakes, wins, and losses are completely public. Anyone can connect your financial convictions to your real identity.
      </motion.p>

      {/* Surveillance Tracker Wireframe Diagram */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-mono"
      >
        {/* Step 1: Public Wallet */}
        <div className="p-4 rounded-xl bg-[#0e0a08] border border-red-900/30 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-red-400/80 uppercase font-bold block mb-1">
              Public Address
            </span>
            <span className="text-xs text-[#fef3c7] font-semibold break-all">
              0x71C...4a9B
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-red-950/60 text-[11px] text-[#fef3c7]/50">
            Friend sent tokens, exchange KYC linked.
          </div>
        </div>

        {/* Step 2: Exposed Prediction Activity */}
        <div className="p-4 rounded-xl bg-[#0e0a08] border border-red-900/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full pointer-events-none" />
          <div>
            <span className="text-[10px] text-red-400/80 uppercase font-bold block mb-1">
              Transparent Bets
            </span>
            <div className="space-y-1.5 text-xs text-[#fef3c7]/80">
              <div className="flex justify-between">
                <span>Fed Rate Cut:</span>
                <span className="text-red-400 font-bold">$5,000 NO</span>
              </div>
              <div className="flex justify-between">
                <span>Election Winner:</span>
                <span className="text-red-400 font-bold">$12,500 YES</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-red-950/60 text-[11px] text-red-400 font-semibold">
            Positions and portfolio exposed to the world.
          </div>
        </div>

        {/* Step 3: Identity Linked */}
        <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/40 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-red-400 uppercase font-bold flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
              Surveillance Result
            </span>
            <span className="text-sm font-heading font-bold text-[#fef3c7]">
              Financial Privacy = 0%
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-red-900/40 text-[11px] text-[#fef3c7]/70 leading-relaxed">
            Strangers, websites, and counterparties can monitor and copy-trade your every move.
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 3: The Solution (0:34 – 0:50)
// "Introducing Nocturne Markets: Polymarket mirror + Shielded Zcash pools."
// ========================================================
function SceneThreeSolution() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#140e0b] border border-[#7c2d12]/60 text-xs font-mono text-[#fb923c] mb-5 uppercase tracking-wider"
      >
        <Shield className="w-3.5 h-3.5 text-[#fb923c]" />
        <span>The Solution · Shielded Parimutuel Pools</span>
      </motion.div>

      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-3"
      >
        Public Prices. <br />
        <span className="text-[#fb923c]">Private People.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-base sm:text-lg text-[#fef3c7]/70 font-sans max-w-xl mb-8"
      >
        Mirror live Polymarket events into independent shielded Zcash pools. Real market data, complete financial privacy.
      </motion.p>

      {/* Architecture Split-Screen Diagram */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 text-left font-mono"
      >
        {/* Left: Polymarket Oracle Mirror */}
        <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[#fb923c] font-bold uppercase tracking-wider">
                Reference Layer
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#160f0c] text-[#fef3c7]/60 border border-[#7c2d12]/30">
                Polymarket Gamma API
              </span>
            </div>
            <h4 className="text-base font-heading font-semibold text-[#fef3c7] mb-2">
              Read-Only Market Mirror
            </h4>
            <p className="text-xs text-[#fef3c7]/60 leading-relaxed font-sans">
              Real-world questions, live reference odds, and UMA oracle outcomes are synced. Never requires accounts or wallet connects.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 text-[11px] text-[#22c55e] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero IP Leaks · In-Memory URL Teleportation</span>
          </div>
        </div>

        {/* Right: Shielded Zcash Pool */}
        <div className="p-5 rounded-2xl bg-[#0e0a08] border border-[#fb923c]/50 flex flex-col justify-between relative shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-[#fb923c] font-bold uppercase tracking-wider">
                Settlement Layer
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#431407] text-[#fb923c] border border-[#ea580c]/50 font-bold">
                Zcash Shielded Pool
              </span>
            </div>
            <h4 className="text-base font-heading font-semibold text-[#fef3c7] mb-2">
              Independent Parimutuel Pot
            </h4>
            <p className="text-xs text-[#fef3c7]/60 leading-relaxed font-sans">
              Bets send to the exact same pot address. Stakes are shielded, positions are hidden until close, and payouts are batched.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 text-[11px] text-[#fb923c] font-semibold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>100% Shielded Orchard · Parimutuel Math</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 4: Under The Hood (0:50 – 1:05)
// "No accounts, no sign-ins. Time-locked choice & encrypted memo."
// ========================================================
function SceneFourUnderTheHood() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#140e0b] border border-[#7c2d12]/60 text-xs font-mono text-[#fb923c] mb-5 uppercase tracking-wider"
      >
        <Lock className="w-3.5 h-3.5 text-[#fb923c]" />
        <span>Cryptographic Core · Zero-POST Dual Envelope</span>
      </motion.div>

      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-3"
      >
        Zero Accounts. Zero Sign-Ins. <br />
        <span className="text-[#fb923c]">Zero HTTP Write Requests.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-base sm:text-lg text-[#fef3c7]/70 font-sans max-w-xl mb-8"
      >
        Your choice is timelocked to market close via drand Quicknet. Your payout address is sealed inside a 500-character encrypted Zcash memo.
      </motion.p>

      {/* Dual Envelope Wireframe Diagram */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="w-full p-6 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 shadow-2xl text-left font-mono"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#7c2d12]/20">
          <span className="text-xs font-bold text-[#fef3c7] flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#fb923c]" />
            NOC2: Wire Memo Structure (Strictly 500 Chars / Padded)
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#140e0b] text-[#fb923c] border border-[#ea580c]/30 font-bold">
            ZIP-321 Compatible
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Envelope 1: Timelocked Side */}
          <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#fb923c] font-bold">1. Timelock Envelope (217B)</span>
              <span className="text-[10px] text-[#fef3c7]/40">drand Quicknet</span>
            </div>
            <p className="text-xs text-[#fef3c7]/70 font-sans">
              Contains <strong className="text-[#22c55e]">Side (YES/NO)</strong> + secret. Encrypted to future round. Unreadable by coordinator or public until close.
            </p>
          </div>

          {/* Envelope 2: Boxed Payout UA */}
          <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#fb923c] font-bold">2. Payout Envelope (120B)</span>
              <span className="text-[10px] text-[#fef3c7]/40">TweetNaCl Box</span>
            </div>
            <p className="text-xs text-[#fef3c7]/70 font-sans">
              Bettor&apos;s Orchard address compressed via Bech32m. Encrypted strictly to coordinator key for confidential shielded payouts.
            </p>
          </div>
        </div>

        {/* Local Verification Guarantee */}
        <div className="pt-3 border-t border-[#7c2d12]/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#fef3c7]/60">
          <span className="flex items-center gap-1.5 text-[#22c55e]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Built 100% in browser WebCrypto · Saved to Local Vault</span>
          </span>
          <span className="text-[11px] text-[#fef3c7]/40">
            Public Merkle Root published on market close
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ========================================================
// SCENE 5: Live Walkthrough Bridge (1:05 – 2:00)
// "Here is Nocturne Markets in action..."
// ========================================================
function SceneFiveLiveWalkthrough() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-4xl flex flex-col items-center text-center"
    >
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#140e0b] border border-emerald-500/40 text-xs font-mono text-emerald-400 mb-5 uppercase tracking-wider"
      >
        <Zap className="w-3.5 h-3.5 text-emerald-400" />
        <span>Part 2 · Live Application Demo</span>
      </motion.div>

      <motion.h2
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="text-3xl sm:text-5xl font-heading font-bold text-[#fef3c7] tracking-tight mb-3"
      >
        See Nocturne Markets In Action.
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="text-base sm:text-lg text-[#fef3c7]/70 font-sans max-w-xl mb-8"
      >
        Ready to screen record Part 2. Switch to the live application tabs below to complete your 2-minute submission demo.
      </motion.p>

      {/* 3 Direct Quick-Launch Doors */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-left font-mono"
      >
        {/* Door 1: Homepage & Teleporter */}
        <Link
          href="/"
          target="_blank"
          className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 hover:border-[#fb923c] transition-all group flex flex-col justify-between"
        >
          <div>
            <span className="text-[10px] text-[#fb923c] font-bold uppercase block mb-1">
              Step 1 (1:05 – 1:23)
            </span>
            <h4 className="text-base font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors mb-2">
              Browse & Teleport
            </h4>
            <p className="text-xs text-[#fef3c7]/60 font-sans leading-relaxed">
              Showcase category tabs & paste a Polymarket URL into the zero-leak search bar.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 text-xs text-[#fb923c] font-bold flex items-center gap-1">
            <span>Open Homepage</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Door 2: 5-Minute Blitz Demo Market */}
        <Link
          href="/blitz"
          target="_blank"
          className="p-5 rounded-2xl bg-[#0e0a08] border border-[#ea580c]/50 hover:border-[#fb923c] transition-all group flex flex-col justify-between shadow-xl"
        >
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase block mb-1">
              Step 2 (1:23 – 1:45)
            </span>
            <h4 className="text-base font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors mb-2">
              Seal Bet & Show QR
            </h4>
            <p className="text-xs text-[#fef3c7]/60 font-sans leading-relaxed">
              Select YES/NO, choose chip size, generate offline payment QR code in real-time.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 text-xs text-emerald-400 font-bold flex items-center gap-1">
            <span>Open Blitz Demo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Door 3: Private Vault & Audit Drawer */}
        <Link
          href="/vault"
          target="_blank"
          className="p-5 rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/40 hover:border-[#fb923c] transition-all group flex flex-col justify-between"
        >
          <div>
            <span className="text-[10px] text-[#fb923c] font-bold uppercase block mb-1">
              Step 3 (1:45 – 2:00)
            </span>
            <h4 className="text-base font-heading font-bold text-[#fef3c7] group-hover:text-[#fb923c] transition-colors mb-2">
              Audit & Merkle Proof
            </h4>
            <p className="text-xs text-[#fef3c7]/60 font-sans leading-relaxed">
              Show client-side vault, verified Merkle inclusion proof, and automatic payout settlement.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#7c2d12]/20 text-xs text-[#fb923c] font-bold flex items-center gap-1">
            <span>Open Vault / Audit</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

