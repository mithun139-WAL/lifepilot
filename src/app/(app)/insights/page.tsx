"use client";

/**
 * src/app/(app)/insights/page.tsx
 *
 * FIXES IN THIS VERSION:
 *
 * 1. TypeScript errors (TS2345) — all API calls are now explicitly typed;
 *    responses are normalized before being stored in state.
 *
 * 2. EventSource → fetch + ReadableStream (SSE auth fix)
 *    EventSource cannot set custom request headers. FastAPI's CurrentUser
 *    dependency requires "Authorization: Bearer <token>". Using fetch()
 *    with signal: abortController.signal preserves auth AND supports
 *    clean cancellation when the component unmounts.
 *
 * 3. SSE habit.completions crash fixed
 *    The SSE payload never included a `completions` array — it now sends
 *    `completionPercentage` (computed server-side). Frontend reads that field.
 *
 * 4. completionPercentage → completion normalization
 *    REST endpoint returns `completionPercentage`; chart dataKey is
 *    `completion`. Both paths (REST and SSE) now normalize to `completion`.
 *
 * 5. getStartDate mutation bug fixed
 *    Original used `now.setDate(now.getDate() - N)` which mutates `now`.
 *    Replaced with `Date.now() - N * ms` arithmetic.
 *
 * 6. Single filter dropdown
 *    Was duplicated 5×, once per chart. Now lives in the page header only.
 *
 * 7. Design system applied — surface-1 cards, glow-violet accents, chart palette.
 *
 * 8. Empty states per chart + stat summary row.
 *
 * 9. fetchInsights errors are caught and surfaced instead of crashing silently.
 *
 * 10. isAuthenticated gate ensures no fetches fire before auth resolves.
 */

import React, { useEffect, useState } from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import PlannerLoader from "@/components/common/PlannerLoader";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { getAccessToken } from "@/lib/tokenStore";

// ── Types ────────────────────────────────────────────────────────────────────

interface LearningItem  { title: string; totalHours: number; }
interface HabitItem     { name: string; completion: number; }
interface GoalItem      { title: string; averageProgress: number; }
interface TaskStats     { completed: number; pending: number; }
interface MoodItem      { date: string; happy: number; sad: number; neutral: number; }
type FilterRange        = "7d" | "30d" | "90d";

// Raw API shapes (before normalization)
interface HabitRaw      { name: string; completionPercentage: number; }

// ── Constants ────────────────────────────────────────────────────────────────

const C = {
  violet:  "#8B5CF6",
  cyan:    "#22D3EE",
  emerald: "#34D399",
  amber:   "#FBBF24",
  rose:    "#FB7185",
  muted:   "#475569",
};

const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "rgba(8, 6, 18, 0.97)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    fontSize: "12px",
    color: "#e2e8f0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

const AXIS = { stroke: "rgba(255,255,255,0.2)", fontSize: 11 };
const GRID = { strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.05)" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStartDate(filter: FilterRange): string {
  const days = filter === "7d" ? 7 : filter === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function normalizeHabits(raw: HabitRaw[]): HabitItem[] {
  return raw.map((h) => ({
    name: h.name,
    completion: Math.round(h.completionPercentage ?? 0),
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-1 p-5 rounded-2xl flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center h-[180px] text-slate-500 text-xs italic select-none">
      {label}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="surface-1 px-4 py-3 rounded-xl">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { isAuthenticated } = useAuth();

  const [learningData, setLearningData] = useState<LearningItem[]>([]);
  const [habitData,    setHabitData]    = useState<HabitItem[]>([]);
  const [goalData,     setGoalData]     = useState<GoalItem[]>([]);
  const [taskData,     setTaskData]     = useState<TaskStats>({ completed: 0, pending: 0 });
  const [moodData,     setMoodData]     = useState<MoodItem[]>([]);
  const [filter,       setFilter]       = useState<FilterRange>("7d");
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── REST: all 5 insights endpoints in parallel ──────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);
      const start = getStartDate(filter);

      try {
        const [learning, habitsRaw, goals, tasks, moodsRaw] = await Promise.all([
          apiClient.get<LearningItem[]>("/insights/learning-hours"),
          apiClient.get<HabitRaw[]>(`/insights/habit-completion?start=${start}`),
          apiClient.get<GoalItem[]>("/insights/goals-progress"),
          apiClient.get<TaskStats>(`/insights/task-stats?start=${start}`),
          apiClient.get<Record<string, string[]>>(`/insights/mood-trends?start=${start}`),
        ]);

        // Backend returns bare arrays/objects — no { success, data } wrapper
        setLearningData(Array.isArray(learning) ? learning : []);

        // Normalize completionPercentage → completion for the Recharts dataKey
        setHabitData(normalizeHabits(Array.isArray(habitsRaw) ? habitsRaw : []));

        setGoalData(Array.isArray(goals) ? goals : []);

        setTaskData({
          completed: (tasks as TaskStats)?.completed ?? 0,
          pending:   (tasks as TaskStats)?.pending   ?? 0,
        });

        // mood-trends shape: { "YYYY-MM-DDTHH:MM:SS": ["happy", "sad", ...] }
        const moodsObj =
          moodsRaw && typeof moodsRaw === "object" && !Array.isArray(moodsRaw)
            ? (moodsRaw as Record<string, string[]>)
            : {};
        setMoodData(
          Object.entries(moodsObj).map(([dateKey, moodList]) => ({
            date:    format(new Date(dateKey), "dd MMM"),
            happy:   moodList.filter((m) => m === "happy").length,
            sad:     moodList.filter((m) => m === "sad").length,
            neutral: moodList.filter((m) => m === "neutral").length,
          }))
        );
      } catch (err) {
        console.error("[Insights] fetch failed:", err);
        setError("Failed to load insights. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [filter, isAuthenticated]);

  // ── SSE: live task + habit updates via fetch (not EventSource) ──────────────
  //
  // WHY fetch() instead of EventSource:
  // The browser's EventSource API intentionally cannot send custom HTTP headers.
  // FastAPI's CurrentUser dependency requires "Authorization: Bearer <token>".
  // fetch() with a ReadableStream body gives us identical SSE semantics while
  // allowing full header control.
  //
  // PARSING: SSE events are newline-delimited. We buffer incomplete chunks
  // and split on "\n\n" (the SSE event separator) before processing lines.
  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();

    const startSSE = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;

        const res = await fetch(apiClient.sseUrl("/insights/sse"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) return;

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double-newline (SSE event boundary)
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? ""; // last item may be an incomplete event

          for (const part of parts) {
            for (const line of part.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6));

                // Update habit completion — completionPercentage now comes from backend
                if (Array.isArray(data.habits)) {
                  setHabitData(
                    normalizeHabits(data.habits as HabitRaw[])
                  );
                }

                // Update task stats — derive counts from the full tasks array
                if (Array.isArray(data.tasks)) {
                  const stats = (data.tasks as { status: string }[]).reduce<TaskStats>(
                    (acc, task) => {
                      if (task.status === "COMPLETED") acc.completed++;
                      else acc.pending++;
                      return acc;
                    },
                    { completed: 0, pending: 0 }
                  );
                  setTaskData(stats);
                }
              } catch {
                // ignore malformed SSE events
              }
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          console.warn("[Insights SSE] stream ended:", (err as Error)?.message);
        }
      }
    };

    startSSE();
    return () => controller.abort();
  }, [isAuthenticated]);

  // ── Render states ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PlannerLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-rose-400 text-sm">{error}</p>
        <button
          onClick={() => setFilter((f) => f)} // re-trigger useEffect
          className="text-xs text-slate-400 underline cursor-pointer hover:text-slate-200"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const avgHabitCompletion =
    habitData.length > 0
      ? Math.round(habitData.reduce((s, h) => s + h.completion, 0) / habitData.length)
      : null;

  const pieData = [
    { name: "Completed", value: taskData.completed },
    { name: "Pending",   value: taskData.pending   },
  ];
  const PIE_COLORS = [C.emerald, C.muted];

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Insights</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Your learning, habits, and wellbeing at a glance
          </p>
        </div>

        {/* Single shared filter — was duplicated 5× before */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest">Range</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterRange)}
            className="bg-white/[0.06] text-white text-sm border border-white/[0.12]
                       rounded-xl px-3 py-1.5 hover:bg-white/[0.09] transition-colors
                       cursor-pointer outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* ── Summary stats row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Avg Habit Completion"
          value={avgHabitCompletion !== null ? `${avgHabitCompletion}%` : "—"}
          accent="text-violet-400"
        />
        <StatCard
          label="Tasks Completed"
          value={String(taskData.completed)}
          accent="text-emerald-400"
        />
        <StatCard
          label="Tasks Pending"
          value={String(taskData.pending)}
          accent="text-amber-400"
        />
        <StatCard
          label="Goals Tracked"
          value={String(goalData.length)}
          accent="text-cyan-400"
        />
      </div>

      {/* ── Row 1: Learning hours + Habit completion ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <ChartCard title="Learning Hours" subtitle="Committed hours per goal (all time)">
          {learningData.length === 0 ? (
            <EmptyChart label="No learning plans yet" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={learningData} barSize={22}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="title" {...AXIS} tick={false} axisLine={false} />
                <YAxis {...AXIS} />
                <Tooltip {...TOOLTIP_PROPS} labelFormatter={(l) => `Goal: ${l}`} />
                <Bar dataKey="totalHours" name="Hours" fill={C.violet} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Habit Completion"
          subtitle={`% completed per habit in the last ${filter === "7d" ? "7" : filter === "30d" ? "30" : "90"} days`}
        >
          {habitData.length === 0 ? (
            <EmptyChart label="No habits tracked in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={habitData} barSize={22}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" {...AXIS} tick={false} axisLine={false} />
                <YAxis {...AXIS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  labelFormatter={(l) => `Habit: ${l}`}
                  formatter={(v: unknown) => [`${v}%`, "Completion"]}
                />
                <Bar dataKey="completion" name="Completion %" fill={C.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ── Goals progress (full width) ───────────────────────────────────────── */}
      <ChartCard title="Goals Progress" subtitle="Average planner progress per goal">
        {goalData.length === 0 ? (
          <EmptyChart label="No goals yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={goalData} barSize={26}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="title" {...AXIS} tick={false} axisLine={false} />
              <YAxis {...AXIS} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                {...TOOLTIP_PROPS}
                labelFormatter={(l) => `Goal: ${l}`}
                formatter={(v: unknown) => [`${v}%`, "Avg Progress"]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
              <Bar dataKey="averageProgress" name="Avg Progress" fill={C.emerald} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Row 3: Task stats + Mood trends ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <ChartCard title="Task Stats" subtitle="Completed vs pending in range">
          {taskData.completed === 0 && taskData.pending === 0 ? (
            <EmptyChart label="No tasks in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  innerRadius={36}
                  paddingAngle={3}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Mood Trends" subtitle="Daily happy / sad / neutral counts">
          {moodData.length === 0 ? (
            <EmptyChart label="No mood entries in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodData}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="date" {...AXIS} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...TOOLTIP_PROPS} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                <Line type="monotone" dataKey="happy"   name="Happy"   stroke={C.emerald} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sad"     name="Sad"     stroke={C.rose}    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="neutral" name="Neutral" stroke={C.amber}   strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>
    </div>
  );
}
