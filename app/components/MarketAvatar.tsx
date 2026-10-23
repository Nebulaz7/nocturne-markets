"use client";

import React, { useEffect, useRef, useState } from "react";

export interface MarketAvatarProps {
  src?: string | null;
  title: string;
  category?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Compute 2-character initials badge for fallback
function getInitials(title: string, category?: string | null): string {
  // Strip common noisy question prefixes for cleaner initials
  const clean = title
    .replace(/^will\s+/i, "")
    .replace(/^who\s+will\s+/i, "")
    .replace(/^when\s+will\s+/i, "")
    .replace(/^which\s+/i, "")
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0].replace(/[^a-zA-Z0-9]/g, "")[0] || "";
    const second = words[1].replace(/[^a-zA-Z0-9]/g, "")[0] || "";
    if (first && second) return (first + second).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  if (category) {
    return category.slice(0, 2).toUpperCase();
  }
  return "NM";
}

const SIZE_MAP = {
  sm: {
    container: "w-5 h-5 min-w-[20px] rounded-md text-[9px]",
    badge: "text-[9px]",
  },
  md: {
    container: "w-9 h-9 min-w-[36px] rounded-xl text-xs",
    badge: "text-xs font-bold",
  },
  lg: {
    container:
      "w-12 h-12 min-w-[48px] sm:w-14 sm:h-14 sm:min-w-[56px] rounded-2xl text-sm",
    badge: "text-sm font-bold",
  },
};

/**
 * MarketAvatar: High-performance progressive lazy-loaded avatar for Polymarket predictions.
 * - IntersectionObserver ensures network requests are only triggered as images scroll into view.
 * - Native loading="lazy" and decoding="async" for maximum browser optimization.
 * - Zero Layout Shift (CLS) via explicit dimension envelopes.
 * - Elegant Nocturne Warm Ember / Obsidian fallback initials badge.
 */
export default function MarketAvatar({
  src,
  title,
  category,
  size = "md",
  className = "",
}: MarketAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const cleanSrc =
    src && src.trim().length > 0 && !hasError ? src.trim() : null;
  const initials = getInitials(title, category);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  useEffect(() => {
    // If no valid image URL provided, skip viewport observer
    if (!cleanSrc) return;

    // Progressive loading via IntersectionObserver: only load when near viewport
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: "150px" }, // Pre-fetch 150px before entering viewport for smooth UX
      );

      if (containerRef.current) {
        observer.observe(containerRef.current);
      }

      return () => {
        observer.disconnect();
      };
    } else {
      // Fallback for browsers without IntersectionObserver
      setIsInView(true);
    }
  }, [cleanSrc]);

  return (
    <div
      ref={containerRef}
      className={`relative shrink-0 overflow-hidden flex items-center justify-center bg-[#150f0c] border border-[#7c2d12]/35 select-none ${sizeConfig.container} ${className}`}
    >
      {/* Fallback Initials / Category Emblem (always rendered behind image to prevent layout pop) */}
      <span
        className={`font-heading tracking-wider text-[#fb923c] font-bold ${sizeConfig.badge} transition-opacity duration-200 ${
          isLoaded ? "opacity-0" : "opacity-100"
        }`}
      >
        {initials}
      </span>

      {/* Progressive Lazy-Loaded Polymarket Image */}
      {cleanSrc && isInView && (
        <img
          src={cleanSrc}
          alt={title}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}
