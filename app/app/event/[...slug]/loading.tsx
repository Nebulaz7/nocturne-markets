import React from "react";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { ArrowLeft, Shield } from "lucide-react";

export default function EventDetailLoading() {
  return (
    <div className="min-h-screen bg-[#090706] text-[#fef3c7] flex flex-col font-sans selection:bg-[#fb923c] selection:text-[#431407]">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-5 flex items-center gap-2 text-xs font-mono text-[#fef3c7]/40 animate-pulse">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Markets</span>
          <span>/</span>
          <div className="h-3.5 w-32 rounded bg-[#1f140f]" />
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Event Info & Submarkets Table (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Header Skeleton Card */}
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 p-6 space-y-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#1f140f] border border-[#7c2d12]/30 shrink-0" />
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-20 rounded bg-[#1f140f]" />
                    <div className="h-4 w-16 rounded bg-[#1f140f]" />
                  </div>
                  <div className="h-6 w-5/6 rounded bg-[#261711]" />
                  <div className="h-4 w-1/2 rounded bg-[#1f140f]" />
                </div>
              </div>

              {/* Submarket Rows Skeleton */}
              <div className="space-y-2 pt-3 border-t border-[#7c2d12]/20">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-[#140e0b] border border-[#7c2d12]/20 flex items-center justify-between p-3"
                  >
                    <div className="h-4 w-40 rounded bg-[#1f140f]" />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-16 rounded-lg bg-[#12281c]/60" />
                      <div className="h-8 w-16 rounded-lg bg-[#361212]/60" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Graph Skeleton Container */}
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 p-6 h-[340px] flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-[#1f140f] animate-pulse" />
                <div className="flex items-center gap-1.5">
                  {(["1D", "1W", "1M", "MAX"] as const).map((tab) => (
                    <div
                      key={tab}
                      className="h-6 w-8 rounded-lg bg-[#140e0b] border border-[#7c2d12]/20"
                    />
                  ))}
                </div>
              </div>

              {/* Pulsing Ember Spinner */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <div className="w-8 h-8 border-2 border-[#fb923c] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-[#fb923c]/80 tracking-wide animate-pulse">
                  Loading event outcomes & probability history...
                </span>
              </div>

              <div className="h-3 w-48 rounded bg-[#1f140f] animate-pulse" />
            </div>
          </div>

          {/* Right Column: Bet Slip Skeleton (4 cols) */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/35 p-5 space-y-4 animate-pulse">
              <div className="flex items-center justify-between pb-3 border-b border-[#7c2d12]/20">
                <div className="h-4 w-24 rounded bg-[#1f140f]" />
                <div className="h-4 w-16 rounded bg-[#1f140f]" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 rounded-xl bg-[#12281c]/50 border border-[#22c55e]/20" />
                <div className="h-10 rounded-xl bg-[#361212]/50 border border-[#f87171]/20" />
              </div>

              <div className="h-12 rounded-xl bg-[#140e0b] border border-[#7c2d12]/20" />

              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-[#140e0b] border border-[#7c2d12]/20" />
                ))}
              </div>

              <div className="h-12 rounded-xl bg-[#261711] border border-[#ea580c]/30" />
            </div>

            {/* Privacy Invariant Strip */}
            <div className="p-3.5 rounded-xl bg-[#140e0b] border border-[#7c2d12]/30 flex items-center gap-2.5 font-mono text-[11px] text-[#fef3c7]/50">
              <Shield className="w-4 h-4 text-[#fb923c] shrink-0" />
              <span>Zero-POST Parimutuel Protocol · Shielded Mempools</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
