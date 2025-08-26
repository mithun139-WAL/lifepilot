import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        learningPlan: {
          include: {
            planners: true,
          },
        },
      },
    });

    const result = goals.map((goal) => {
      const totalHours = goal.learningPlan
        .flatMap((lp) => lp.planners)
        .reduce((sum, p) => sum + Number(goal.hoursPerDay || 0), 0);

      return {
        goalId: goal.id,
        title: goal.title,
        totalHours,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch learning hours" }, { status: 500 });
  }
}