// app/api/goals/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const goals = await prisma.goal.findMany({
      where: { userId: session.user.id },
      include: {
        learningPlan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: goals });
  } catch (error) {
    console.error("GET /api/goals error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, hoursPerDay, targetWeeks, preferredTime } = body;

    if (!title || !hoursPerDay || !targetWeeks || !preferredTime) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const goal = await prisma.goal.create({
      data: {
        title,
        hoursPerDay,
        targetWeeks,
        preferredTime,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true, data: goal });
  } catch (error) {
    console.error("POST /api/goals error:", error);
    return NextResponse.json({ success: false, error: "Failed to create goal" }, { status: 500 });
  }
}