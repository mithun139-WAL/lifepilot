"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import CustomSelect from "@/components/common/CustomSelect";
import {
  studyHoursOptions,
  studyWeeksOptions,
} from "@/lib/constants/constants";
import { DateTimePickerForm } from "../ui/date-time-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export default function AddGoalPopover({
  collapsed,
  onPlanCreated,
  disabled,
}: {
  collapsed: boolean;
  onPlanCreated?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [targetWeeks, setTargetWeeks] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");

  const handleHoursPerDayChange = (val: string) => {
    setHoursPerDay(val);
  };

  const handleTargetWeeksChange = (val: string) => {
    setTargetWeeks(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          hoursPerDay,
          targetWeeks: Number(targetWeeks),
          preferredTime: preferredTime
            ? new Date(preferredTime).toISOString()
            : null,
        }),
      });

      if (res.ok) {
        setHoursPerDay("");
        setTargetWeeks("");
        setPreferredTime("");
        const data = await res.json();
        console.log("Goal created:", data);
        setGoalId(data.data?.id);
      }
    } catch (err) {
      console.error("Failed to add goal:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!goalId) return;
    setLoading(true);
    try {
      console.log("➡️ Triggering plan generation for goal ID:", goalId);
      const res = await fetch("/api/planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goalId }),
      });
      if (res.ok) {
        setTitle("");
        setGoalId(null);
        const data = await res.json();
        console.log("Plan generated:", data);
        setOpen(false);
        if (onPlanCreated) onPlanCreated();
      }
    } catch (error) {
      console.error("Failed to generate plan:", error);
      return;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={`flex items-center w-full rounded-md px-3 py-2 bg-slate-800 text-gray-500 cursor-not-allowed ${
                  collapsed ? "justify-center" : "gap-2"
                }`}
                disabled
              >
                <Plus size={18} />
                {!collapsed && <span className="text-sm">Add Goal</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Limit reached (max 5 goals)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        // 🔹 Normal active state with DialogTrigger
        <DialogTrigger asChild>
          <button
            className={`flex items-center w-full rounded-md px-3 py-2 bg-blue-700 hover:bg-slate-700 transition ${
              collapsed ? "justify-center" : "gap-2"
            }`}
          >
            <Plus size={18} />
            {!collapsed && <span className="text-sm">Add Goal</span>}
          </button>
        </DialogTrigger>
      )}

      <DialogContent
        className="bg-slate-900 text-white border border-slate-700 rounded-xl p-6"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {!goalId && (
          <DialogHeader>
            <DialogTitle>Add New Goal</DialogTitle>
          </DialogHeader>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          {!goalId && (
            <div className="flex flex-col justify-between h-120">
              <div>
                <label className="block font-medium text-sm mb-2">
                  What’s Your Goal?
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Learn Spanish"
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3"
                />
              </div>
              <div>
                <label className="block font-medium text-sm mb-2">
                  Duration
                </label>
                <CustomSelect
                  value={targetWeeks}
                  onChange={handleTargetWeeksChange}
                  options={studyWeeksOptions}
                  placeholder="Select duration (in weeks)"
                />
              </div>
              <div>
                <label className="block font-medium text-sm mb-2">
                  How many hours you can spend?
                </label>
                <CustomSelect
                  value={hoursPerDay}
                  onChange={handleHoursPerDayChange}
                  options={studyHoursOptions}
                  placeholder="Select study duration"
                />
              </div>
              <div>
                <label className="block font-medium text-sm mb-2">
                  Preferred Start Time
                </label>
                <DateTimePickerForm
                  value={preferredTime}
                  onChange={(val) => setPreferredTime(val)}
                />
                <p className="text-xs text-zinc-400 text-right mt-1">
                  Enter time when you want to start in a day
                </p>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 cursor-pointer"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Goal"}
              </button>
            </div>
          )}
          {goalId && (
            <>
              <h1 className="text-2xl font-bold text-center mb-6 capitalize">
                {title || "Your Goal"}
              </h1>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={loading}
                className="w-full bg-green-600 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50 mt-2"
              >
                {loading ? "Generating..." : "Generate Plan"}
              </button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
