"use client";
import useSWR from "swr";
import { WidgetSkeleton } from "../shared/SkeletonLoader";
import { apiClient, authFetcher } from "@/lib/apiClient";
import type { DashboardStatsResponse } from "@/types/dashboard";

export function HabitStats() {
  const { data: result, isLoading } = useSWR<DashboardStatsResponse>(apiClient.url("/dashboard/stats"), authFetcher);
  const habits = result?.data?.habits || [];

  if (isLoading) return <WidgetSkeleton />;
  return (
    <div className="glass-widget p-4 h-60 overflow-y-auto">
      <h3 className="text-white font-semibold mb-4">✅ Habits Today</h3>
      {habits.length === 0 ? (
        <p className="text-slate-400 text-sm">No habits tracked yet.</p>
      ) : (
        <ul className="space-y-3">
          {habits.map((habit: any, i: number) => (
            <li
              key={i}
              className={`flex justify-between text-sm ${
                habit.done ? "text-green-400" : "text-slate-300"
              }`}
            >
              {habit.name}
              <span>{habit.done ? "✔️" : "⏳"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}