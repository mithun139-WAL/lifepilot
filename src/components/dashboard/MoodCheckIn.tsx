"use client";

/**
 * MoodCheckIn.tsx
 *
 * REPLACES: MoodInsight (a log list + emoji row with no emotional design)
 *
 * WHY THIS MATTERS FOR RETENTION:
 * Mood logging is the lowest-friction self-reflection habit you can build.
 * Done right, it takes 2 seconds (one tap) and anchors the user to the app
 * daily — the same psychology Headspace and Daylio use.
 *
 * DESIGN PRINCIPLES:
 *
 * 1. SINGLE PRIMARY ACTION — tap a mood
 *    The emoji buttons are the hero of this card. Large, spaced, easy to tap.
 *    No forms, no labels (beyond the emoji itself). The label appears below on hover.
 *    This reduces friction to absolute minimum.
 *
 * 2. OPTIONAL TEXT NOTE
 *    After tapping a mood, a single-line text input slides in.
 *    This follows the "optional deepening" pattern: users who want to write more can,
 *    but the default path is one tap. Never block the primary action behind a form.
 *
 * 3. RECENT MOOD CONTEXT
 *    Shows the last logged mood at the top so users can see their pattern
 *    without going to the Journal page. A single line of context is enough.
 *
 * 4. VISUAL FEEDBACK
 *    The selected emoji gets a violet glow and scale animation — rewarding.
 *    This is the "check-pop" animation from globals.css: instant tactile feedback.
 *
 * ACCESSIBILITY:
 * Each mood button has an aria-label matching the mood name.
 * The text input has a placeholder and proper label context.
 */

import { useState } from "react";
import { Heart } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import useSWR from "swr";
import { apiClient as _api, authFetcher } from "@/lib/apiClient";
import { formatDistanceToNow } from "date-fns";

const MOODS = [
  { label: "Happy",     emoji: "😊", color: "text-yellow-400"  },
  { label: "Focused",   emoji: "🎯", color: "text-cyan-400"    },
  { label: "Neutral",   emoji: "😐", color: "text-white/60"    },
  { label: "Tired",     emoji: "😴", color: "text-blue-300"    },
  { label: "Stressed",  emoji: "😵", color: "text-rose-400"    },
];

export function MoodCheckIn() {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  /* Recent mood from dashboard stats */
  const { data: statsResult } = useSWR<any>(
    _api.url("/dashboard/stats"),
    authFetcher
  );
  const recentMood = statsResult?.data?.recentMood;

  const handleMoodTap = (label: string) => {
    setSelected(label);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.post("/mood", { mood: selected + (note ? ` — ${note}` : "") });
      setSaved(true);
      setNote("");
      setTimeout(() => { setSelected(null); setSaved(false); }, 2500);
    } catch {
      /* silently fail — mood log is non-critical */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-1 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
          <Heart size={13} className="text-rose-400" />
        </div>
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
          How are you feeling?
        </span>
      </div>

      {/* Recent mood context — tiny, unobtrusive */}
      {recentMood && !saved && (
        <p className="text-[11px] text-white/30 -mt-1">
          Last: {recentMood.mood} ·{" "}
          {formatDistanceToNow(new Date(recentMood.createdAt), { addSuffix: true })}
        </p>
      )}

      {/* Saved confirmation */}
      {saved && (
        <p className="text-xs text-emerald-400 animate-fade-in -mt-1">
          ✓ Mood logged
        </p>
      )}

      {/* Mood emoji row */}
      <div className="flex items-center justify-between gap-1.5">
        {MOODS.map(({ label, emoji, color }) => (
          <button
            key={label}
            onClick={() => handleMoodTap(label)}
            aria-label={label}
            className={`mood-btn flex-1 ${selected === label ? "mood-btn-active" : ""}`}
          >
            <span className="text-xl leading-none">{emoji}</span>
            <span className={`text-[9px] font-medium ${selected === label ? "text-violet-300" : "text-white/30"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Optional note — slides in after mood selection */}
      {selected && !saved && (
        <div className="flex gap-2 animate-fade-in-up">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Add a note… (optional)"
            maxLength={120}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 placeholder:text-white/25 outline-none focus:border-violet-500/50 transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-violet-500/80 hover:bg-violet-500 border border-violet-400/30 rounded-lg text-xs text-white font-medium transition-all disabled:opacity-50"
          >
            {saving ? "…" : "Log"}
          </button>
        </div>
      )}
    </div>
  );
}
