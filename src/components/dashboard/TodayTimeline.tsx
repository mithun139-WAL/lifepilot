"use client";

/**
 * src/components/dashboard/TodayTimeline.tsx
 *
 * WHY THIS CHANGED:
 * - useSession() → useAuth() — user identity comes from AuthContext/tokenStore
 * - SWR key no longer includes ?userId= — FastAPI reads user from the JWT
 * - Plain fetcher replaced with authFetcher that injects the Bearer token
 * - Response shape updated: FastAPI returns { success, data: [...] }
 *   whereas the old Next.js route returned { tasks: [...] }
 *   We check both shapes for safety during the transition.
 */

import { useMemo } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { apiClient, authFetcher } from "@/lib/apiClient";

interface TaskItem {
  id: string;
  title: string;
  preferredTime: string;
  status: string;
  learningPlanTitle?: string;
}

export function TodayTimeline() {
  const { isAuthenticated } = useAuth();

  const { data } = useSWR<any>(
    // Guard on authentication; no ?userId= — FastAPI reads from JWT
    isAuthenticated ? apiClient.url("/tasks/today") : null,
    authFetcher
  );

  // Support both FastAPI shape { data: [...] } and legacy Next.js shape { tasks: [...] }
  const tasks: TaskItem[] = data?.data ?? data?.tasks ?? [];

  const now = new Date();

  const { leftTasks, rightTasks } = useMemo(() => {
    const left: TaskItem[] = [];
    const right: TaskItem[] = [];

    tasks.forEach((task) => {
      if (task.status === "COMPLETED") return;
      const taskTime = new Date(task.preferredTime);
      if (taskTime > now) {
        left.push(task);
      } else {
        right.push(task);
      }
    });

    return {
      leftTasks: left.slice(0, 5),
      rightTasks: right.slice(0, 5),
    };
  }, [tasks, now]);

  return (
    <div className="w-full backdrop-blur-md rounded-2xl border border-blue-500/20 p-4 shadow-inner text-white">
      <h3 className="text-white font-semibold mb-4 text-lg">
        Today&apos;s Focus
      </h3>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Section — future tasks */}
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-blue-500/20">
          <h4 className="text-blue-300 font-medium mb-2">Upcoming Tasks</h4>
          {leftTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No upcoming tasks 🎉</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {leftTasks.map((task) => (
                <li key={task.id} className="flex justify-between">
                  <span>{task.title} - {task.learningPlanTitle}</span>
                  <span className="text-cyan-400 font-mono w-20 text-right">
                    {format(new Date(task.preferredTime), "hh:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Section — past overdue tasks */}
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-blue-500/20">
          <h4 className="text-pink-300 font-medium mb-2">Pending Tasks</h4>
          {rightTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending past tasks ✅</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {rightTasks.map((task) => (
                <li key={task.id} className="flex justify-between">
                  <span>{task.title} - {task.learningPlanTitle}</span>
                  <span className="text-pink-200 font-mono">
                    {format(new Date(task.preferredTime), "hh:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
