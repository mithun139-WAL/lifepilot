"use client";

/**
 * src/app/(app)/settings/page.tsx
 *
 * Settings page — three sections:
 *   1. Goals          — list + delete (with cascade warning)
 *   2. Learning Plans — list + delete + generate plan for orphan goals
 *   3. Knowledge Base — delegated to <KnowledgeManager />
 *
 * Design system: surface-1 / surface-2 / glow-* tokens from globals.css.
 * All mutations give immediate optimistic feedback via state updates +
 * toast notifications — no window.location.href reloads.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Target,
  BookOpen,
  Database,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { KnowledgeManager } from "@/components/dashboard/KnowledgeManager";
import { apiClient } from "@/lib/apiClient";
import { startPlannerJob } from "@/lib/plannerJob";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
}

interface LearningPlan {
  id: string;
  topic: string;
  goal_id: string;
}

type Tab = "goals" | "learningPlans" | "knowledge";

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Tab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "goals",         label: "Goals",          Icon: Target   },
  { id: "learningPlans", label: "Learning Plans",  Icon: BookOpen },
  { id: "knowledge",     label: "Knowledge Base",  Icon: Database },
];

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return <div className="h-[52px] rounded-xl bg-white/[0.04] animate-pulse" />;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <AlertCircle className="w-8 h-8 text-white/15" />
      <p className="text-sm text-white/35">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>("goals");

  // Data
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);

  // Loading states (per-section, not full-page)
  const [goalsLoading, setGoalsLoading]   = useState(true);
  const [plansLoading, setPlansLoading]   = useState(true);

  // Plan generation
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [generating, setGenerating]         = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string>("");

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const data = await apiClient.get<{ data: Goal[] }>("/goals");
      setGoals(data?.data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load goals");
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  const fetchLearningPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const data = await apiClient.get<LearningPlan[]>("/learning-plans");
      setLearningPlans(data ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load learning plans");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
    fetchLearningPlans();
  }, [fetchGoals, fetchLearningPlans]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const deleteGoal = async (id: string) => {
    try {
      await apiClient.delete(`/goals/${id}`);
      // Optimistic update — remove goal + its associated plan from state
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setLearningPlans((prev) => prev.filter((lp) => lp.goal_id !== id));
      toast.success("Goal deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete goal";
      toast.error(msg);
    }
  };

  const deletePlan = async (id: string) => {
    try {
      await apiClient.delete(`/learning-plans/${id}`);
      setLearningPlans((prev) => prev.filter((lp) => lp.id !== id));
      toast.success("Learning plan deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete plan";
      toast.error(msg);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedGoalId || generating) return;
    setGenerating(true);
    setGenerateStatus("Queuing plan generation…");
    try {
      await startPlannerJob(selectedGoalId, setGenerateStatus);
      toast.success("Plan generated successfully!");
      setSelectedGoalId("");
      // Refresh plans list to show the new plan
      await fetchLearningPlans();
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate plan";
      toast.error(msg);
    } finally {
      setGenerating(false);
      setGenerateStatus("");
    }
  };

  // Goals that don't yet have a plan
  const orphanGoals = goals.filter(
    (g) => !learningPlans.some((lp) => lp.goal_id === g.id),
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-white/40 mt-1">
          Manage your goals, learning plans, and knowledge sources
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar nav ──────────────────────────────────────────────── */}
        <aside className="w-48 shrink-0">
          <nav className="surface-1 p-2 space-y-0.5">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-150 text-left
                    ${active
                      ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                      : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-violet-400" : ""}`} />
                  <span>{label}</span>
                  {active && (
                    <ChevronRight className="w-3 h-3 ml-auto text-violet-400/70" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* ── Goals tab ──────────────────────────────────────────────── */}
          {activeTab === "goals" && (
            <section className="surface-1 p-6">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-white">Your Goals</h2>
                <p className="text-xs text-white/35 mt-0.5">
                  {goalsLoading
                    ? "Loading…"
                    : `${goals.length} goal${goals.length !== 1 ? "s" : ""} · deleting a goal also removes its plan`}
                </p>
              </div>

              {goalsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => <SkeletonRow key={n} />)}
                </div>
              ) : goals.length === 0 ? (
                <EmptyState message="No goals yet. Add a goal from the sidebar." />
              ) : (
                <div className="space-y-2">
                  {goals.map((goal) => {
                    const hasPlan = learningPlans.some((lp) => lp.goal_id === goal.id);
                    return (
                      <div
                        key={goal.id}
                        className="group flex items-center justify-between px-4 py-3.5 surface-2 rounded-xl"
                      >
                        {/* Status dot + title */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              hasPlan ? "bg-emerald-400" : "bg-amber-400/70"
                            }`}
                            title={hasPlan ? "Has learning plan" : "No plan yet"}
                          />
                          <span className="text-sm text-white/75 truncate">
                            {goal.title}
                          </span>
                          {hasPlan && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Plan active
                            </span>
                          )}
                        </div>

                        {/* Delete — hover-reveal */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="
                                p-1.5 rounded-lg transition-all duration-150
                                text-white/20 hover:text-red-400 hover:bg-red-400/10
                                opacity-0 group-hover:opacity-100 focus:opacity-100
                              "
                              aria-label={`Delete goal: ${goal.title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-[#0d0a1a]/95 border border-white/[0.08] backdrop-blur-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">
                                Delete goal?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-white/50">
                                Deleting{" "}
                                <span className="text-white/80 font-medium">
                                  &ldquo;{goal.title}&rdquo;
                                </span>{" "}
                                will also remove its learning plan, tasks, and habits.
                                This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteGoal(goal.id)}
                                className="bg-red-500/20 border border-red-500/25 text-red-400 hover:bg-red-500/30"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Learning Plans tab ─────────────────────────────────────── */}
          {activeTab === "learningPlans" && (
            <div className="space-y-5">
              {/* Plans list */}
              <section className="surface-1 p-6">
                <div className="mb-6">
                  <h2 className="text-base font-semibold text-white">Your Learning Plans</h2>
                  <p className="text-xs text-white/35 mt-0.5">
                    {plansLoading
                      ? "Loading…"
                      : `${learningPlans.length} plan${learningPlans.length !== 1 ? "s" : ""}`}
                  </p>
                </div>

                {plansLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((n) => <SkeletonRow key={n} />)}
                  </div>
                ) : learningPlans.length === 0 ? (
                  <EmptyState message="No learning plans yet. Generate one below." />
                ) : (
                  <div className="space-y-2">
                    {learningPlans.map((plan) => {
                      const goalTitle = goals.find((g) => g.id === plan.goal_id)?.title;
                      return (
                        <div
                          key={plan.id}
                          className="group flex items-center justify-between px-4 py-3.5 surface-2 rounded-xl"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BookOpen className="w-4 h-4 text-violet-400/70 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-white/75 truncate">{plan.topic}</p>
                              {goalTitle && (
                                <p className="text-[11px] text-white/30 truncate">
                                  Goal: {goalTitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button
                                className="
                                  p-1.5 rounded-lg transition-all duration-150
                                  text-white/20 hover:text-red-400 hover:bg-red-400/10
                                  opacity-0 group-hover:opacity-100 focus:opacity-100
                                "
                                aria-label={`Delete plan: ${plan.topic}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#0d0a1a]/95 border border-white/[0.08] backdrop-blur-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">
                                  Delete learning plan?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-white/50">
                                  Deleting{" "}
                                  <span className="text-white/80 font-medium">
                                    &ldquo;{plan.topic}&rdquo;
                                  </span>{" "}
                                  will remove all associated tasks and habits. This
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-white/5 border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePlan(plan.id)}
                                  className="bg-red-500/20 border border-red-500/25 text-red-400 hover:bg-red-500/30"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Generate plan for orphan goal */}
              {orphanGoals.length > 0 && (
                <section className="surface-1 p-6">
                  <div className="flex items-center gap-2.5 mb-1">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h2 className="text-base font-semibold text-white">Generate a New Plan</h2>
                  </div>
                  <p className="text-xs text-white/35 mb-5">
                    Select a goal that doesn&rsquo;t have a plan yet to generate one with AI.
                  </p>

                  <Select
                    value={selectedGoalId}
                    onValueChange={setSelectedGoalId}
                    disabled={generating}
                  >
                    <SelectTrigger className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/70 mb-3 focus:ring-violet-500/30">
                      <SelectValue placeholder="Select a goal…" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0d0a1a] border border-white/[0.08] text-white backdrop-blur-xl">
                      {orphanGoals.map((g) => (
                        <SelectItem
                          key={g.id}
                          value={g.id}
                          className="focus:bg-violet-500/20 focus:text-violet-200"
                        >
                          {g.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Progress indicator — only shown during generation */}
                  {generating && generateStatus && (
                    <div className="flex items-center gap-2.5 text-sm text-violet-300/90 bg-violet-500/[0.08] border border-violet-500/20 rounded-xl px-4 py-3 mb-3">
                      <Loader2 className="w-4 h-4 animate-spin shrink-0 text-violet-400" />
                      <span className="text-xs">{generateStatus}</span>
                    </div>
                  )}

                  <button
                    onClick={handleGeneratePlan}
                    disabled={!selectedGoalId || generating}
                    className="
                      w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                      bg-violet-500/[0.15] border border-violet-500/25 text-violet-300
                      hover:bg-violet-500/25 hover:border-violet-400/40
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-150 text-sm font-medium
                    "
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating plan…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Plan
                      </>
                    )}
                  </button>
                </section>
              )}
            </div>
          )}

          {/* ── Knowledge Base tab ─────────────────────────────────────── */}
          {activeTab === "knowledge" && (
            <KnowledgeManager />
          )}
        </main>
      </div>
    </div>
  );
}
