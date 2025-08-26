import { authOptions } from "@/lib/auth";
import { deleteGoogleCalendarEvent } from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";
import { calculateStreak, isHabitCompleted } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Get one plan
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ learningPlanId: string }> }
) {
  try {
    const { learningPlanId } = await params;

    const plan = await prisma.learningPlan.findUnique({
      where: { id: learningPlanId },
      include: {
        planners: {
          include: {
            tasks: {
              include: {
                checklists: { orderBy: { id: "asc" } },
              },
              orderBy: { dueDate: "asc" },
            },
          },
          orderBy: { week: "asc" },
        },
        habits: {
          include: { completions: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Learning plan not found" },
        { status: 404 }
      );
    }

    // enrich habits
    const enrichedHabits = plan.habits.map((habit) => {
      return {
        ...habit,
        completed: isHabitCompleted(habit),
        streak: habit.streak,
        progress: habit.completions.filter((c) => c.completed).length,
      };
    });

    return NextResponse.json(
      { ...plan, habits: enrichedHabits },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error fetching learning plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch learning plan" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { topic, planner, task_list } = await req.json();

    const plan = await prisma.learningPlan.update({
      where: { id: params.id },
      data: { topic, planner, task_list },
    });

    return NextResponse.json(plan, { status: 200 });
  } catch (error) {
    console.error("❌ Error updating learning plan:", error);
    return NextResponse.json(
      { error: "Failed to update learning plan" },
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const learningPlan = await prisma.learningPlan.findUnique({
      where: { id: params.learningPlanId },
      include: {
        planners: {
          include: {
            tasks: true,
          },
        },
      },
    });
    const googleCalendarEventIds =
  learningPlan?.planners.flatMap((planner) =>
    planner.tasks
      .map((task) => task.googleCalendarEventId)
      .filter((id): id is string => Boolean(id))
  ) ?? [];

    await Promise.all(
      (googleCalendarEventIds ?? []).map((eventId) => {
        return deleteGoogleCalendarEvent({
          accessToken: session.accessToken as string,
          refreshToken: session.refreshToken as string,
          eventId: eventId as string,
        });
      })
    );

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
