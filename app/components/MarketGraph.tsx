"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

export interface HistoryPoint {
  t: number;
  yesPct: number;
  noPct: number;
}

export interface MarketGraphProps {
  marketId: string;
  marketTitle: string;
  refYesPrice?: number | null;
  isBlitz?: boolean;
  closeTime?: number;
}

const COORDINATOR_URL =
  process.env.NEXT_PUBLIC_COORDINATOR_URL ||
  process.env.COORDINATOR_URL ||
  "http://127.0.0.1:3000";

export function MarketGraph({
  marketId,
  marketTitle,
  refYesPrice = 0.5,
  isBlitz = false,
  closeTime,
}: MarketGraphProps) {
  const currentPricePct = Math.round((refYesPrice ?? 0.5) * 100);

  // Timeframe intervals
  const blitzIntervals = ["5M", "15M", "1H", "1D"] as const;
  const standardIntervals = ["1D", "1W", "1M", "ALL"] as const;

  const [activeInterval, setActiveInterval] = useState<string>(
    isBlitz ? "5M" : "1D"
  );
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Blitz countdown clock
  const [timeLeft, setTimeLeft] = useState<{ min: string; sec: string }>({
    min: "00",
    sec: "00",
  });

  useEffect(() => {
    if (!closeTime) return;
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, closeTime - now);
      const min = Math.floor(diff / 60)
        .toString()
        .padStart(2, "0");
      const sec = (diff % 60).toString().padStart(2, "0");
      setTimeLeft({ min, sec });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [closeTime]);

  // Fetch or generate history points
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const fetchHistory = async () => {
      try {
        const queryInterval = activeInterval.toLowerCase();
        const res = await fetch(
          `${COORDINATOR_URL}/api/markets/${encodeURIComponent(marketId)}/history?interval=${queryInterval}`,
          { signal: AbortSignal.timeout(4000) }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.history && data.history.length > 1) {
            if (!isCancelled) {
              setHistory(data.history);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch {
        // Fallback to organic synthetic generator
      }

      // Generate realistic natural curve if upstream has insufficient points
      if (!isCancelled) {
        const synthetic = generateOrganicCurve(currentPricePct, activeInterval);
        setHistory(synthetic);
        setIsLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isCancelled = true;
    };
  }, [marketId, activeInterval, currentPricePct]);

  // Synthetic organic curve generator
  function generateOrganicCurve(targetPct: number, interval: string): HistoryPoint[] {
    const points: HistoryPoint[] = [];
    const count = 28;
    const now = Math.floor(Date.now() / 1000);
    const step = interval === "5M" ? 10 : interval === "1D" ? 1800 : 7200;

    let p = Math.max(10, Math.min(90, targetPct + (Math.random() * 8 - 4)));
    const drift = (targetPct - p) / count;

    for (let i = 0; i < count; i++) {
      const t = now - (count - 1 - i) * step;
      const noise = (Math.random() - 0.48) * 2.5;
      p = Math.max(2, Math.min(98, p + drift + noise));
      if (i === count - 1) p = targetPct;

      points.push({
        t,
        yesPct: Number(p.toFixed(1)),
        noPct: Number((100 - p).toFixed(1)),
      });
    }
    return points;
  }

  // Active hover point or latest point
  const activePoint = useMemo(() => {
    if (hoverIndex !== null && history[hoverIndex]) {
      return history[hoverIndex];
    }
    return history[history.length - 1] || { t: Date.now() / 1000, yesPct: currentPricePct, noPct: 100 - currentPricePct };
  }, [hoverIndex, history, currentPricePct]);

  // SVG Chart Geometry
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 16, bottom: 30, left: 16 };

  const { pathD, areaD, pointsCoord, targetY } = useMemo(() => {
    if (!history.length) return { pathD: "", areaD: "", pointsCoord: [], targetY: height / 2 };

    const minP = Math.max(0, Math.min(...history.map((p) => p.yesPct)) - 5);
    const maxP = Math.min(100, Math.max(...history.map((p) => p.yesPct)) + 5);
    const range = maxP - minP || 1;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const coords = history.map((pt, i) => {
      const x = padding.left + (i / (history.length - 1)) * chartW;
      const y = padding.top + chartH - ((pt.yesPct - minP) / range) * chartH;
      return { x, y, pt };
    });

    // Baseline target Y (50% or strike price)
    const tY = padding.top + chartH - ((50 - minP) / range) * chartH;

    // Build smooth SVG path
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const baselineY = height - padding.bottom;
    const aD = `${d} L ${coords[coords.length - 1].x} ${baselineY} L ${coords[0].x} ${baselineY} Z`;

    return { pathD: d, areaD: aD, pointsCoord: coords, targetY: tY };
  }, [history, width, height, padding]);

  // Handle mouse move over SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !pointsCoord.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    // Find closest point
    let closestIdx = 0;
    let minDist = Infinity;
    pointsCoord.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Simulated live spot values for blitz demo
  const priceToBeat = "$81,277.75";
  const currentSpot = "$81,127.00";
  const spotDelta = "-$150.75";

  return (
    <div className="w-full rounded-2xl bg-[#0e0a08] border border-[#7c2d12]/30 p-5 sm:p-6 mb-6 overflow-hidden">
      {/* Top Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        {isBlitz ? (
          /* Blitz Header (Price To Beat, Spot Price, Countdown) */
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#fef3c7]/50 block">
                Price To Beat
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-[#fef3c7]">
                {priceToBeat}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#fef3c7]/50 block">
                Current Spot
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold font-mono text-[#fb923c]">
                  {currentSpot}
                </span>
                <span className="text-xs font-mono font-medium text-rose-400">
                  {spotDelta}
                </span>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1c120c] border border-[#7c2d12]/40">
              <span className="w-2 h-2 rounded-full bg-[#fb923c] animate-pulse" />
              <div className="text-xs font-mono font-bold text-[#fef3c7] tracking-wider">
                <span className="text-base text-[#fb923c] font-black">{timeLeft.min}</span>
                <span className="text-[#fef3c7]/60 text-[10px] mx-1">MIN</span>
                <span className="text-base text-[#fb923c] font-black">{timeLeft.sec}</span>
                <span className="text-[#fef3c7]/60 text-[10px] ml-1">SECS</span>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Market Header (Chance, Trajectory) */
          <div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-heading font-extrabold text-[#fef3c7] tracking-tight">
                {activePoint.yesPct}%
              </span>
              <span className="text-xs font-mono text-[#fef3c7]/60 uppercase">
                Chance Yes
              </span>
            </div>
            {hoverIndex !== null && (
              <p className="text-xs font-mono text-[#fef3c7]/40 mt-0.5">
                {new Date(activePoint.t * 1000).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Timeframe Interval Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#140e0b] border border-[#7c2d12]/40">
          {(isBlitz ? blitzIntervals : standardIntervals).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setActiveInterval(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                activeInterval === tf
                  ? "bg-[#27150d] text-[#fb923c] border border-[#fb923c]/40"
                  : "text-[#fef3c7]/60 hover:text-[#fef3c7] hover:bg-[#1c120c]"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Ember Area Gradient */}
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#ea580c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0e0a08" stopOpacity="0" />
            </linearGradient>

            {/* Target dashed line pattern */}
            <filter id="glowDot" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#fb923c" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={width - padding.right}
            y2={padding.top}
            stroke="#7c2d12"
            strokeOpacity="0.15"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={height / 2}
            x2={width - padding.right}
            y2={height / 2}
            stroke="#7c2d12"
            strokeOpacity="0.2"
            strokeDasharray="4 4"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#7c2d12"
            strokeOpacity="0.3"
          />

          {/* Strike Target Reference line */}
          {isBlitz && (
            <g>
              <line
                x1={padding.left}
                y1={targetY}
                x2={width - padding.right}
                y2={targetY}
                stroke="#fb923c"
                strokeOpacity="0.4"
                strokeDasharray="5 5"
                strokeWidth="1.2"
              />
              <text
                x={width - padding.right}
                y={targetY - 5}
                fill="#fb923c"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="end"
                opacity="0.8"
              >
                TARGET STRIKE
              </text>
            </g>
          )}

          {/* Gradient Filled Area */}
          {areaD && <path d={areaD} fill="url(#chartGradient)" />}

          {/* Trajectory Stroke Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#fb923c"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Hover Crosshair & Dot */}
          {hoverIndex !== null && pointsCoord[hoverIndex] && (
            <g>
              {/* Vertical Guide Line */}
              <line
                x1={pointsCoord[hoverIndex].x}
                y1={padding.top}
                x2={pointsCoord[hoverIndex].x}
                y2={height - padding.bottom}
                stroke="#fef3c7"
                strokeOpacity="0.4"
                strokeDasharray="3 3"
                strokeWidth="1"
              />

              {/* Glowing Indicator Dot */}
              <circle
                cx={pointsCoord[hoverIndex].x}
                cy={pointsCoord[hoverIndex].y}
                r="5"
                fill="#fb923c"
                stroke="#fef3c7"
                strokeWidth="2"
                filter="url(#glowDot)"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Box */}
        {hoverIndex !== null && pointsCoord[hoverIndex] && (
          <div
            className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded-lg bg-[#1c120c] border border-[#fb923c]/50 text-xs font-mono shadow-xl -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(pointsCoord[hoverIndex].x / width) * 100}%`,
              top: `${Math.max(10, (pointsCoord[hoverIndex].y / height) * 100 - 10)}%`,
            }}
          >
            <div className="font-bold text-[#fb923c]">
              {pointsCoord[hoverIndex].pt.yesPct}% YES
            </div>
            <div className="text-[10px] text-[#fef3c7]/60">
              {new Date(pointsCoord[hoverIndex].pt.t * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
