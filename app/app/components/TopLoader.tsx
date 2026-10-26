"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function TopLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setVisible(true);
    setProgress((prev) => (prev > 0 ? prev : 18));

    // Trickle progress: jump smoothly up to ~85%
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + 12;
        if (prev < 70) return prev + 5;
        if (prev < 88) return prev + 1.5;
        return prev;
      });
    }, 120);
  };

  const finish = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setProgress(0);
      }, 200);
    }, 250);
  };

  // Complete progress on route changes
  useEffect(() => {
    finish();
  }, [pathname, searchParams]);

  // Intercept navigation link clicks to start bar immediately
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        targetAttr === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;

        // Skip if same page hash navigation
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash
        ) {
          return;
        }

        // If navigating to different page or query
        if (
          url.pathname !== window.location.pathname ||
          url.search !== window.location.search
        ) {
          start();
        }
      } catch {
        // Ignore parsing errors
      }
    };

    const handleCustomStart = () => start();
    const handleCustomStop = () => finish();

    document.addEventListener("click", handleAnchorClick, { capture: true });
    window.addEventListener("nocturne-route-start", handleCustomStart);
    window.addEventListener("nocturne-route-stop", handleCustomStop);

    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      window.removeEventListener("nocturne-route-start", handleCustomStart);
      window.removeEventListener("nocturne-route-stop", handleCustomStop);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999999] pointer-events-none transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="relative h-[2.5px] bg-gradient-to-r from-[#ea580c] via-[#fb923c] to-[#fef3c7]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? "width 150ms ease-out" : "width 220ms ease-out",
          boxShadow: "0 0 12px rgba(251, 146, 60, 0.8), 0 0 4px rgba(234, 88, 12, 0.6)",
        }}
      >
        {/* Leading edge light pulse */}
        <div className="absolute right-0 top-0 h-[2.5px] w-24 bg-gradient-to-l from-[#fef3c7] via-[#fb923c] to-transparent shadow-[0_0_10px_#fb923c,0_0_5px_#ea580c]" />
      </div>
    </div>
  );
}

export default function TopLoader() {
  return (
    <Suspense fallback={null}>
      <TopLoaderInner />
    </Suspense>
  );
}
