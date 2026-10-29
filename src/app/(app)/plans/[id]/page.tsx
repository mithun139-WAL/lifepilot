"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiClient, authFetcher } from "@/lib/apiClient";
import PlannerPage from "../../planner/page";

interface LearningPlanSummary {
  id: string;
  topic: string;
}

export default function PlanPage() {
  const params = useParams();
  const id = params?.id as string;

  // Use SWR so we get: deduplication with PlannerPage's own SWR call,
  // a proper loading state (no "Plan not found" flash), and auth refresh.
  const { data: plan, isLoading, error } = useSWR<LearningPlanSummary>(
    id ? apiClient.url(`/learning-plans/${id}`) : null,
    authFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  if (isLoading) {
    return (
      <div className="p-2 space-y-4">
        {/* Title skeleton */}
        <div className="h-8 w-72 rounded-lg bg-white/10 animate-pulse" />
        {/* Week card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-white/5 border border-white/10 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-medium text-white/50 mb-4">
          Plan not found
        </h1>
        <p className="text-sm text-white/30">
          This plan may have been deleted, or you may not have access to it.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <h1 className="text-2xl font-medium text-white mb-4">{plan.topic}</h1>
      {/* Pass id directly — PlannerPage uses the same SWR key so no second fetch */}
      <PlannerPage planId={id} />
    </div>
  );
}
