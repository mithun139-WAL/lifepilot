"use client";

import useSWR from "swr";
import { Skeleton } from "../shared/SkeletonLoader";
import { apiClient, authFetcher } from "@/lib/apiClient";
import type { DashboardStatsResponse } from "@/types/dashboard";

export function JournalPreview() {
  const { data: result, isLoading } = useSWR<DashboardStatsResponse>(apiClient.url("/dashboard/stats"), authFetcher);
  const mood = result?.data?.recentMood;

  return (
    <div className="glass-widget p-4 h-60 overflow-y-auto">
      <h3 className="text-purple-400 font-semibold mb-3">📖 Recent Mood</h3>
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : mood ? (
        <>
          <p className="text-2xl mb-2">{mood.mood}</p>
          <p className="text-xs text-slate-400">
            Logged: {new Date(mood.createdAt).toLocaleString()}
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-400">No mood logs yet.</p>
      )}
    </div>
  );
}