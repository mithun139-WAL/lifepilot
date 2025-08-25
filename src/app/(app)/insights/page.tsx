"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { startOfDay, format } from "date-fns";
import PlannerLoader from "@/components/common/PlannerLoader";

// Neon card style
const cardStyle = `bg-white/5 backdrop-blur-md border border-white/20 rounded-xl p-4 flex flex-col shadow-lg`;

const InsightsPage: React.FC = () => {
  const [learningData, setLearningData] = useState<any[]>([]);
  const [habitData, setHabitData] = useState<any[]>([]);
  const [goalData, setGoalData] = useState<any[]>([]);
  const [taskData, setTaskData] = useState<any>({ completed: 0, pending: 0 });
  const [moodData, setMoodData] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("7d"); // 7d, 30d, 90d
  const [loading, setLoading] = useState<boolean>(true);

  // Helper to compute start date based on filter
  const getStartDate = () => {
    const now = new Date();
    switch (filter) {
      case "7d":
        return new Date(now.setDate(now.getDate() - 7)).toISOString();
      case "30d":
        return new Date(now.setDate(now.getDate() - 30)).toISOString();
      case "90d":
        return new Date(now.setDate(now.getDate() - 90)).toISOString();
      default:
        return new Date(0).toISOString();
    }
  };

  const fetchInsights = async () => {
    setLoading(true);
    const start = getStartDate();
    const [learning, habits, goals, tasks, moods] = await Promise.all([
      fetch("/api/insights/learning-hours").then((res) => res.json()),
      fetch(`/api/insights/habit-completion?start=${start}`).then((res) =>
        res.json()
      ),
      fetch("/api/insights/goals-progress").then((res) => res.json()),
      fetch(`/api/insights/task-stats?start=${start}`).then((res) =>
        res.json()
      ),
      fetch(`/api/insights/mood-trends?start=${start}`).then((res) =>
        res.json()
      ),
    ]);

    setLearningData(learning);
    setHabitData(habits);
    setGoalData(goals);
    setTaskData(tasks);
    // Transform moods into array of {date, count}
    const moodChartData = Object.entries(moods).map(([date, moods]: any) => ({
      date: format(new Date(date), "dd MMM"),
      happy: moods.filter((m: string) => m === "happy").length,
      sad: moods.filter((m: string) => m === "sad").length,
      neutral: moods.filter((m: string) => m === "neutral").length,
    }));
    setMoodData(moodChartData);
    setLoading(false);
  };

  // SSE for live updates
  useEffect(() => {
    const eventSource = new EventSource("/api/insights/sse");

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // Live updates: habits and tasks
      if (data.habits) {
        const habitChart = data.habits.map((habit: any) => {
          const percentage =
            habit.completions.length > 0
              ? (habit.completions.filter((c: any) => c.completed).length /
                  habit.completions.length) *
                100
              : 0;
          return { name: habit.name, completion: Math.round(percentage) };
        });
        setHabitData(habitChart);
      }

      if (data.tasks) {
        const stats = data.tasks.reduce(
          (acc: any, task: any) => {
            if (task.status === "COMPLETED") {
              acc.completed++;
            } else {
              acc.pending++;
            }
            return acc;
          },
          { completed: 0, pending: 0 }
        );
        setTaskData(stats);
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PlannerLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-semibold">Learning Hours</h3>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white/10 text-white rounded px-2 py-1"
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={learningData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="title"
                stroke="white"
                tick={false}
                axisLine={false}
              />
              <YAxis stroke="white" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "none",
                }}
                labelFormatter={(label) => `Topic: ${label}`}
              />

              <Legend verticalAlign="top" align="right" />

              <Bar dataKey="totalHours" fill="#0ff" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-semibold">Habit Completion %</h3>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white/10 text-white rounded px-2 py-1"
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={habitData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />

              <XAxis
                dataKey="name"
                stroke="white"
                tick={false}
                axisLine={false}
              />

              <YAxis stroke="white" />

              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "none",
                }}
                labelFormatter={(label) => `Habit: ${label}`}
              />

              <Legend verticalAlign="top" align="right" />

              <Line
                type="monotone"
                dataKey="completion"
                stroke="#0ff"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={cardStyle}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-semibold">Goals Progress %</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/10 text-white rounded px-2 py-1"
          >
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="90d">90d</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={goalData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
            />

            <XAxis
              dataKey="title"
              stroke="white"
              tick={false}
              axisLine={false}
            />

            <YAxis stroke="white" />

            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "none",
              }}
              labelFormatter={(label) => `Goal: ${label}`}
            />

            <Legend verticalAlign="top" align="right" />

            <Bar dataKey="averageProgress" fill="#0ff" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-semibold">Task Stats</h3>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white/10 text-white rounded px-2 py-1"
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: "Completed", value: taskData.completed },
                  { name: "Pending", value: taskData.pending },
                ]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={70}
                fill="#0ff"
                label
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={cardStyle}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-semibold">Mood Trends</h3>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-white/10 text-white rounded px-2 py-1"
            >
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis dataKey="date" stroke="white" />
              <YAxis stroke="white" />
              <Tooltip />
              <Line type="monotone" dataKey="happy" stroke="#0f0" />
              <Line type="monotone" dataKey="sad" stroke="#f00" />
              <Line type="monotone" dataKey="neutral" stroke="#ff0" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
