import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPeriodDate(
  frequency: "DAILY" | "WEEKLY",
  date = new Date()
) {
  return frequency === "DAILY"
    ? startOfDay(date)
    : startOfWeek(date, { weekStartsOn: 1 }); // Monday start
}


// Check if a habit is completed for today/this week
export function isHabitCompleted(habit: any) {
  const now = new Date();

  if (habit.frequency === "DAILY") {
    return habit.completions.some(
      (c: any) =>
        c.completed &&
        c.date >= startOfDay(now) &&
        c.date <= endOfDay(now)
    );
  }

  if (habit.frequency === "WEEKLY") {
    return habit.completions.some(
      (c: any) =>
        c.completed &&
        c.date >= startOfWeek(now, { weekStartsOn: 1 }) &&
        c.date <= endOfWeek(now, { weekStartsOn: 1 })
    );
  }

  return false;
}

export function calculateStreak(habit: any) {
  let streak = 0;
  const sorted = habit.completions
    .filter((c: any) => c.completed)
    .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());

  let cursor = new Date();
  for (const c of sorted) {
    const d = new Date(c.date);
    if (habit.frequency === "DAILY") {
      const diffDays = Math.floor((cursor.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0 || diffDays === 1) {
        streak++;
        cursor = d;
      } else break;
    }
    if (habit.frequency === "WEEKLY") {
      const diffWeeks = Math.floor((cursor.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 7));
      if (diffWeeks === 0 || diffWeeks === 1) {
        streak++;
        cursor = d;
      } else break;
    }
  }
  return streak;
}