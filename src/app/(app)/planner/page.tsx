"use client";

import React, { useState, useEffect } from "react";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskProvider } from "@/context/TaskContext";
import { TaskForm } from "@/components/tasks/TaskForm";
// import { Ta } from "zod/v4/locales";
import PlannerLoader from "@/components/common/PlannerLoader";

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
const PlannerPage: React.FC<PlannerPageProps> = ({ planId }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [planDetails, setPlanDetails] = useState<any>(null);
  // const [createTaskOpen, setCreateTaskOpen] = useState<boolean>(false);

  // const { setOpenEditPopup } = useTasks();
  const [loading, setLoading] = useState<boolean>(false);

  const fetchPlanDetails = async () => {
    if (!planId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/learning-plans/${planId}`);
      const data = await response.json();
      console.log("Fetched plan details in Planner page:", data);
      setPlanDetails(data);
    } catch (error) {
      console.error("Error fetching plan details:", error);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  useEffect(() => {
    if (planId) fetchPlanDetails();
  }, [planId]);

  return (
    <div className="space-y-4">
      {loading ? (
        <PlannerLoader />
      ) : (
        planDetails?.planners?.map((plan: any) => (
          <div
            key={plan.id}
            className="bg-white/10 border border-blue-500/30 rounded-lg p-4 shadow hover:shadow-lg transition"
          >
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
              ></div>
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

                {/* Tasks for Selected Day */}
                {/* Tasks for Selected Day */}
                <div>
                  <h4 className="text-lg font-semibold text-white mt-4 mb-2">
                    📅 {daysOfWeek[selectedDay]} Tasks
                  </h4>
                </div>
                <div className="space-y-3">
                  {plan.tasks &&
                  plan.tasks.length > 0 &&
                  plan.tasks[selectedDay] ? (
                    <TaskProvider>
                      <TaskList existingTasks={[plan.tasks[selectedDay]]} />
                    </TaskProvider>
                  ) : (
                    <p className="text-gray-400 text-sm">
                      No tasks for {daysOfWeek[selectedDay]}.
                    </p>
                  )}
                </div>

                {/* Habits */}
                <h4 className="text-lg font-semibold text-white mt-6 mb-2">
                  🧠 Habits
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {planDetails?.habits?.map((habit: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <p className="text-white font-medium">
                        {habit.title}{" "}
                        <span className="text-xs text-blue-400">
                          ({habit.frequency})
                        </span>
                      </p>
                      <p className="text-sm text-gray-300">
                        {habit.description}
                      </p>
                    </div>
                  ))}
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
