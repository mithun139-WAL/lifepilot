import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      include: { learningPlan: { include: { planners: true } } },
    });

    const result = goals.map((goal) => {
      const planners = goal.learningPlan.flatMap((lp) => lp.planners);
      const avgProgress =
        planners.length > 0
          ? planners.reduce((sum, p) => sum + p.progress, 0) / planners.length
          : 0;

      return {
        goalId: goal.id,
        title: goal.title,
        averageProgress: Math.round(avgProgress),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch goals progress" }, { status: 500 });
  }
}