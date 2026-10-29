"use client";

/**
 * SideBar.tsx — Redesigned navigation rail
 *
 * DESIGN DECISIONS:
 *
 * 1. JOURNAL added as first-class nav item
 *    The journal (mood + thoughts) is a core daily ritual, not a settings-buried feature.
 *    Elevating it to nav gives users a clear habit loop: open app → check Today → log Journal.
 *
 * 2. VIOLET active state instead of blue border
 *    Blue borders on a dark blue background have low contrast — the active state
 *    gets lost. Violet stands out distinctly against the dark indigo background
 *    while feeling "AI-native" and premium.
 *
 * 3. STREAK badge in the logo area
 *    Streaks are the #1 retention mechanic in learning apps (Duolingo, GitHub).
 *    Placing the streak count near the top means every time you open the sidebar,
 *    you see your streak — motivation without interruption.
 *
 * 4. SETTINGS moved to the very bottom
 *    Settings is a utility, not a workflow step. It should never compete for
 *    attention with core actions. Fixed bottom placement keeps it accessible
 *    but out of the primary visual hierarchy.
 *
 * 5. GOALS section kept as accordion
 *    Goals → Plans is the core learning journey path. The accordion keeps
 *    it discoverable without permanently consuming sidebar real estate.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Bot,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Target,
  BookOpen,
  Compass,
  Flame,
  UserCircle2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useAuth } from "@/context/AuthContext";
import AddGoalPopover from "../common/GoalPopover";
import PlannerLoader from "../common/PlannerLoader";
import Image from "next/image";
import { apiClient, authFetcher } from "@/lib/apiClient";

/* Primary navigation items — ordered by usage frequency */
const navItems = [
  { href: "/dashboard", label: "Today",    icon: Home,     description: "Your daily command center" },
  { href: "/chat",      label: "Ask AI",   icon: Bot,      description: "Talk to your AI coach" },
  { href: "/insights",  label: "Insights", icon: BarChart2, description: "Progress analytics" },
  { href: "/journal",   label: "Journal",  icon: BookOpen, description: "Thoughts & mood log" },
];

interface StreakHabit {
  id: string;
  description: string;
  streak: number;
}

export function Sidebar({
  collapsed,
  toggle,
}: {
  collapsed: boolean;
  toggle: () => void;
}) {
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuth();

  /* Learning plans for the Goals accordion */
  const { data: plans = [], isLoading: loading, mutate } = useSWR<
    { id: string; topic: string }[]
  >(isAuthenticated ? apiClient.url("/learning-plans") : null, authFetcher);

  /* Streak data — shown as a compact badge at top */
  const { data: streakHabits = [] } = useSWR<StreakHabit[]>(
    isAuthenticated ? apiClient.url("/habits/streaks") : null,
    authFetcher
  );

  /* Highest streak across all habits — the one number to motivate */
  const topStreak = streakHabits.reduce(
    (max, h) => (h.streak > max ? h.streak : max),
    0
  );

  const [goalsOpen, setGoalsOpen] = useState(true);

  const handleGoalsClick = () => {
    if (collapsed) {
      toggle();
      setGoalsOpen(true);
    } else {
      setGoalsOpen((prev) => !prev);
    }
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col border-r border-white/[0.06] relative rounded-tl-3xl rounded-bl-3xl",
        "bg-black/40 backdrop-blur-xl",
        "transition-[width] duration-300 ease-in-out will-change-[width] flex-shrink-0",
        collapsed ? "w-[72px]" : "w-60"
      )}
    >
      {/* ── Collapse toggle ────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-5 z-20 bg-slate-800 border border-white/10 p-0.5 rounded-full hover:bg-slate-700 transition-colors shadow-md"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* ── Logo + streak badge ─────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center my-5 px-3 gap-3",
        collapsed ? "justify-center flex-col gap-2" : "justify-between"
      )}>
        {collapsed ? (
          <Image src="/AI_coach_icon.png" alt="LifePilot" width={36} height={36} />
        ) : (
          <Image src="/AI_coach_logo.png" alt="LifePilot" width={100} height={36} className="object-contain" />
        )}

        {/* Streak badge — motivation anchor at the top of sidebar */}
        {topStreak > 0 && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold",
            "bg-amber-500/15 border border-amber-500/30 text-amber-400",
            "animate-streak-pulse",
            collapsed && "px-1.5"
          )}>
            <Flame size={12} className="text-amber-400" />
            {!collapsed && <span>{topStreak}d</span>}
            {collapsed && <span className="text-[10px]">{topStreak}</span>}
          </div>
        )}
      </div>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="mx-3 border-t border-white/[0.06] mb-2" />

      {/* ── Primary navigation ──────────────────────────────────────────── */}
      <TooltipProvider delayDuration={200}>
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">

          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");

            const linkEl = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center px-2" : "",
                  isActive
                    ? "bg-violet-500/15 text-violet-300 border-l-2 border-violet-400 pl-[10px]"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white border-l-2 border-transparent"
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    isActive ? "text-violet-400" : "text-slate-500 group-hover:text-white"
                  )}
                />
                {!collapsed && <span>{label}</span>}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-white/10">
                  {label}
                </TooltipContent>
              </Tooltip>
            ) : linkEl;
          })}

          {/* ── Divider ────────────────────────────────────────────────── */}
          <div className="mx-1 border-t border-white/[0.06] my-2" />

          {/* ── Goals / Journey section ─────────────────────────────────── */}
          <div>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleGoalsClick}
                    className={cn(
                      "flex justify-center items-center w-full px-2 py-2.5 rounded-xl transition-all duration-150",
                      goalsOpen
                        ? "bg-violet-500/15 text-violet-400"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    <Compass size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-white/10">
                  Journey
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleGoalsClick}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border-l-2 border-transparent",
                  goalsOpen
                    ? "bg-violet-500/10 text-violet-300 border-violet-400/50"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                )}
              >
                <Compass size={18} className={goalsOpen ? "text-violet-400" : "text-slate-500"} />
                <span>Journey</span>
                <span className={cn(
                  "ml-auto text-xs transition-transform duration-200",
                  goalsOpen ? "rotate-90" : "rotate-0"
                )}>
                  ›
                </span>
              </button>
            )}

            {/* Plans sub-list */}
            {!collapsed && goalsOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-white/[0.08] space-y-0.5">
                {loading ? (
                  <PlannerLoader />
                ) : plans.length === 0 ? (
                  <p className="text-slate-600 text-xs py-2 px-2">No plans yet</p>
                ) : (
                  plans.map((plan) => {
                    const href = `/plans/${plan.id}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={plan.id}
                        href={href}
                        className={cn(
                          "block text-xs px-2 py-1.5 rounded-lg transition-all duration-150 truncate max-w-[160px]",
                          isActive
                            ? "text-violet-300 bg-violet-500/10 font-medium"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                        )}
                        title={plan.topic}
                      >
                        {plan.topic}
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── Target icon for goals ────────────────────────────────────── */}
          {!collapsed && (
            <div className="mt-1 px-2">
              <AddGoalPopover
                collapsed={collapsed}
                onPlanCreated={() => mutate()}
                disabled={plans.length >= 5}
              />
            </div>
          )}
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="px-2">
                  <AddGoalPopover
                    collapsed={collapsed}
                    onPlanCreated={() => mutate()}
                    disabled={plans.length >= 5}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-white/10">
                Add Goal
              </TooltipContent>
            </Tooltip>
          )}
        </nav>

        {/* ── Settings — bottom utility ────────────────────────────────────── */}
        <div className="px-2 pb-4 pt-2 border-t border-white/[0.06] space-y-0.5">

          {/* Profile link */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/profile"
                  className={cn(
                    "flex justify-center items-center py-2.5 rounded-xl transition-all duration-150",
                    pathname === "/profile"
                      ? "bg-violet-500/15 text-violet-400"
                      : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt={user.name ?? "Profile"}
                      width={20}
                      height={20}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 size={17} />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-white/10">
                {user?.name ?? "Profile"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border-l-2 border-transparent",
                pathname === "/profile"
                  ? "bg-violet-500/15 text-violet-300 border-violet-400"
                  : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
              )}
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "Profile"}
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <UserCircle2 size={17} className={pathname === "/profile" ? "text-violet-400" : "text-slate-500"} />
              )}
              <span className="truncate">{user?.name ?? "Profile"}</span>
            </Link>
          )}

          {/* Settings */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className={cn(
                    "flex justify-center items-center py-2.5 rounded-xl transition-all duration-150",
                    pathname === "/settings"
                      ? "bg-violet-500/15 text-violet-400"
                      : "text-slate-500 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <Settings size={17} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="bg-slate-800 border-white/10">
                Settings
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border-l-2 border-transparent",
                pathname === "/settings"
                  ? "bg-violet-500/15 text-violet-300 border-violet-400"
                  : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
              )}
            >
              <Settings size={17} className={pathname === "/settings" ? "text-violet-400" : "text-slate-500"} />
              <span>Settings</span>
            </Link>
          )}
        </div>
      </TooltipProvider>
    </aside>
  );
}
