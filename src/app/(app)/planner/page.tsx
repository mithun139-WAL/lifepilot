"use client";

import React, { useState, useEffect } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskProvider } from "@/context/TaskContext";
import { TaskForm } from "@/components/tasks/TaskForm";
import PlannerLoader from "@/components/common/PlannerLoader";
import { startOfWeek } from "date-fns";
import { Brain, Calendar1, Check, Flame, TrendingUp } from "lucide-react";
import { useLoader } from "@/components/common/Loader";

// Days mapping
const daysOfWeek = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Day 6",
  "Day 7",
];

interface PlannerPageProps {
  planId?: string;
}

function getDateForDayOffset(offset: number) {
  const today = new Date();
  const copy = new Date(today);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

const PlannerPage: React.FC<PlannerPageProps> = ({ planId }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [planDetails, setPlanDetails] = useState<any>(null);
  const [selectedHabitTab, setSelectedHabitTab] = useState<"DAILY" | "WEEKLY">(
    "DAILY"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const { showLoader, hideLoader } = useLoader();

  const fetchPlanDetails = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/learning-plans/${planId}`);
      const data = await response.json();
      setPlanDetails(data);
    } catch (error) {
      console.error("Error fetching plan details:", error);
    } finally {
      setTimeout(() => setLoading(false), 300);
    }
  };

  useEffect(() => {
    if (planId) fetchPlanDetails();
  }, [planId]);

  const toggleHabit = async (habitId: string, date: Date) => {
    const pushDate =
      selectedHabitTab === "DAILY"
        ? date.toISOString()
        : startOfWeek(date, { weekStartsOn: 1 }).toISOString();
    // 1. Optimistic UI update
    setPlanDetails((prev: any) => {
      if (!prev) return prev;

      return {
        ...prev,
        habits: prev.habits.map((h: any) => {
          if (h.id !== habitId) return h;

          const completions = h.completions ? [...h.completions] : [];
          const existingIndex = completions.findIndex(
            (c: any) =>
              new Date(c.date).toDateString() ===
              new Date(pushDate).toDateString()
          );

          if (existingIndex !== -1) {
            completions[existingIndex] = {
              ...completions[existingIndex],
              completed: !completions[existingIndex].completed,
            };
          } else {
            completions.push({ date: pushDate, completed: true });
          }

          return { ...h, completions };
        }),
      };
    });

    // 2. Backend sync
    showLoader();
    try {
      const res = await fetch(
        `/api/learning-plans/${planId}/habits/${habitId}/toggle`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        }
      );

      if (!res.ok) {
        console.error("Failed to toggle habit");
      } else {
        const { habit } = await res.json();
        setPlanDetails((prev: any) => {
          if (!prev) return prev;
          const updated = { ...prev };
          const index = updated.habits.findIndex((h: any) => h.id === habit.id);
          if (index !== -1) {
            updated.habits[index] = habit;
          }
          return updated;
        });
        fetchPlanDetails();
      }
    } catch (err) {
      console.error("Error toggling habit:", err);
    } finally {
      setTimeout(hideLoader, 500);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-start justify-center h-screen mt-50">
          <PlannerLoader />
        </div>
      ) : (
        planDetails?.planners?.map((plan: any) => (
          <div
            key={plan.id}
            className="bg-white/10 border border-blue-500/30 rounded-lg p-4 shadow hover:shadow-lg transition"
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-white mb-3">
                  Week {plan?.week} – {plan?.title}
                </h3>
                <p className="text-gray-300 text-sm">{plan?.description}</p>
              </div>

              <button
                onClick={() => {
                  setSelectedWeek(
                    selectedWeek === plan.week ? null : plan.week
                  );
                  setSelectedDay(0);
                }}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {selectedWeek === plan.week ? "Close" : "View Tasks"}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full"
                style={{ width: `${plan.progress}%` }}
              />
            </div>

            {/* Expanded Week Details */}
            {selectedWeek === plan.week && (
              <div className="mt-6">
                {/* Day Tabs */}
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {daysOfWeek.map((day, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(idx)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        selectedDay === idx
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                {/* Tasks */}
                <h4 className="text-lg font-semibold text-white mt-4 mb-2 ms-4 flex items-center gap-1">
                  <Calendar1 size={18} /> {daysOfWeek[selectedDay]} Tasks
                </h4>
                <div className="space-y-3">
                  {plan.tasks &&
                  plan.tasks.length > 0 &&
                  plan.tasks[selectedDay] ? (
                    <TaskProvider>
                      <TaskList
                        existingTasks={[plan.tasks[selectedDay]]}
                        refreshPlan={fetchPlanDetails}
                      />
                    </TaskProvider>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      No tasks for {daysOfWeek[selectedDay]}.
                    </p>
                  )}
                </div>

                {/* Habits */}

                {/* Habit Tabs */}
                <div className="flex space-x-2 mb-3 mt-6">
                  {["DAILY", "WEEKLY"].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setSelectedHabitTab(type as "DAILY" | "WEEKLY")
                      }
                      className={`px-3 py-1 rounded-lg text-sm ${
                        selectedHabitTab === type
                          ? "bg-blue-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {type === "DAILY" ? "Daily" : "Weekly"}
                    </button>
                  ))}
                </div>

                <h4 className="text-lg font-semibold text-white mt-2 mb-2 ms-4 flex items-center gap-1">
                  <Brain size={18} /> Habits
                </h4>

                {/* Habit List */}
                <div className="space-y-2">
                  {planDetails?.habits
                    ?.filter(
                      (habit: any) => habit.frequency === selectedHabitTab
                    )
                    .map((habit: any) => {
                      const dayDate = getDateForDayOffset(selectedDay);
                      const weekStart = startOfWeek(dayDate, {
                        weekStartsOn: 1,
                      });
                      const isCompleted =
                        habit.frequency === "DAILY"
                          ? habit.completions?.some(
                              (c: any) =>
                                new Date(c.date).toDateString() ===
                                  dayDate.toDateString() && c.completed
                            )
                          : habit.completions?.some(
                              (c: any) =>
                                new Date(c.date).toDateString() ===
                                  weekStart.toDateString() && c.completed
                            );

                      return (
                        <div
                          key={habit.id}
                          className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-lg border border-gray-700"
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleHabit(habit.id, dayDate)}
                            className={`w-5 h-5 rounded-full flex items-center justify-center border cursor-pointer ${
                              isCompleted
                                ? "bg-green-600 border-green-600"
                                : "border-gray-400"
                            }`}
                          >
                            {isCompleted && (
                              <span className="text-white text-xs">
                                <Check size={14} />
                              </span>
                            )}
                          </button>

                          {/* Title */}
                          <div className="flex-1 ml-3">
                            <p
                              className={`text-white text-sm ${
                                isCompleted ? "line-through text-gray-400" : ""
                              }`}
                            >
                              {habit.description} -
                              <span className="text-xs text-cyan-400 capitalize ms-2">
                                {habit.frequency}
                              </span>
                            </p>
                          </div>

                          {/* Streak + Progress */}
                          <div className="text-xs text-gray-400 text-right">
                            <div className="flex items-center gap-2">
                              <Flame />
                              <span className="w-5 text-cyan-400">
                                {" "}
                                {habit.streak || 0}
                              </span>{" "}
                              <br />
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <TrendingUp />{" "}
                              <span className="w-5 text-cyan-400">
                                {habit.progress}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        ))
      )}
      <TaskProvider>
        <TaskForm />
      </TaskProvider>
    </div>
  );
};

export default PlannerPage;
