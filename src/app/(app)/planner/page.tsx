"use client";

import React, { useState } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskProvider } from "@/context/TaskContext";
import { TaskForm } from "@/components/tasks/TaskForm";
import PlannerLoader from "@/components/common/PlannerLoader";
import { startOfWeek } from "date-fns";
import {
  Brain,
  Calendar,
  Check,
  ChevronDown,
  Flame,
  Layers,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import useSWR from "swr";
import { apiClient, authFetcher } from "@/lib/apiClient";

// Abbreviated day labels for the day pill tabs
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface PlannerPageProps {
  planId?: string;
}

function getDateForDayOffset(offset: number): Date {
  const today = new Date();
  const copy = new Date(today);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

/**
 * Normalise a raw tasks array (from DB or JSON blob) into a strict
 * 7-element array indexed by day-1 (index 0 = day 1, index 6 = day 7).
 * Missing days remain null so the UI can render a "rest day" placeholder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseTasksByDay(tasks: any[]): (any | null)[] {
  const byDay: (unknown | null)[] = Array(7).fill(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks.forEach((task: any) => {
    if (task && typeof task.day === "number") {
      const idx = task.day - 1;
      if (idx >= 0 && idx < 7) byDay[idx] = task;
    }
  });
  return byDay;
}

const PlannerPage: React.FC<PlannerPageProps> = ({ planId }) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [selectedHabitTab, setSelectedHabitTab] = useState<"DAILY" | "WEEKLY">("DAILY");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawData, isLoading: loading, mutate } = useSWR<Record<string, any>>(
    planId ? apiClient.url(`/learning-plans/${planId}`) : null,
    authFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const planDetails = React.useMemo(() => {
    if (!rawData) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { ...rawData };

    // ── Fallback path: DB relations are empty, reconstruct from raw JSON blobs ──
    if ((!data.planners || data.planners.length === 0) && data.planner) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.planners = data.planner.map((p: any) => {
        const weeklyTasks =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.task_list?.find((t: any) => Number(t.week) === Number(p.week))?.tasks || [];

        // Attach required shape fields before normalising
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shapedTasks = weeklyTasks.map((task: any) => ({
          ...task,
          id: `json-task-${p.week}-${task.day}`,
          status: "PENDING",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          checklists: (task.checklists || []).map((c: any, cIdx: number) => ({
            ...c,
            id: `json-check-${p.week}-${task.day}-${cIdx}`,
            status: "PENDING",
          })),
        }));

        return {
          ...p,
          id: `json-planner-${p.week}`,
          title: p.milestone,
          description: p.summary,
          progress: 0,
          tasks: normaliseTasksByDay(shapedTasks),
        };
      });
    } else if (data.planners && data.planners.length > 0) {
      // ── DB path: tasks come as a raw array from the API with a `day` field.
      //    Normalise every planner's tasks into the 7-slot indexed array so the
      //    day-tab lookup (tasks[selectedDay]) is always correct even when the
      //    LLM skipped a day during generation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.planners = data.planners.map((p: any) => {
        if (!p.tasks || p.tasks.length === 0) {
          return { ...p, tasks: Array(7).fill(null) };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasDayField = p.tasks.some((t: any) => t !== null && typeof t.day === "number");
        if (hasDayField) {
          return { ...p, tasks: normaliseTasksByDay(p.tasks) };
        }
        return p;
      });
    }

    // ── Habits fallback ──
    if ((!data.habits || data.habits.length === 0) && data.habits_list) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.habits = data.habits_list.map((h: any, idx: number) => ({
        ...h,
        id: `json-habit-${idx}`,
        name: h.title,
        description: h.description,
        frequency: (h.frequency || "daily").toUpperCase(),
        completions: [],
        streak: 0,
        progress: 0,
      }));
    }

    return data;
  }, [rawData]);

  const toggleHabit = async (habitId: string, date: Date) => {
    const pushDate =
      selectedHabitTab === "DAILY"
        ? date.toISOString()
        : startOfWeek(date, { weekStartsOn: 1 }).toISOString();

    // Optimistic update
    mutate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          habits: prev.habits.map((h: any) => {
            if (h.id !== habitId) return h;
            const completions = h.completions ? [...h.completions] : [];
            const existingIndex = completions.findIndex(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (c: any) =>
                new Date(c.date).toDateString() === new Date(pushDate).toDateString()
            );
            if (existingIndex !== -1) {
              completions[existingIndex] = {
                ...completions[existingIndex],
                completed: !completions[existingIndex].completed,
              };
            } else {
              completions.push({ date: pushDate, completed: true });
            }
            return { ...h, completions };
          }),
        };
      },
      { revalidate: false }
    );

    try {
      await apiClient.patch(
        `/learning-plans/${planId}/habits/${habitId}/toggle`,
        { date }
      );
      mutate();
    } catch (err) {
      console.error("Error toggling habit:", err);
      mutate(); // Rollback / sync on error
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-start justify-center h-screen mt-50">
        <PlannerLoader />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const habits: any[] = planDetails?.habits || [];
  const filteredHabits = habits.filter((h) => h.frequency === selectedHabitTab);
  const today = new Date();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 pb-10">

      {/* ── Week Cards ── */}
      {planDetails?.planners?.map((plan: any, idx: number) => {
        const isExpanded = expandedWeek === plan.week;
        const currentTask = plan.tasks?.[selectedDay] ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doneCount = (plan.tasks || []).filter((t: any) => t?.status === "DONE").length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalCount = (plan.tasks || []).filter((t: any) => t !== null).length;

        return (
          <div
            key={plan.id}
            className={`rounded-2xl overflow-hidden transition-all duration-300 animate-fade-in-up stagger-${Math.min(idx + 1, 5)} ${
              isExpanded ? "surface-elevated" : "surface-2"
            }`}
          >
            {/* ── Clickable week header ── */}
            <button
              className="w-full text-left p-5 flex items-start gap-4 group"
              onClick={() => {
                setExpandedWeek(isExpanded ? null : plan.week);
                setSelectedDay(0);
              }}
            >
              {/* Week number badge */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                  isExpanded
                    ? "bg-violet-500/25 border border-violet-400/40 text-violet-200"
                    : "bg-white/[0.06] border border-white/[0.10] text-slate-400 group-hover:bg-violet-500/15 group-hover:border-violet-400/25 group-hover:text-violet-300"
                }`}
              >
                W{plan.week}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-sm leading-snug mb-0.5 truncate">
                      {plan.title}
                    </h3>
                    <p
                      className={`text-slate-400 text-xs leading-relaxed transition-all duration-200 ${
                        isExpanded ? "" : "line-clamp-1"
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-violet-300 tabular-nums">
                      {plan.progress || 0}%
                    </span>
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-300 ${
                        isExpanded ? "rotate-180 text-violet-400" : "text-slate-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Progress bar + meta */}
                <div className="mt-3 space-y-1.5">
                  <div className="progress-track">
                    <div
                      className="progress-fill-violet"
                      style={{ width: `${plan.progress || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-600">
                    {plan.startDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {plan.startDate}
                        {plan.endDate && ` → ${plan.endDate}`}
                      </span>
                    )}
                    {totalCount > 0 && (
                      <span>
                        {doneCount}/{totalCount} tasks done
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            {/* ── Expanded panel ── */}
            {isExpanded && (
              <div className="border-t border-white/[0.07]">
                {/* Day pill navigation */}
                <div className="px-5 pt-4">
                  <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
                    {Array.from({ length: 7 }, (_, i) => {
                      const hasTask =
                        plan.tasks?.[i] !== null && plan.tasks?.[i] !== undefined;
                      const isActive = selectedDay === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedDay(i)}
                          className={`relative flex-shrink-0 flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 ${
                            isActive
                              ? "bg-violet-500/20 border border-violet-400/40 text-violet-200"
                              : hasTask
                              ? "bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.09] hover:text-white"
                              : "bg-white/[0.02] border border-white/[0.04] text-slate-600 hover:text-slate-400"
                          }`}
                        >
                          <span
                            className={`text-[9px] uppercase tracking-wider ${
                              isActive ? "text-violet-400" : "text-slate-600"
                            }`}
                          >
                            {DAY_LABELS[i]}
                          </span>
                          <span>{i + 1}</span>
                          {/* Dot for days with tasks */}
                          {hasTask && !isActive && (
                            <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-violet-400/50" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Task section */}
                <div className="px-5 pb-5 space-y-3">
                  {currentTask ? (
                    <>
                      {/* Daily goal banner */}
                      {currentTask.result && (
                        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-400/[0.14]">
                          <Zap
                            size={13}
                            className="text-amber-400 flex-shrink-0 mt-0.5"
                          />
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-500/60 font-semibold block mb-0.5">
                              Daily Goal
                            </span>
                            <p className="text-amber-200/75 text-xs leading-relaxed">
                              {currentTask.result}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Task + checklists rendered by existing TaskList */}
                      <TaskProvider>
                        <TaskList
                          existingTasks={[currentTask]}
                          refreshPlan={() => mutate()}
                        />
                      </TaskProvider>
                    </>
                  ) : (
                    /* Rest / missing day placeholder */
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-1">
                        <Layers size={18} className="text-slate-600" />
                      </div>
                      <p className="text-slate-500 text-sm font-medium">
                        No tasks for {DAY_LABELS[selectedDay]}
                      </p>
                      <p className="text-slate-600 text-xs">
                        Use this day to review, refactor, or consolidate earlier work.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Habits Section (plan-level, shown once outside the week loop) ── */}
      {habits.length > 0 && (
        <div className="surface-2 rounded-2xl p-5 mt-2 animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-400/20 flex items-center justify-center">
                <Brain size={13} className="text-violet-400" />
              </div>
              <span className="text-white font-semibold text-sm">Habits</span>
              <span className="text-[11px] text-slate-600 font-normal">
                {habits.length} tracked
              </span>
            </div>

            {/* DAILY / WEEKLY tab switch */}
            <div className="flex gap-0.5 bg-white/[0.05] rounded-lg p-0.5 border border-white/[0.06]">
              {(["DAILY", "WEEKLY"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedHabitTab(tab)}
                  className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    selectedHabitTab === tab
                      ? "bg-violet-500/25 text-violet-200 border border-violet-400/20"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {tab === "DAILY" ? "Daily" : "Weekly"}
                </button>
              ))}
            </div>
          </div>

          {/* Habit list */}
          <div className="space-y-2">
            {filteredHabits.length > 0 ? (
              filteredHabits.map((habit: any) => {
                const weekStart = startOfWeek(today, { weekStartsOn: 1 });
                const checkDate = selectedHabitTab === "DAILY" ? today : weekStart;
                const isCompleted = habit.completions?.some(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (c: any) =>
                    new Date(c.date).toDateString() === checkDate.toDateString() &&
                    c.completed
                );

                return (
                  <div
                    key={habit.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                      isCompleted
                        ? "bg-emerald-500/[0.06] border-emerald-400/[0.15]"
                        : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.09]"
                    }`}
                  >
                    {/* Toggle circle */}
                    <button
                      onClick={() => toggleHabit(habit.id, today)}
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border-2 cursor-pointer transition-all duration-200 ${
                        isCompleted
                          ? "bg-emerald-500 border-emerald-400"
                          : "border-slate-600 hover:border-emerald-400 hover:scale-110"
                      }`}
                    >
                      {isCompleted && (
                        <Check size={10} className="text-white" />
                      )}
                    </button>

                    {/* Habit text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium leading-tight ${
                          isCompleted
                            ? "line-through text-slate-500"
                            : "text-white"
                        }`}
                      >
                        {habit.name || habit.title}
                      </p>
                      {habit.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {habit.description}
                        </p>
                      )}
                    </div>

                    {/* Frequency badge */}
                    <span
                      className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        habit.frequency === "DAILY"
                          ? "bg-cyan-500/10 border-cyan-400/20 text-cyan-400"
                          : "bg-violet-500/10 border-violet-400/20 text-violet-400"
                      }`}
                    >
                      {habit.frequency?.toLowerCase()}
                    </span>

                    {/* Streak */}
                    <div className="flex-shrink-0 flex items-center gap-0.5">
                      <Flame size={12} className="text-amber-400 animate-streak-pulse" />
                      <span className="text-amber-300 font-semibold text-xs tabular-nums">
                        {habit.streak || 0}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="flex-shrink-0 flex items-center gap-0.5">
                      <TrendingUp size={11} className="text-slate-500" />
                      <span className="text-slate-400 text-xs tabular-nums">
                        {habit.progress || 0}%
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-5 text-center">
                <Target size={16} className="text-slate-700 mx-auto mb-1.5" />
                <p className="text-slate-500 text-sm">
                  No {selectedHabitTab.toLowerCase()} habits tracked
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task form (for adding/editing tasks) */}
      <TaskProvider>
        <TaskForm />
      </TaskProvider>
    </div>
  );
};

export default PlannerPage;
