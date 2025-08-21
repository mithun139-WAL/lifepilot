import { HabitFrequency } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: { learningPlanId: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const { learningPlanId } = await context.params;
        const { name, description, frequency } = await req.json();

        if (!learningPlanId || !name || !frequency) {
            return NextResponse.json({ success: false, error: "learningPlanId, name and frequency are required." }, { status: 400 });
        }
        if (!Object.values(HabitFrequency).includes(frequency)) {
            return NextResponse.json({ success: false, error: "Invalid frequency value." }, { status: 400 });
        }
        const learningPlan = await prisma.learningPlan.findUnique({ where: { id: learningPlanId, userId: session.user.id } });
        if (!learningPlan) {
            return NextResponse.json({ success: false, error: "Learning plan not found" }, { status: 404 });
        }

        const habit = await prisma.habit.create({
            data: {
                userId: session.user.id,
                learningPlanId,
                name,
                description: description ?? null,
                frequency,
            },
        });

        return NextResponse.json({ success: true, data: habit }, { status: 201 });
    } catch (error) {
        console.error("POST /api/learning-plans/[id]/habits error:", error);
        return NextResponse.json({ success: false, error: "Failed to create habit" }, { status: 500 });
    }
}