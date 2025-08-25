import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  context: { params: { taskId: string; checklistId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId, checklistId } = await context.params;
    if (!checklistId || !taskId) {
      return NextResponse.json(
        { success: false, error: "checklistId and taskId are required" },
        { status: 400 }
      );
    }

    const checklist = await prisma.checklist.findUnique({
      where: { id: checklistId, taskId },
    });

    if (!checklist) {
      return NextResponse.json(
        { success: false, error: "Checklist not found" },
        { status: 404 }
      );
    }

    await prisma.checklist.delete({ where: { id: checklist.id } });

    return NextResponse.json(
      { success: true, data: { id: checklistId } },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, error: "An unknown error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: { taskId: string; checklistId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const { taskId, checklistId } = await context.params;
    const { title, status, description, expectedTime } = await req.json();
    if (!taskId || !title) {
      return NextResponse.json(
        { success: false, error: "taskId and title are required." },
        { status: 400 }
      );
    } else if (status && !Object.values(TaskStatus).includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid task status." },
        { status: 400 }
      );
    }

    const checklist = await prisma.checklist.findUnique({
      where: { id: checklistId, taskId },
    });

    if (!checklist) {
      return NextResponse.json(
        { success: false, error: "Checklist not found" },
        { status: 404 }
      );
    }

    const existingTitle = await prisma.checklist.findFirst({
      where: {
        id: { not: checklistId },
        title: { equals: title, mode: "insensitive" },
        taskId,
      },
    });

    if (existingTitle) {
      return NextResponse.json(
        { success: false, error: "checklist with this title already exists." },
        { status: 400 }
      );
    }
    const updatedCheckList = await prisma.checklist.update({
      where: { id: checklist.id },
      data: {
        title,
        status: status ?? TaskStatus.PENDING,
        description: description ?? null,
        expectedTime: expectedTime ?? null,
      },
    });

    const checklists = await prisma.checklist.findMany({
      where: { taskId },
      select: { status: true },
    });

    const allChecklistsCompleted = checklists.every(
      (c) => c.status === TaskStatus.COMPLETED
    );

    let updatedTask;
    if (allChecklistsCompleted) {
      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      });
    } else {
      // If not all complete → set task to IN_PROGRESS (or leave as is)
      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.IN_PROGRESS },
      });
    }
    const tasks = await prisma.task.findMany({
      where: { plannerId: updatedTask.plannerId },
      select: { status: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED
    ).length;

    const progress =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    await prisma.planner.update({
      where: { id: updatedTask.plannerId },
      data: { progress },
    });

    return NextResponse.json(
      {
        success: true,
        checklist: updatedCheckList,
        task: updatedTask,
        progress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error updating checklist:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update checklist" }),
      { status: 500 }
    );
  }
}
