"use client";

/**
 * HabitCheckList.tsx
 *
 * REPLACES: HabitStats (a bar-chart breakdown with no daily check-in context)
 *
 * WHY DISPLAY-ONLY (no toggle):
 * Toggling a habit requires `learning_plan_id` which is NOT returned by
 * `/dashboard/stats` — only the habit name and done-state are available.
 * Showing a disabled toggle (greyed out) creates confusion ("why can't I tap it?").
 * A clear checkmark/circle indicator with no interactive affordance is honest
 * about what this card does: it shows today's status at a glance.
 * Full habit toggling lives on the dedicated Habits page.
 *
 * WHY STREAKS INLINE:
 * We fetch `/habits/streaks` here so the user sees their streak per habit,
 * not just a global max. A streak is more motivating when attributed to a
 * specific habit ("Running — 7 day streak") than as an abstract total.
 *
 * COLOUR SEMANTICS:
 * - Done habit  → emerald dot + title at full opacity
 * - Undone habit → white/20 dot + title at reduced opacity (low-salience)
 * This communicates completion without needing text labels.
 *
 * LINK TO HABITS PAGE:
 * The header "View all" link navigates to /habits so users who want to
 * toggle habits have a clear path without leaving the dashboard confused.
 */

import useSWR from "swr";
import Link from "next/link";
import { CheckCircle2, Circle, Flame, ArrowRight } from "lucide-react";
import { apiClient, authFetcher } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface HabitStat {
  name: string;
  done: boolean;
}

interface HabitStreak {
  id: string;
  description: string;
  streak: number;
}

export function HabitCheckList() {
  const { data: statsResult } = useSWR<any>(
    apiClient.url("/dashboard/stats"),
    authFetcher
  );
  const { data: streakResult } = useSWR<any>(
    apiClient.url("/habits/streaks"),
    authFetcher
  );

  const habits: HabitStat[] = statsResult?.data?.habits ?? [];
  const streaks: HabitStreak[] = Array.isArray(streakResult)
    ? streakResult
    : streakResult?.data ?? [];

  /* Match streak by fuzzy name match */
  const getStreak = (name: string): number => {
    const match = streaks.find(
      (s) => s.description?.toLowerCase().includes(name.toLowerCase()) ||
             name.toLowerCase().includes(s.description?.toLowerCase() ?? "")
    );
    return match?.streak ?? 0;
  };

  const doneCount = habits.filter((h) => h.done).length;

  return (
    <div className="surface-1 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <CheckCircle2 size={13} className="text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Today&apos;s Habits
          </span>
        </div>
        <Link
          href="/habits"
          className="flex items-center gap-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors"
        >
          View all <ArrowRight size={10} />
        </Link>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-white/40">
            <span>{doneCount} of {habits.length} complete</span>
            <span>{Math.round((doneCount / habits.length) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full progress-fill-emerald transition-all duration-700"
              style={{ width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Habit list */}
      <div className="flex flex-col gap-1.5">
        {habits.length === 0 ? (
          <p className="text-xs text-white/25 py-4 text-center">
            No habits assigned yet
          </p>
        ) : (
          habits.map((habit, i) => {
            const streak = getStreak(habit.name);
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150",
                  habit.done
                    ? "bg-emerald-500/8 border border-emerald-500/15"
                    : "bg-white/3 border border-white/6"
                )}
              >
                {habit.done ? (
                  <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle size={14} className="text-white/20 flex-shrink-0" />
                )}

                <span className={cn(
                  "flex-1 text-xs font-medium truncate",
                  habit.done ? "text-white/80" : "text-white/35"
                )}>
                  {habit.name}
                </span>

                {streak > 0 && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Flame size={10} className="text-amber-400" />
                    <span className="text-[10px] text-amber-400 font-semibold">{streak}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
