import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma";


export async function DELETE(req: NextRequest, context: { params: { taskId: string } }) {
  try {
    const { taskId } = await context.params;
    const { plannerId } = await req.json();
    if (!taskId || !plannerId) {
      return NextResponse.json({ success: false, error: "taskId and plannerId are required" }, { status: 400 });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId, plannerId } });

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
    }

    await prisma.task.delete({ where: { id: task.id } });

    return NextResponse.json({ success: true, data: { id: taskId } }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: "An unknown error occurred" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: { taskId: string } }) {
  try {
        const { taskId } = context.params;
        const { plannerId, title, status, description, dueDate, completedAt } = await req.json();
        if (!taskId || !plannerId || !title || !status) {
            return NextResponse.json({ success: false, error: "taskId, plannerId, title and status are required." }, { status: 400 });
        }
        if (!Object.values(TaskStatus).includes(status)) return NextResponse.json({ success: false, error: "Invalid task status." }, { status: 400 });
        if (status === TaskStatus.COMPLETED && !completedAt) return NextResponse.json({ success: false, error: "completedAt is required when status is completed." }, { status: 400 });

        const task = await prisma.task.findUnique({ where: { id: taskId, plannerId } });

        if (!task) {
            return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 });
        }
        const updatedTask = await prisma.task.update({
            where: { id: task.id },
            data: {
                title,
                status,
                description,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                completedAt: status !== TaskStatus.COMPLETED ? null : new Date(completedAt).toISOString(),
            }
        })
    return new Response(JSON.stringify(updatedTask), { status: 200 });
  } catch (error) {
    console.error("❌ Error updating task:", error);
    return new Response(JSON.stringify({ error: "Failed to update task" }), { status: 500 });
  }
}