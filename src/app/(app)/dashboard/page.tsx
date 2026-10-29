/**
 * src/app/(app)/dashboard/page.tsx — Mission Control
 *
 * LAYOUT RATIONALE:
 * ─────────────────
 * The old layout was a flat 3-column grid of widgets with no visual
 * hierarchy. Everything had equal weight. The user's eye had nowhere to
 * land first, and the most important information (today's tasks, mood,
 * life score) competed with low-priority widgets.
 *
 * The new layout has three deliberate zones:
 *
 *   ZONE 1 — Hero Bar (full width, top)
 *   ┌────────────────────────────────────┐
 *   │ Greeting  ·  LifeScoreRing  ·  AI briefing (DailyBriefing)  │
 *   └────────────────────────────────────┘
 *   Purpose: Orient the user. One glance answers "how am I doing today?"
 *   The ring gives a score signal, the greeting creates warmth, the
 *   AI briefing sets intentions.
 *
 *   ZONE 2 — Main Column (left, 60%)
 *   ┌────────────────────────────────────┐
 *   │ TodayCommand (tasks)               │
 *   └────────────────────────────────────┘
 *   Purpose: Action. Today's most urgent items. Biggest widget because
 *   tasks drive retention — if users complete tasks they come back tomorrow.
 *
 *   ZONE 3 — Check-in Column (right, 40%)
 *   ┌──────────────┐
 *   │ MoodCheckIn  │
 *   │ HabitCheckList│
 *   │ GoalProgress  │
 *   └──────────────┘
 *   Purpose: Status + identity. Mood + habits build the daily ritual.
 *   Goal progress anchors the bigger "why".
 *
 * WHY THIS IS BETTER THAN THE OLD LAYOUT:
 * - Visual hierarchy: hero → action → check-ins (matches mental model of
 *   "how am I doing → what do I need to do → am I building good habits")
 * - Reduced widget count from 7 to 5 on the primary view (cleaner)
 * - KnowledgeManager moved to Settings — it's a configuration tool, not
 *   a daily-workflow widget
 * - FocusPanel removed — it duplicated TodayTimeline without adding value
 *
 * IMPORT NOTE:
 * Old components (SmartSuggestion, TodayTimeline, HabitStats, MoodInsight,
 * StreakAchievements, LifeScoreCard, JournalPreview, FocusPanel) are no
 * longer imported here. They still exist in the filesystem and can be
 * deleted in a cleanup pass — we keep them now to avoid breaking anything
 * that might reference them elsewhere.
 */

"use client";

import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { LifeScoreRing }    from "@/components/dashboard/LifeScoreRing";
import { DailyBriefing }    from "@/components/dashboard/DailyBriefing";
import { TodayCommand }     from "@/components/dashboard/TodayCommand";
import { MoodCheckIn }      from "@/components/dashboard/MoodCheckIn";
import { HabitCheckList }   from "@/components/dashboard/HabitCheckList";
import { GoalProgressMini } from "@/components/dashboard/GoalProgressMini";

export default function DashboardPage() {
  const { user } = useAuth();

  /* Derive first name for greeting */
  const firstName = user?.name?.split(" ")[0] ?? "there";

  /* Time-aware greeting */
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* ── HERO BAR ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex flex-wrap items-center gap-4">
          {/* Greeting */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white leading-tight truncate animate-fade-in">
              {greeting}, {firstName}
            </h1>
            <p className="text-xs text-white/35 mt-0.5">
              Here&apos;s your mission brief for today.
            </p>
          </div>

          {/* Life Score Ring — compact, inline */}
          <ErrorBoundary>
            <LifeScoreRing size={56} />
          </ErrorBoundary>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">

        {/* AI Briefing — full width under hero */}
        <ErrorBoundary>
          <DailyBriefing />
        </ErrorBoundary>

        {/* ── TWO-COLUMN GRID ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Left column — Tasks (wider) */}
          <div className="lg:col-span-3">
            <ErrorBoundary>
              <TodayCommand />
            </ErrorBoundary>
          </div>

          {/* Right column — Check-ins stack */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <ErrorBoundary>
              <MoodCheckIn />
            </ErrorBoundary>
            <ErrorBoundary>
              <HabitCheckList />
            </ErrorBoundary>
            <ErrorBoundary>
              <GoalProgressMini />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
