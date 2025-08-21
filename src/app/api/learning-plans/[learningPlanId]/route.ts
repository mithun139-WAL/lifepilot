import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// Get one plan
export async function GET(
  req: NextRequest,
  context: { params: { learningPlanId: string } }
) {
  try {
    const { learningPlanId } = await context.params;
    const plan = await prisma.learningPlan.findUnique({
      where: { id: learningPlanId },
      include: {
        planners: {
          include: {
            tasks: {
              include: {
                checklists: {
                  orderBy: { id: "asc" },
                },
              },
              orderBy: { dueDate: "asc" },
            },
          },
          orderBy: { week: "asc" },
        },
        habits: true,
      },
    });

    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Learning plan not found" }),
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(plan), { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching learning plan:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch learning plan" }),
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { topic, planner, task_list, habits } = await req.json();

    const plan = await prisma.learningPlan.update({
      where: { id: params.id },
      data: { topic, planner, task_list, habits },
    });

    return new Response(JSON.stringify(plan), { status: 200 });
  } catch (error) {
    console.error("❌ Error updating learning plan:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update learning plan" }),
      { status: 500 }
    );
  }
}

// Delete a plan
export async function DELETE(
  req: NextRequest,
  { params }: { params: { learningPlanId: string } }
) {
  try {
    await prisma.learningPlan.delete({
      where: { id: params.learningPlanId },
    });

    return new Response(
      JSON.stringify({ message: "Learning plan deleted successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error deleting learning plan:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete learning plan" }),
      { status: 500 }
    );
  }
}
