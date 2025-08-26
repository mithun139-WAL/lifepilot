import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HabitFrequency } from "@/generated/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(req: NextRequest, context: { params: { habitId: string, learningPlanId: string } }) {
  try {
    const { habitId, learningPlanId } = await context.params;
    if (!habitId || !learningPlanId) {
      return NextResponse.json({ success: false, error: "habitId and learningPlanId are required" }, { status: 400 });
    }

    const habit = await prisma.habit.findUnique({ where: { id: habitId, learningPlanId } });

    if (!habit) {
      return NextResponse.json({ success: false, error: "Habit not found" }, { status: 404 });
    }

    await prisma.habit.delete({ where: { id: habit.id } });

    return NextResponse.json({ success: true, data: { id: habitId } }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: "An unknown error occurred" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: { habitId: string, learningPlanId: string } }) {
  try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const { habitId, learningPlanId } = context.params;
        const { name, description, frequency } = await req.json();
        if (!habitId || !learningPlanId || !name || !frequency) {
            return NextResponse.json({ success: false, error: "habitId, learningPlanId, name and frequency are required." }, { status: 400 });
        }
        if (!Object.values(HabitFrequency).includes(frequency)) {
            return NextResponse.json({ success: false, error: "Invalid frequency value." }, { status: 400 });
        }
        const learningPlan = await prisma.learningPlan.findUnique({ where: { id: learningPlanId, userId: session.user.id } });
        if (!learningPlan) {
            return NextResponse.json({ success: false, error: "Learning plan not found" }, { status: 404 });
        }

        const habit = await prisma.habit.findUnique({ where: { id: habitId, learningPlanId } });

        if (!habit) {
            return NextResponse.json({ success: false, error: "Habit not found" }, { status: 404 });
        }
        const updatedHabit = await prisma.habit.update({
            where: { id: habit.id },
            data: {
                name,
                description: description ?? null,
                frequency,
            }
        })
        return new Response(JSON.stringify(updatedHabit), { status: 200 });
    } catch (error) {
        console.error("❌ Error updating habit:", error);
        return new Response(JSON.stringify({ error: "Failed to update habit" }), { status: 500 });
    }
}