// src/app/api/habits/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, addDays } from "date-fns";

function getPeriodRange(frequency: "DAILY" | "WEEKLY", date = new Date()) {
  if (frequency === "DAILY") {
    const start = startOfDay(date);
    return { start, end: addDays(start, 1) };
  } else {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    return { start, end: addDays(start, 7) };
  }
}

export async function GET() {
  try {
    const habits = await prisma.habit.findMany({
      include: { completions: true },
    });

    const today = new Date();

    const habitStats = habits.map((habit) => {
      const { start, end } = getPeriodRange(habit.frequency as "DAILY" | "WEEKLY", today);

      const done = habit.completions.some(
        (c) => c.completed && c.date >= start && c.date < end
      );

      return {
        id: habit.id,
        name: habit.description,
        frequency: habit.frequency,
        done,
        streak: habit.streak,
        progress: habit.progress,
      };
    });

    return NextResponse.json(habitStats);
  } catch (err) {
    console.error("❌ Error fetching habit stats:", err);
    return NextResponse.json({ error: "Failed to fetch habit stats" }, { status: 500 });
  }
}