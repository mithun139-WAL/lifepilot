import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
// import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const startDate = start ? new Date(start) : new Date(0);
  const endDate = end ? new Date(end) : new Date();

  try {
    const habits = await prisma.habit.findMany({
      include: { completions: true },
    });

    const result = habits.map((habit) => {
      const completions = habit.completions.filter(
        (c) => new Date(c.date) >= startDate && new Date(c.date) <= endDate
      );
      const percentage =
        completions.length > 0
          ? (completions.filter((c) => c.completed).length / completions.length) * 100
          : 0;

      return {
        habitId: habit.id,
        name: habit.name,
        frequency: habit.frequency,
        completionPercentage: percentage,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch habit completion" }, { status: 500 });
  }
}