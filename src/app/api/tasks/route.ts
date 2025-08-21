import { TaskStatus } from "@/generated/prisma";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

interface checkList {
    title: string;
    status: TaskStatus;
    description: string | null;
    expectedTime: number | null;
}

// Create a new learning plan
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const { plannerId, title, status, description, dueDate, checklists, completedAt } = await request.json();
        if (!plannerId || !title) {
            return NextResponse.json({ success: false, error: "plannerId and title are required." }, { status: 400 });
        } else if (status) {
            if (!Object.values(TaskStatus).includes(status)) return NextResponse.json({ success: false, error: "Invalid task status." }, { status: 400 });
            if (status === TaskStatus.COMPLETED && !completedAt) return NextResponse.json({ success: false, error: "completedAt is required when status is completed." }, { status: 400 });
        }

        const createdTask = await prisma.task.create({
            data: {
                userId: session.user.id,
                plannerId,
                title,
                status: status ?? TaskStatus.PENDING,
                description,
                dueDate: dueDate ? new Date(dueDate).toISOString() : null,
                completedAt: status !== TaskStatus.COMPLETED ? null : new Date(completedAt).toISOString(),
                checklists: {
                    create: (checklists ?? []).map((item: checkList) => ({
                            title: item.title,
                            status: status === TaskStatus.COMPLETED ? TaskStatus.COMPLETED : item.status ?? TaskStatus.PENDING,
                            description: item.description ?? null,
                            expectedTime: item.expectedTime ?? null,
                    })),
                },
            }
        })
        return new Response(JSON.stringify(createdTask), { status: 201 });
    } catch (error) {
        console.error("❌ Error creating task:", error);
        return new Response(JSON.stringify({ error: "Failed to create task" }), { status: 500 });
    }
}
