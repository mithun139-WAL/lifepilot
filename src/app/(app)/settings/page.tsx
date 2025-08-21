"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { LiquidGlassCard } from "@/components/ui/liquid-glass-card";
import GeneratePlanButton from "@/components/common/GeneratePlanButton";
import CustomSelect from "@/components/common/CustomSelect";
import PlannerLoader from "@/components/common/PlannerLoader";

interface Goal {
  id: string;
  title: string;
  hasPlan?: boolean;
}
interface LearningPlan {
  id: string;
  topic: string;
  goalId: string;
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<"goals" | "learningPlans">(
    "goals"
  );
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>("");

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/goals", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGoals(data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning-plans");
      if (!res.ok) throw new Error("Failed to fetch learning plans");
      const data = await res.json();
      setLearningPlans(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteGoal = async (id: string) => {
    const confirmDelete = confirm(
      "Deleting a goal will also delete the entire Learning Plan. Are you sure?"
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchGoals();
        window.location.href = "/settings";
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to delete goal");
      }
    } catch (err) {
      console.error("Error deleting goal:", err);
    }
  };

  const deletePlan = async (id: string) => {
    try {
      const res = await fetch(`/api/learning-plans/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchLearningPlans();
        window.location.href = "/settings";
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to delete plan");
      }
    } catch (err) {
      console.error("Error deleting plan:", err);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchGoals(), fetchLearningPlans()]);
      setLoading(false);
    })();
  }, []);

  const availableGoals = goals.filter(
    (g) => !learningPlans.find((lp) => lp.goalId === g.id)
  );

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <PlannerLoader />
      </div>
    );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r p-2">
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setActiveTab("goals")}
              className={`w-full text-left px-3 py-2 rounded-lg cursor-pointer bg-transparent ${
                activeTab === "goals"
                  ? "border border-slate-800 font-medium"
                  : "hover:bg-slate-700"
              }`}
            >
              Goals
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab("learningPlans")}
              className={`w-full text-left px-3 py-2 rounded-lg bg-transparent ${
                activeTab === "learningPlans"
                  ? "border border-slate-800 font-medium"
                  : "hover:bg-slate-700"
              }`}
            >
              Learning Plans
            </button>
          </li>
        </ul>
      </aside>

      <main className="flex-1 p-6">
        {activeTab === "goals" && (
          <div>
            <h3 className="text-lg font-bold mb-4">Your Goals</h3>
            <div className="space-y-2">
              {goals.map((goal) => (
                <LiquidGlassCard key={goal.id} className="bg-transparent">
                  <CardContent className="flex justify-between items-center">
                    <span>{goal.title}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="ml-50 bg-transparent border border-blue-500/30 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-cyan-400">
                            Delete Goal ?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-red-600">
                            Deleting <b>{goal.title}</b> will also delete the
                            entire associated Learning Plan. This action cannot
                            be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteGoal(goal.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </LiquidGlassCard>
              ))}
            </div>
          </div>
        )}

        {activeTab === "learningPlans" && (
          <div>
            <h3 className="text-lg font-bold mb-4">Your Learning Plans</h3>
            <div className="space-y-2">
              {learningPlans.map((plan) => (
                <LiquidGlassCard key={plan.id} className="bg-transparent">
                  <CardContent className="flex justify-between items-center">
                    <span>{plan.topic}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="ml-50 bg-transparent border border-blue-500/30 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-cyan-400">
                            Delete Learning Plan ?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-red-600">
                            Deleting <b>{plan.topic}</b> cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-transparent">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deletePlan(plan.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </LiquidGlassCard>
              ))}
            </div>

            <div className="mt-6">
              <label className="block font-medium mb-2">
                Generate plan for Existing Goal that has no plan
              </label>
              <CustomSelect
                value={selectedGoal}
                onChange={setSelectedGoal}
                options={availableGoals.map((goal) => ({
                  value: goal.id,
                  label: goal.title,
                }))}
                placeholder="Select an existing Goal"
              />
              <div className="mt-4">
                {selectedGoal && <GeneratePlanButton goalId={selectedGoal} />}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsPage;
