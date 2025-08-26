import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
  }

  if (!userId) {
    return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: "PENDING",
      preferredTime: {
        gte: new Date(new Date("2025-08-25").setHours(0, 0, 0, 0)),
        lt: new Date(new Date("2025-08-25").setHours(23, 59, 59, 999)),
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      preferredTime: true,
      completedAt: true,
      planner: {
        select: {
          learningPlan: {
            select: {
              topic: true,
            },
          },
        },
      },
    },
    orderBy: { preferredTime: "asc" },
  });

  const flattenedTasks = tasks.map((task) => ({
    ...task,
    learningPlanTitle: task.planner?.learningPlan?.topic || "",
  }));
  
  return new Response(JSON.stringify({ tasks: flattenedTasks }), { status: 200 });
}
