// context/HabitContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export type Habit = {
  id: string;
  name: string;
  color: string;
  progress: number[]; // progress for each day of the current month
};

const predefinedColors = [
  "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E",
  "#F97316", "#F59E0B", "#10B981", "#06B6D4", "#0EA5E9",
];

const defaultHabits: Habit[] = [
  { id: uuidv4(), name: "Drink Water", color: predefinedColors[0], progress: [] },
  { id: uuidv4(), name: "Walk 6,000 Steps", color: predefinedColors[1], progress: [] },
  { id: uuidv4(), name: "Exercise", color: predefinedColors[2], progress: [] },
  { id: uuidv4(), name: "Read", color: predefinedColors[3], progress: [] },
  { id: uuidv4(), name: "Sleep by 11 PM", color: predefinedColors[4], progress: [] },
];

const HabitContext = createContext<{
  habits: Habit[];
  addHabit: (name: string) => void;
  deleteHabit: (id: string) => void;
  editHabit: (id: string, newName: string) => void;
  updateProgress: (id: string, day: number, value: number) => void;
}>({
  habits: [],
  addHabit: () => {},
  deleteHabit: () => {},
  editHabit: () => {},
  updateProgress: () => {},
});

export const HabitProvider = ({ children }: { children: React.ReactNode }) => {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("lifepilot_habits");
  
    try {
      const parsed = stored ? JSON.parse(stored) : null;
  
      if (Array.isArray(parsed) && parsed.length > 0) {
        setHabits(parsed);
      } else {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
        const initialized = defaultHabits.map((h) => ({
          ...h,
          progress: Array(daysInMonth).fill(0),
        }));
  
        setHabits(initialized);
        localStorage.setItem("lifepilot_habits", JSON.stringify(initialized));
      }
    } catch (err) {
      console.error("Failed to parse habits:", err);
      setHabits([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lifepilot_habits", JSON.stringify(habits));
  }, [habits]);

  const addHabit = (name: string) => {
    if (habits.length >= 10) return;
    const color = predefinedColors[habits.length % predefinedColors.length];
    const daysInMonth = new Date().getDate();
    const newHabit: Habit = {
      id: uuidv4(),
      name,
      color,
      progress: Array(daysInMonth).fill(0),
    };
    setHabits([newHabit, ...habits]);
  };

  const deleteHabit = (id: string) => {
    setHabits(habits.filter((h) => h.id !== id));
  };

  const editHabit = (id: string, newName: string) => {
    setHabits(
      habits.map((h) => (h.id === id ? { ...h, name: newName } : h))
    );
  };

  const updateProgress = (id: string, day: number, value: number) => {
    setHabits(
      habits.map((h) => {
        if (h.id === id) {
          const updated = [...h.progress];
          updated[day] = value;
          return { ...h, progress: updated };
        }
        return h;
      })
    );
  };

  return (
    <HabitContext.Provider
      value={{ habits, addHabit, deleteHabit, editHabit, updateProgress }}
    >
      {children}
    </HabitContext.Provider>
  );
};

export const useHabits = () => useContext(HabitContext);