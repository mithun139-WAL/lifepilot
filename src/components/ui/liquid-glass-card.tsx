"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
}

export function LiquidGlassCard({ children, className }: LiquidGlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 backdrop-blur-lg bg-white/5 shadow-[0_0_30px_#3B82F6]/20 transition",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:animate-liquid before:blur-[4px]",
        className
      )}
    >
      <div className="relative z-10 p-4">{children}</div>
    </div>
  );
}