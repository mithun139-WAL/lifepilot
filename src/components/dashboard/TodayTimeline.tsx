"use client";

import { useMemo } from "react";

const todayItems = [
  { time: "09:00 AM", title: "Deep Work: Project Alpha" },
  { time: "11:00 AM", title: "Team Stand-up Meeting" },
  { time: "01:00 PM", title: "Lunch & Rest" },
  { time: "03:00 PM", title: "LifePilot Task Review" },
  { time: "06:00 PM", title: "Workout or Walk" },
  { time: "08:00 PM", title: "Evening Reflection" },
];

const Title = "Today's Plan";

export function TodayTimeline() {
  const upcomingTasks = useMemo(() => {
    const now = new Date();

    // Convert task time string to Date object
    const parsed = todayItems
      .map((item) => {
        const taskTime = new Date();
        const [time, meridian] = item.time.split(" ");
        const [hour, minute] = time.split(":").map(Number);
        const hours24 = hour % 12 + (meridian === "PM" ? 12 : 0);
        taskTime.setHours(hours24, minute, 0, 0);
        return { ...item, date: taskTime };
      })
      .filter(({ date }) => date > now) // Keep only future tasks
      .slice(0, 5); // Only 5 upcoming

    return parsed;
  }, []);

  return (
    <div className="backdrop-blur-md rounded-2xl border border-blue-500/20 p-4 shadow-inner h-50">
      <h3 className="text-white font-semibold mb-4">{Title}</h3>
      {upcomingTasks.length === 0 ? (
        <p className="text-slate-400 text-sm">You’ve completed your tasks for today 🎉</p>
      ) : (
        <ul className="space-y-3">
          {upcomingTasks.map((item, index) => (
            <li key={index} className="text-sm text-slate-300">
              <span className="text-blue-400 font-medium mr-2">{item.time}</span>
              {item.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}