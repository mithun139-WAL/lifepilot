"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";

interface TaskItem {
  id: string;
  title: string;
  preferredTime: string;
  status: string;
  learningPlanTitle?: string;
}

export function TodayTimeline() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks/today?userId=${userId}`);
      const data = await res.json();
      console.log("Today's tasks:", data);
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error("Error fetching today's tasks:", err);
      setTasks([]);
    }
  };
  useEffect(() => {
    if (!userId) return;

    fetchTasks();
  }, [userId]);

  const now = new Date();

  // Split tasks into Left / Right sections
  const { leftTasks, rightTasks } = useMemo(() => {
    const left: TaskItem[] = [];
    const right: TaskItem[] = [];

    tasks.forEach((task) => {
      const taskTime = new Date(task.preferredTime);
      if (task.status === "COMPLETED") return;

      if (taskTime > now) {
        left.push(task);
      } else {
        right.push(task);
      }
    });

    return {
      leftTasks: left.slice(0, 5),
      rightTasks: right.slice(0, 5),
    };
  }, [tasks, now]);

  return (
    <div className="w-full backdrop-blur-md rounded-2xl border border-blue-500/20 p-4 shadow-inner text-white">
      <h3 className="text-white font-semibold mb-4 text-lg">
        Today&apos;s Focus
      </h3>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Section */}
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-blue-500/20">
          <h4 className="text-blue-300 font-medium mb-2">Upcoming Tasks</h4>
          {leftTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No upcoming tasks 🎉</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {leftTasks.map((task) => (
                <li key={task.id} className="flex justify-between">
                  <span>{task.title} - {task.learningPlanTitle}</span>
                  <span className="text-cyan-400 font-mono w-20 text-right">
                    {format(new Date(task.preferredTime), "hh:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right Section */}
        <div className="flex-1 bg-white/5 p-3 rounded-xl border border-blue-500/20">
          <h4 className="text-pink-300 font-medium mb-2">Pending Tasks</h4>
          {rightTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No pending past tasks ✅</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-300">
              {rightTasks.map((task) => (
                <li key={task.id} className="flex justify-between">
                  <span>{task.title} - {task.learningPlanTitle}</span>
                  <span className="text-pink-200 font-mono">
                    {format(new Date(task.preferredTime), "hh:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
