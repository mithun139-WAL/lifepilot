import { TaskStatus } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

// Create a new learning plan
export async function POST(request: Request, context: { params: { taskId: string } }) {
    try {
        const { taskId } = await context.params;
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const { title, status, description, expectedTime } = await request.json();
        if (!taskId || !title) {
            return NextResponse.json({ success: false, error: "taskId and title are required." }, { status: 400 });
        } else if (status && !Object.values(TaskStatus).includes(status)) {
            return NextResponse.json({ success: false, error: "Invalid task status." }, { status: 400 });
        }

        const task = await prisma.task.findUnique({ where: { id: taskId, userId: session.user.id } });
        if (!task) {
            return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
        }

        const existingTitle = await prisma.checklist.findFirst({
            where: {
                title: { equals: title, mode: "insensitive" },
                taskId,
            }
        });

        if (existingTitle) {
            return NextResponse.json({ success: false, error: "checklist with this title already exists." }, { status: 400 });
        }

        const addedChecklist = await prisma.checklist.create({
            data: {
                taskId,
                title,
                status: status ?? TaskStatus.PENDING,
                description: description ?? null,
                expectedTime: expectedTime ?? null,
            }
        })
        return new Response(JSON.stringify(addedChecklist), { status: 201 });
    } catch (error) {
        console.error("❌ Error creating checklist:", error);
        return new Response(JSON.stringify({ error: "Failed to create checklist" }), { status: 500 });
    }
}
