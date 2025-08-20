"use client";

import React, { useState } from "react";
import { TaskProvider } from "@/context/TaskContext";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm } from "@/components/tasks/TaskForm";

const weeklyPlans = [
  {
    week: 1,
    summary:
      "Familiarize yourself with AWS console, EC2, S3, and IAM basics. Set up a free-tier account.",
    milestone: "AWS Foundations and Console Navigation",
    progress: 40,
    tasks: [
      {
        day: 3,
        title: "IAM Basics – Users, Groups, and Policies",
        dueDate: "2025-08-23",
        description:
          "Create IAM users, groups, and attach policies. Understand least privilege.",
        expectedTime: "2–3 hours",
      },
      {
        day: 4,
        title: "Explore Core Services – EC2, S3, RDS",
        dueDate: "2025-08-24",
        description:
          "Launch EC2 instance, create an S3 bucket, provision RDS instance.",
        expectedTime: "2–3 hours",
      },
      {
        day: 5,
        title: "Hands-on Lab: Deploy a Static Website",
        dueDate: "2025-08-25",
        description:
          "Host a simple HTML page in S3, configure bucket policy for public access.",
        expectedTime: "2–3 hours",
      },
      {
        day: 6,
        title: "S3 Practice",
        dueDate: "2025-08-25",
        description:
          "Host a simple HTML page in S3, configure bucket policy for public access.",
        expectedTime: "2–3 hours",
      },
    ],
  },
  {
    week: 2,
    summary:
      "Deepen your understanding of AWS services and start building real-world applications.",
    milestone: "AWS Services Deep Dive",
    progress: 20,
    tasks: [
      {
        day: 0,
        title: "Kubernetes practice",
        dueDate: "2025-08-23",
        description:
          "Kubernetes basics: Pods, Deployments, and Services.",
        expectedTime: "2–3 hours",
      },
      {
        day: 1,
        title: "Node creation",
        dueDate: "2025-08-24",
        description:
          "Node basics: Creation, scaling, and management.",
        expectedTime: "2–3 hours",
      },
      {
        day: 2,
        title: "Service Creation",
        dueDate: "2025-08-25",
        description:
          "Create and manage services in Kubernetes.",
        expectedTime: "2–3 hours",
      },
      {
        day: 3,
        title: "Kubernetes Networking",
        dueDate: "2025-08-25",
        description:
          "Understand Kubernetes networking concepts: Services, Ingress, and Network Policies.",
        expectedTime: "2–3 hours",
      },
    ],
  },
];

const habits = [
  {
    title: "Read a Daily AWS Blog Post",
    frequency: "daily",
    description:
      "Spend 15 min reading AWS blog, service updates, or docs snippet.",
  },
  {
    title: "Hands-On Lab",
    frequency: "daily",
    description: "Experiment with AWS console features daily.",
  },
  {
    title: "Weekly AWS Quiz",
    frequency: "weekly",
    description: "Test yourself with a quiz or flashcards.",
  },
];

// Days mapping
const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
interface PlannerPageProps {
  plans?: any; // Adjust type as needed
  planId?: string;
}
const PlannerPage: React.FC<PlannerPageProps> = ({ plans, planId }) => {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0=Sunday
  console.log('planner details', plans?.planner);
  console.log('task list', plans?.task_list);
  console.log('habits_list', plans?.habits_list);
  return (
    <div className="space-y-4">
      {weeklyPlans.map((plan) => (
        <div
          key={plan.week}
          className="bg-white/10 border border-blue-500/30 rounded-lg p-4 shadow hover:shadow-lg transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Week {plan.week} – {plan.milestone}
              </h3>
              <p className="text-gray-300 text-sm">{plan.summary}</p>
            </div>

            <button
              onClick={() =>
                setSelectedWeek(
                  selectedWeek === plan.week ? null : plan.week
                )
              }
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {selectedWeek === plan.week ? "Close" : "View"}
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
                    className={`px-3 py-1 rounded-lg text-sm ${selectedDay === idx
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Tasks for Selected Day */}
              <h4 className="text-lg font-semibold text-white mt-4 mb-2">
                📅 {daysOfWeek[selectedDay]} Tasks
              </h4>
              <div className="space-y-3">
                {plan.tasks.filter((task) => task.day === selectedDay).length > 0 ? (
                  <TaskProvider>
                    <TaskList tasks={plan.tasks.filter((task) => task.day === selectedDay)} />
                    {/* <TaskForm /> */}
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
                {habits.map((habit, idx) => (
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
      ))}
    </div>

  );
};

export default PlannerPage;
