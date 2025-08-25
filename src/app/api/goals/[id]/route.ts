export async function PUT(
  req: Request,
  context: Promise<{ params: { id: string } }>
) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();

    // Optionally, validate body fields here

    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      );
    }
    if (goal.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        title: body.title,
        hoursPerDay: body.hoursPerDay,
        targetWeeks: Number(body.targetWeeks),
        preferredTime: body.preferredTime,
      },
    });

    return NextResponse.json(
      { success: true, data: updatedGoal },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating goal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update goal" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteGoogleCalendarEvent } from "@/lib/googleCalendar";

export async function GET(
  req: Request,
  context: Promise<{ params: { id: string } }>
) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;

    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      );
    }

    // ensure goal belongs to logged in user
    if (goal.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: goal }, { status: 200 });
  } catch (error) {
    console.error("Error fetching goal by ID:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: Promise<{ params: { id: string } }>
) {
  const { params } = await context;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;

    const goal = await prisma.goal.findUnique({ where: { id } });

    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      );
    }

    if (goal.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const learningPlan = await prisma.learningPlan.findMany({
      where: { goalId: id },
      include: {
        planners: {
          include: {
            tasks: true,
          },
        },
      },
    });

    const googleCalendarEventIds = learningPlan.flatMap((plan) =>
      plan.planners.flatMap((planner) =>
        planner.tasks.map((task) => task.googleCalendarEventId)
      )
    );

    await Promise.all(
      googleCalendarEventIds.map((eventId) => {
        return deleteGoogleCalendarEvent({
          accessToken: session.accessToken as string,
          refreshToken: session.refreshToken as string,
          eventId: eventId as string,
        });
      })
    );

    await prisma.goal.delete({ where: { id } });

    return NextResponse.json(
      { success: true, message: "Goal deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting goal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete goal" },
      { status: 500 }
    );
  }
}
