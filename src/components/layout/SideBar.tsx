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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/chat", label: "Chat", icon: Bot },
  // { href: "/planner", label: "Planner", icon: Calendar },
  // { href: "/tasks", label: "Tasks", icon: ListTodo },
  // { href: "/habits", label: "Habits", icon: Target },
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

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/learning-plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error("Failed to fetch learning plans:", err);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return (
    <aside
      className={cn(
        "h-full bg-slate-950 text-white flex flex-col border-r border-slate-900 relative rounded-tl-3xl rounded-bl-3xl",
        "transition-[width] duration-300 ease-in-out will-change-[width]",
        "flex-shrink-0 min-w-[5rem]",
        collapsed ? "w-20" : "w-64"
      )}
    >
      <button
        onClick={toggle}
        className="absolute -right-3 top-4 z-10 bg-slate-800 border border-slate-600 p-0.5 rounded-full hover:bg-slate-700 transition-colors shadow-md"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <TooltipProvider>
        <nav className="space-y-2 px-2 pt-7 flex-1 mt-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            const link = (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-md",
                  collapsed ? "justify-center" : "gap-3 px-3 py-2",
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

          <div className="px-2 mb-2">
            <AddGoalPopover collapsed={collapsed} onPlanCreated={fetchPlans} disabled={plans.length >= 5} />
          </div>

          {/* Dynamic plans */}
          {plans.map((plan) => {
            const href = `/plans/${plan.id}`;
            const isActive = pathname === href;

            const link = (
              <Link
                key={plan.id}
                href={href}
                className={cn(
                  "group flex items-center transition-all duration-300 ease-in-out rounded-md",
                  collapsed ? "justify-center" : "gap-3 px-3 py-2",
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
                  <Target size={18} />
                </div>
                {!collapsed && <span className="text-sm">{plan.topic}</span>}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={plan.id}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  {plan.topic}
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </nav>
      </TooltipProvider>
    </aside>
  );
}
