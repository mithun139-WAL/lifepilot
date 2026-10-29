"use client";

import useSWR from "swr";
import { Skeleton } from "../shared/SkeletonLoader";
import { apiClient, authFetcher } from "@/lib/apiClient";
import type { DashboardStatsResponse } from "@/types/dashboard";

export function LifeScoreCard() {
  const { data: result, isLoading } = useSWR<DashboardStatsResponse>(apiClient.url("/dashboard/stats"), authFetcher);
  const score = result?.data?.lifeScore ?? 0;

  return (
    <div className="glass-widget p-4 text-center h-60 flex flex-col justify-center">
      <h3 className="text-cyan-400 text-lg font-bold mb-2">✨ Life Score</h3>
      {isLoading ? (
        <Skeleton className="h-12 w-20 mx-auto mt-2" />
      ) : (
        <p className="text-5xl font-extrabold text-white">{score}</p>
      )}
      <p className="text-slate-400 text-sm mt-1">Today’s energy level</p>
    </div>
  );
}