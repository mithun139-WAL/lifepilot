"use client";

/**
 * GoalProgressMini.tsx
 *
 * REPLACES: StreakAchievements + JournalPreview (two widgets that each
 * consumed 1/3 of the grid for low-density information)
 *
 * WHY ONE CARD INSTEAD OF TWO:
 * StreakAchievements showed streaks that are already in the sidebar badge.
 * JournalPreview showed a "no entries" placeholder 90% of the time.
 * Consolidating frees a full grid column for higher-value content.
 *
 * WHAT THIS SHOWS:
 * 1. Active goals list — each goal with its completion % and plan status
 * 2. A progress bar per goal (visual % of tasks complete)
 * 3. A "Generate plan" quick action for goals that have no plan yet
 *
 * WHY PROGRESS % FROM TASKS:
 * The `/goals` endpoint doesn't return a native progress field, so we
 * derive it from the goal's associated learning plan tasks.
 * Until that data is available, we show the plan status as a proxy
 * (no plan = 0%, has plan = "in progress").
 *
 * GENERATE PLAN SHORTCUT:
 * Goals without a plan show a violet "Generate" button that navigates
 * to /settings (the plan generation flow) with the goalId pre-filled
 * as a query param — removing the need to re-select the goal.
 * This surfaces the most important action for new users directly on
 * the dashboard without cluttering the layout.
 *
 * STREAK CALLOUT:
 * A compact flame + max-streak line at the bottom. Single line.
 * Streak is still important signal — this gives it a home here
 * without dedicating a whole card to it.
 */

import useSWR from "swr";
import Link from "next/link";
import { Target, Flame, ArrowRight, Zap } from "lucide-react";
import { apiClient, authFetcher } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  hasPlan?: boolean;
  progress?: number;     // 0-100 if backend provides it
}

interface LearningPlan {
  id: string;
  topic: string;
  goalId: string;
}

interface HabitStreak {
  id: string;
  description: string;
  streak: number;
}

export function GoalProgressMini() {
  const { data: goalsResult } = useSWR<any>(
    apiClient.url("/goals"),
    authFetcher
  );
  const { data: plansResult } = useSWR<any>(
    apiClient.url("/learning-plans"),
    authFetcher
  );
  const { data: streakResult } = useSWR<any>(
    apiClient.url("/habits/streaks"),
    authFetcher
  );

  const goals: Goal[] = goalsResult?.data ?? goalsResult ?? [];
  const plans: LearningPlan[] = Array.isArray(plansResult)
    ? plansResult
    : plansResult?.data ?? [];
  const streaks: HabitStreak[] = Array.isArray(streakResult)
    ? streakResult
    : streakResult?.data ?? [];

  const maxStreak = streaks.reduce((m, s) => Math.max(m, s.streak ?? 0), 0);
  const hasPlanFor = (goalId: string) =>
    plans.some((p) => p.goalId === goalId);

  const visibleGoals = goals.slice(0, 4);   // cap at 4 to avoid overflow

  return (
    <div className="surface-2 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Target size={13} className="text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Goals
          </span>
        </div>
        <Link
          href="/plans/overview"
          className="flex items-center gap-1 text-[11px] text-white/30 hover:text-violet-400 transition-colors"
        >
          All plans <ArrowRight size={10} />
        </Link>
      </div>

      {/* Goal list */}
      <div className="flex flex-col gap-2">
        {visibleGoals.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-white/25">No goals yet</p>
            <Link
              href="/settings"
              className="text-xs text-violet-400 hover:text-violet-300 mt-1 inline-block"
            >
              Create a goal
            </Link>
          </div>
        ) : (
          visibleGoals.map((goal) => {
            const hasPlan   = hasPlanFor(goal.id);
            const progress  = goal.progress ?? (hasPlan ? 15 : 0);   // placeholder until API supports it
            return (
              <div key={goal.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-white/80 font-medium leading-tight line-clamp-1">
                    {goal.title}
                  </p>

                  {hasPlan ? (
                    <span className="flex items-center gap-1 flex-shrink-0 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                      <Zap size={9} />
                      Active
                    </span>
                  ) : (
                    <Link
                      href={`/settings?goalId=${goal.id}`}
                      className="flex-shrink-0 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full hover:bg-violet-500/20 transition-colors"
                    >
                      Generate plan
                    </Link>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      hasPlan ? "progress-fill-cyan" : "bg-white/10"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Streak callout */}
      {maxStreak > 0 && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-white/5 mt-auto">
          <Flame size={13} className="text-amber-400" />
          <span className="text-[11px] text-amber-400 font-semibold">{maxStreak}-day streak</span>
          <span className="text-[11px] text-white/30 ml-1">· keep it going</span>
        </div>
      )}
    </div>
  );
}
