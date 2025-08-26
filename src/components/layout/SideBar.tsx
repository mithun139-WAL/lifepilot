"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Bot,
  Target,
  BarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import AddGoalPopover from "../common/GoalPopover";
import PlannerLoader from "../common/PlannerLoader";
import Image from "next/image";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/chat", label: "Chat", icon: Bot },
  { href: "/insights", label: "Insights", icon: BarChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  collapsed,
  toggle,
}: {
  collapsed: boolean;
  toggle: () => void;
}) {
  const pathname = usePathname();
  const [plans, setPlans] = useState<{ id: string; topic: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalsOpen, setGoalsOpen] = useState(true);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning-plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error("Failed to fetch learning plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Handle click on Goals tab
  const handleGoalsClick = () => {
    if (collapsed) {
      toggle(); // open sidebar if collapsed
      setGoalsOpen(true); // expand submenu
    } else {
      setGoalsOpen((prev) => !prev); // toggle submenu
    }
  };

  return (
    <aside
      className={cn(
        "h-full bg-slate-950 text-white flex flex-col border-r border-slate-900 relative rounded-tl-3xl rounded-bl-3xl",
        "transition-[width] duration-300 ease-in-out will-change-[width]",
        "flex-shrink-0 min-w-[5rem]",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Toggle Sidebar */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-4 z-10 bg-slate-800 border border-slate-600 p-0.5 rounded-full hover:bg-slate-700 transition-colors shadow-md"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo */}
      <div className="flex items-center justify-center my-4">
        {collapsed ? (
          <Image
            src="/AI_coach_icon.png"
            alt="AI Coach Icon"
            width={80}
            height={80}
          />
        ) : (
          <Image
            src="/AI_coach_logo.png"
            alt="AI Coach"
            width={120}
            height={120}
          />
        )}
      </div>

      <TooltipProvider>
        <nav className="space-y-1 px-2 flex-1">
          {/* Static Nav Items */}
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            const link = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-md",
                  collapsed ? "justify-center" : "gap-1 px-3 py-0.5",
                  !collapsed &&
                    isActive &&
                    "bg-slate-800 font-semibold border-l-4 border-blue-500 shadow-blue-500/40 shadow",
                  !collapsed && "hover:bg-slate-700"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-md flex items-center justify-center transition-all",
                    collapsed
                      ? cn(
                          "w-10 h-10",
                          isActive
                            ? "bg-blue-500/20 border border-blue-500 shadow-[0_0_10px_#3B82F6]"
                            : "bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:shadow-[0_0_6px_#3B82F6]"
                        )
                      : ""
                  )}
                >
                  <Icon size={20} />
                </div>
                {!collapsed && <span className="text-sm">{label}</span>}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  {label}
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}

          <div className="border-t border-slate-700 my-3" />

          {/* Goals Parent Tab */}
          <div className="relative">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleGoalsClick}
                    className="group flex justify-center items-center ms-3 p-2.5 rounded-md bg-white/5 border border-white/10 hover:bg-blue-500/10 transition-all hover:shadow-[0_0_6px_#3B82F6] shadow"
                  >
                    <Target size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  Goals
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleGoalsClick}
                className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-md w-full gap-1 px-3 py-1",
                  goalsOpen &&
                    "bg-slate-800 font-semibold shadow-blue-500/40 shadow"
                )}
              >
                <div className="p-2 rounded-md flex items-center justify-center">
                  <Target size={18} />
                </div>
                <span className="text-sm">Goals</span>
              </button>
            )}

            {/* Submenu: Dynamic Plans */}
            {!collapsed && goalsOpen && (
              <div className="flex mt-2 transition-all duration-300 ease-in-out rounded-md flex-col space-y-1 bg-white/10 p-1">
                {loading ? (
                  <PlannerLoader />
                ) : plans.length === 0 ? (
                  <span className="text-slate-500 text-sm">No plans yet</span>
                ) : (
                  plans.map((plan) => {
                    const href = `/plans/${plan.id}`;
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={plan.id}
                        href={href}
                        className={cn(
                          "text-slate-300 rounded-md p-2 hover:text-blue-400 text-sm transition-colors",
                          isActive &&
                            "text-blue-400 font-semibold bg-slate-800 shadow-blue-500/40 shadow"
                        )}
                      >
                        {plan.topic}
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div className="fixed bottom-4 px-2">
            <AddGoalPopover
              collapsed={collapsed}
              onPlanCreated={fetchPlans}
              disabled={plans.length >= 5}
            />
          </div>
        </nav>
      </TooltipProvider>
    </aside>
  );
}
