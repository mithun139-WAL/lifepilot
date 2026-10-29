"use client";

import useSWR from "swr";
import { Skeleton } from "../shared/SkeletonLoader";
import { apiClient, authFetcher } from "@/lib/apiClient";
import type { DashboardStatsResponse } from "@/types/dashboard";

export function UpcomingReminders() {
  const { data: result, isLoading } = useSWR<DashboardStatsResponse>(apiClient.url("/dashboard/stats"), authFetcher);
  const upcoming = result?.data?.upcomingTasks || [];

  return (
    <div className="glass-widget p-4 h-60 overflow-y-auto">
      <h3 className="text-pink-400 font-semibold mb-3">⏰ Upcoming</h3>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : upcoming.length === 0 ? (
        <p className="text-slate-400 text-sm">No upcoming tasks.</p>
      ) : (
        <ul className="text-sm space-y-3">
          {upcoming.map((r: any, i: number) => (
            <li key={i} className="flex flex-col text-slate-300">
              <span className="font-medium">{r.title}</span>
              <span className="text-pink-300 font-mono text-xs">
                {new Date(r.dueDate).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}