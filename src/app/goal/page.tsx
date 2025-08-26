"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { DateTimePickerForm } from "@/components/ui/date-time-picker";
import CustomSelect from "@/components/common/CustomSelect";
import {
  studyHoursOptions,
  studyWeeksOptions,
} from "@/lib/constants/constants";
import AppLoader from "@/components/common/AppLoader";

export default function GoalPage() {
  const router = useRouter();
  const [step, setStep] = useState<"title" | "details" | "done">("title");

  const [title, setTitle] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("");
  const [targetWeeks, setTargetWeeks] = useState("");
  const [goalId, setGoalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preferredTime, setPreferredTime] = useState("");

  const handleNext = () => {
    if (title.trim()) {
      setStep("details");
    }
  };

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
          hoursPerDay: hoursPerDay,
          targetWeeks: Number(targetWeeks),
          preferredTime: preferredTime
            ? new Date(preferredTime).toISOString()
            : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Goal created:", data);
        setGoalId(data.data?.id);
        setStep("done");
      }
    } catch (error) {
      console.error("Failed to create goal:", error);
      return;
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
        const data = await res.json();
        console.log("Plan generated:", data);
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to generate plan:", error);
      return;
    } finally {
      setLoading(false);
    }
  };

  // const existingGoal = async () => {
  //   try {
  //     const res = await fetch("/api/goals", {
  //       method: "GET",
  //       headers: { "Content-Type": "application/json" },
  //     });

  //     if (!res.ok) {
  //       console.error("Failed to fetch goal");
  //       setStep("done");
  //       return;
  //     }

  //     const data = await res.json();
  //     const goal = data?.data;

  //     if (!goal) {
  //       setStep("title");
  //       return;
  //     }

  //     setTitle(goal[0].title);
  //     setGoalId(goal[0].id);

  //     if (goal.planners && goal.planners.length > 0) {
  //       router.push("/dashboard");
  //     } else {
  //       setStep("done");
  //     }
  //   } catch (error) {
  //     console.error("Error fetching goal:", error);
  //     setStep("done");
  //   }
  // };

  // useEffect(() => {
  //   existingGoal();
  // }, []);

  if (loading) return <AppLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 text-white shadow-[0_0_20px_#3B82F6]/20">
        {step === "title" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6 capitalize">
              What’s Your Goal?
            </h1>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Learn Spanish"
                className="flex-1 bg-transparent text-white outline-none placeholder:text-slate-400 border border-blue-500/30 rounded-xl px-4 py-3 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30"
              />
              <button
                onClick={handleNext}
                className="bg-blue-600 p-3 rounded-xl hover:bg-blue-700 cursor-pointer transition-colors duration-200"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-2xl font-bold text-center mb-6 capitalize">
              {title}
            </h1>
            <div className="flex flex-col justify-between h-100">
              <div>
                <label className="block font-medium mb-2">Duration</label>
                <CustomSelect
                  value={targetWeeks}
                  onChange={handleTargetWeeksChange}
                  options={studyWeeksOptions}
                  placeholder="Select duration (in weeks)"
                />
              </div>
              <div>
                <label className="block font-medium mb-2">
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
                <label className="block font-medium mb-2">
                  Preferred Start Time
                </label>
                <DateTimePickerForm
                  value={preferredTime}
                  onChange={(val) => setPreferredTime(val)}
                />
                <p className="text-xs text-zinc-400 text-right mt-1">Enter time when you want to start in a day</p>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 cursor-pointer"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Goal"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold capitalize">{title}</h1>
            <button
              onClick={handleGeneratePlan}
              className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700 cursor-pointer"
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Plan"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
