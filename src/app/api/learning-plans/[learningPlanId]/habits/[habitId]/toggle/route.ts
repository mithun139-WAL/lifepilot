import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfDay, addDays, startOfWeek, subDays } from "date-fns";

function getPeriodDate(frequency: "DAILY" | "WEEKLY", date = new Date()) {
  return frequency === "DAILY"
    ? startOfDay(date)
    : startOfWeek(date, { weekStartsOn: 1 });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ habitId: string; learningPlanId: string }> }
) {
  try {
    const { habitId } = await context.params;
    const { date } = await req.json();

    const habit = await prisma.habit.findUnique({
      where: { id: habitId },
      include: { completions: true },
    });
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    const targetDate = date ? new Date(date) : new Date(); // 👈 use passed date
    const periodDate = getPeriodDate(habit.frequency, targetDate);

    // safer query with range
    let habitProgress = await prisma.habitProgress.findFirst({
      where: {
        habitId,
        date: {
          gte: periodDate,
          lt: addDays(periodDate, habit.frequency === "DAILY" ? 1 : 7),
        },
      },
    });

    if (habitProgress) {
      habitProgress = await prisma.habitProgress.update({
        where: { id: habitProgress.id },
        data: { completed: !habitProgress.completed, updatedAt: new Date() },
      });
    } else {
      habitProgress = await prisma.habitProgress.create({
        data: { habitId, date: periodDate, completed: true },
      });
    }

    // --- Streak calculation ---
    let streak = habitProgress.completed ? 1 : 0;
    let cursorDate = periodDate;

    while (true) {
      const prevDate =
        habit.frequency === "DAILY"
          ? startOfDay(subDays(cursorDate, 1))
          : startOfWeek(subDays(cursorDate, 7), { weekStartsOn: 1 });

      const prev = await prisma.habitProgress.findFirst({
        where: {
          habitId,
          date: {
            gte: prevDate,
            lt: addDays(prevDate, habit.frequency === "DAILY" ? 1 : 7),
          },
          completed: true,
        },
      });

      if (prev) {
        streak++;
        cursorDate = prevDate;
      } else {
        break;
      }
    }

    // --- Progress ---
    const createdAt = habit.createdAt;
    const now = new Date();
    const periodsSinceCreation =
      habit.frequency === "DAILY"
        ? Math.ceil((now.getTime() - createdAt.getTime()) / 86400000) + 1
        : Math.ceil((now.getTime() - createdAt.getTime()) / (86400000 * 7)) + 1;

    const totalCompletions = await prisma.habitProgress.count({
      where: { habitId, completed: true },
    });

    const progress = Math.min(
      100,
      Math.round((totalCompletions / periodsSinceCreation) * 100)
    );

    const updatedHabit = await prisma.habit.update({
      where: { id: habitId },
      data: { progress, streak, updatedAt: new Date() },
    });

    return NextResponse.json({ habit: updatedHabit, habitProgress });
  } catch (error: any) {
    console.error("❌ Error toggling habit:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}