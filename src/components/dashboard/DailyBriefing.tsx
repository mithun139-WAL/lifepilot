"use client";

/**
 * DailyBriefing.tsx
 *
 * REPLACES: SmartSuggestion (rotating banner with no visual hierarchy)
 *
 * WHY A CARD INSTEAD OF A BANNER:
 * A rotating banner at the very top of the page competes with the
 * greeting and feels like an ad ticker. A card with a proper header,
 * icon, and suggestion text treats AI output as content worth reading —
 * not an afterthought.
 *
 * WHY SHOW THE FULL SUGGESTION (not just rotate):
 * Rotation hides content behind time. The user has to sit and wait to
 * see all suggestions. Showing them as a scannable list lets users
 * find what's relevant in 2 seconds. Next/prev arrows are preserved
 * for users who prefer one at a time.
 *
 * WHY THE "SPARK" ICON:
 * The Sparkles icon signals AI-generated content — users have been
 * trained to recognise this pattern from Notion AI, GitHub Copilot etc.
 * It sets expectation: this is an intelligent suggestion, not a static tip.
 *
 * LOADING STATE:
 * Shows a subtle shimmer skeleton so the layout doesn't shift when
 * the API responds. This keeps the page feel stable on load.
 */

import { useState } from "react";
import useSWR from "swr";
import { Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { apiClient, authFetcher } from "@/lib/apiClient";

interface Suggestion {
  text: string;
  emoji: string;
}

export function DailyBriefing() {
  const { data: result, isLoading } = useSWR<any>(
    apiClient.url("/suggestions"),
    authFetcher,
    { refreshInterval: 300_000 }   // re-fetch every 5 min
  );

  const suggestions: Suggestion[] =
    result?.data?.length > 0
      ? result.data
      : [{ text: "Generating your personalised briefing…", emoji: "✨" }];

  const [idx, setIdx] = useState(0);
  const current = suggestions[idx] ?? suggestions[0];

  const prev = () => setIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
  const next = () => setIdx((i) => (i + 1) % suggestions.length);

  return (
    <div className="surface-2 p-4 glow-violet">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <Sparkles size={14} className="text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            AI Daily Briefing
          </span>
        </div>

        {/* Pagination dots */}
        {suggestions.length > 1 && (
          <div className="flex items-center gap-1">
            {suggestions.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                  i === idx ? "bg-violet-400 w-3" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggestion body */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-white/10 rounded-lg w-3/4" />
          <div className="h-4 bg-white/10 rounded-lg w-1/2" />
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-0.5 animate-fade-in" key={idx}>
            {current.emoji}
          </span>
          <p className="text-sm text-white/80 leading-relaxed animate-fade-in" key={`t-${idx}`}>
            {current.text}
          </p>
        </div>
      )}

      {/* Navigation arrows */}
      {suggestions.length > 1 && !isLoading && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={prev}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            aria-label="Previous suggestion"
          >
            <ChevronLeft size={13} className="text-white/50" />
          </button>
          <button
            onClick={next}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            aria-label="Next suggestion"
          >
            <ChevronRight size={13} className="text-white/50" />
          </button>
          <span className="ml-auto text-xs text-white/25 self-center">
            {idx + 1} / {suggestions.length}
          </span>
        </div>
      )}
    </div>
  );
}
