"use client";

/**
 * LifeScoreRing.tsx
 *
 * REPLACES: LifeScoreCard (a flat number with no visual context)
 *
 * WHY AN SVG RING:
 * A large number like "72" communicates nothing by itself — is that good?
 * Bad? The ring answers the question immediately: 72% of the ring is filled,
 * 28% is empty. Users understand progress rings intuitively from loading
 * indicators, fitness apps, and watch faces.
 *
 * WHY ANIMATED:
 * The ring animates from 0 to the actual score on mount. This "counts up"
 * motion draws the eye and makes the number feel earned rather than static.
 * It also provides a micro-moment of delight that increases engagement.
 * (Same psychology as fitness apps showing ring completion.)
 *
 * WHY IN THE HERO BAR (not a standalone widget):
 * As a standalone widget it consumed 1/3 of the dashboard grid for a single
 * number. In the hero bar it's compact but still prominent — a status
 * indicator at a glance, not a page element.
 *
 * SCORE COLOUR SEMANTICS:
 * < 40  → rose   (needs attention)
 * 40-69 → amber  (making progress)
 * 70-89 → cyan   (on track)
 * 90+   → emerald (excellent)
 * This gives users immediate emotional feedback without reading numbers.
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiClient, authFetcher } from "@/lib/apiClient";

function getScoreColor(score: number): { stroke: string; text: string; label: string } {
  if (score >= 90) return { stroke: "#34d399", text: "text-emerald-400", label: "Excellent" };
  if (score >= 70) return { stroke: "#22d3ee", text: "text-cyan-400",    label: "On track"  };
  if (score >= 40) return { stroke: "#fbbf24", text: "text-amber-400",   label: "Building"  };
  return           { stroke: "#f87171", text: "text-rose-400",   label: "Low energy" };
}

export function LifeScoreRing({ size = 64 }: { size?: number }) {
  const { data: result } = useSWR<any>(apiClient.url("/dashboard/stats"), authFetcher);
  const targetScore = result?.data?.lifeScore ?? 0;

  /* Animate the score upward on mount */
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    if (targetScore === 0) return;
    const step  = targetScore / 40;                   // 40 frames ≈ 650ms at 60fps
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= targetScore) {
        setDisplayScore(targetScore);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [targetScore]);

  const { stroke, text, label } = getScoreColor(targetScore);
  const r             = (size / 2) - 6;              // ring radius
  const circumference = 2 * Math.PI * r;
  const offset        = circumference - (displayScore / 100) * circumference;
  const cx            = size / 2;
  const cy            = size / 2;

  return (
    <div className="flex items-center gap-2.5">
      {/* SVG ring */}
      <div className="relative">
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Gradient definition */}
          <defs>
            <linearGradient id={`scoreGrad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.6" />
              <stop offset="100%" stopColor={stroke} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={size <= 48 ? 4 : 5}
          />
          {/* Fill arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#scoreGrad-${size})`}
            strokeWidth={size <= 48 ? 4 : 5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        {/* Score number centred over ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[11px] font-bold tabular-nums leading-none ${text}`}>
            {displayScore}
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold text-white/80">Life Score</span>
        <span className={`text-[10px] font-medium ${text}`}>{label}</span>
      </div>
    </div>
  );
}
