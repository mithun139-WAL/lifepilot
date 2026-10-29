"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

interface StreakHabit {
  id: string;
  description: string;
  streak: number;
}

export function StreakAchievements() {
  const [habits, setHabits] = useState<StreakHabit[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
      const fetchStreaks = async () => {
      try {
        const data = await apiClient.get<StreakHabit[]>("/habits/streaks");
        setHabits(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching streaks:", err);
        setHabits([]);
      }
    };
    fetchStreaks();
  }, []);

  // rotate habits every 5 seconds
  useEffect(() => {
    if (habits.length <= 2) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 2) % habits.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [habits]);

  const visible = habits.slice(index, index + 2);

  return (
    <div className="glass-widget p-4 h-60">
      <h3 className="text-orange-400 font-semibold mb-4">🔥 Streaks</h3>
      <ul className="space-y-3">
        {visible.map((habit) => (
          <li
            key={habit.id}
            className="flex items-center justify-between text-sm text-slate-300"
          >
            <span className="flex gap-2 items-center w-80">
              {habit.description}
            </span>
            <span className="font-bold text-orange-400">{habit.streak}d</span>
          </li>
        ))}
      </ul>
    </div>
  );
}