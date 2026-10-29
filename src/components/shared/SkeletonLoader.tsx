"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-800/50 rounded-xl ${className}`}
    />
  );
}

export function WidgetSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 h-50 flex flex-col space-y-4">
      <Skeleton className="h-6 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
