"use client";

/**
 * TodayCommand.tsx
 *
 * REPLACES: TodayTimeline (a two-panel split with no visual priority)
 *
 * WHY "COMMAND":
 * The old timeline showed upcoming and pending tasks with equal weight.
 * This component introduces priority: overdue tasks get a visual alarm
 * (rose accent), upcoming tasks get a calm blue treatment. The user
 * immediately knows what needs attention first.
 *
 * LAYOUT DECISION — TABS instead of side-by-side panels:
 * On the dashboard, horizontal space is shared with the right column.
 * Tabs let both lists use the full width without crowding.
 * Switching between "Upcoming" and "Overdue" is also a clear mental model.
 *
 * OVERDUE BADGE:
 * If there are overdue tasks, the "Overdue" tab shows a count badge.
 * This is a gentle urgency signal — not an alert popup, but something
 * users naturally want to resolve (loss aversion psychology).
 *
 * EMPTY STATE:
 * "No tasks — you're all clear" is motivating. It rewards task completion
 * rather than just showing an empty list.
 *
 * TASK ITEM DESIGN:
 * Each task shows: title + plan context + time.
 * The plan context (e.g. "FastAPI Learning") anchors the task in the
 * bigger journey, preventing tasks from feeling arbitrary.
 */

import { useMemo, useState } from "react";
import useSWR from "swr";
import { format, isPast } from "date-fns";
import { CheckCircle2, Clock, AlertCircle, Inbox } from "lucide-react";
import { apiClient, authFetcher } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  preferredTime: string;
  status: string;
  learningPlanTitle?: string;
}

type Tab = "upcoming" | "overdue";

export function TodayCommand() {
  const { data, isLoading } = useSWR<any>(apiClient.url("/tasks/today"), authFetcher);
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const tasks: TaskItem[] = data?.data ?? data?.tasks ?? [];

  const { upcoming, overdue } = useMemo(() => {
    const up: TaskItem[] = [];
    const ov: TaskItem[] = [];
    tasks.forEach((t) => {
      if (t.status === "COMPLETED") return;
      const taskTime = new Date(t.preferredTime);
      isPast(taskTime) ? ov.push(t) : up.push(t);
    });
    return { upcoming: up.slice(0, 6), overdue: ov.slice(0, 6) };
  }, [tasks]);

  const visibleTasks = activeTab === "upcoming" ? upcoming : overdue;

  return (
    <div className="surface-2 p-4 flex flex-col gap-3 min-h-0">

      {/* Header + tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <CheckCircle2 size={14} className="text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-white">Today&apos;s Tasks</span>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
              activeTab === "upcoming"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-white/40 hover:text-white/70"
            )}
          >
            <Clock size={11} />
            Upcoming
            {upcoming.length > 0 && (
              <span className="bg-cyan-500/30 text-cyan-300 rounded-full px-1.5 text-[10px]">
                {upcoming.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("overdue")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150",
              activeTab === "overdue"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-white/40 hover:text-white/70"
            )}
          >
            <AlertCircle size={11} />
            Overdue
            {overdue.length > 0 && (
              <span className="bg-rose-500/30 text-rose-300 rounded-full px-1.5 text-[10px]">
                {overdue.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-64">
        {isLoading ? (
          <div className="space-y-2 py-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/5 rounded-xl" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-white/30">
            <Inbox size={28} className="opacity-40" />
            <p className="text-xs">
              {activeTab === "upcoming"
                ? "No upcoming tasks — you're all clear 🎉"
                : "No overdue tasks — great work! ✅"}
            </p>
          </div>
        ) : (
          visibleTasks.map((task, i) => (
            <div
              key={task.id}
              className={cn(
                "task-item animate-fade-in-up",
                `stagger-${Math.min(i + 1, 5)}`
              )}
            >
              {/* Status dot */}
              <div className={cn(
                "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                activeTab === "overdue" ? "bg-rose-400" : "bg-cyan-400"
              )} />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium truncate leading-tight">
                  {task.title}
                </p>
                {task.learningPlanTitle && (
                  <p className="text-[11px] text-white/35 mt-0.5 truncate">
                    {task.learningPlanTitle}
                  </p>
                )}
              </div>

              {task.preferredTime && (
                <span className={cn(
                  "text-[11px] font-mono flex-shrink-0",
                  activeTab === "overdue" ? "text-rose-400/70" : "text-cyan-400/70"
                )}>
                  {format(new Date(task.preferredTime), "h:mm a")}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
