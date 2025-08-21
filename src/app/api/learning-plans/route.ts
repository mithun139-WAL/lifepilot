import { HabitFrequency } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

interface Habit {
  title: string;
  frequency: "daily" | "weekly";
  description: string;
}

// Create a new learning plan
export async function POST(request: Request) {
  try {
    const { userId, topic, planner, task_list, habits_list, goalId } = await request.json();

    if (!userId || !topic || !goalId) {
      return new Response(JSON.stringify({ error: "userId, topic, and goalId are required" }), { status: 400 });
    }

    const learningPlan = await prisma.learningPlan.create({
      data: {
        user: { connect: { id: userId } },
        topic,
        planner,
        task_list,
        habits_list,
        goal: { connect: { id: goalId } }
      },
    });

    const promises: Promise<any>[] = [];
    if (habits_list?.length) {
      const habitsList = habits_list
        .map((habit: Habit) => ({
          userId,
          learningPlanId: learningPlan.id,
          name: habit.title,
          description: habit.description ?? null,
          frequency: habit.frequency === 'daily' 
            ? HabitFrequency.DAILY 
            : HabitFrequency.WEEKLY,
        }));
      if (habitsList.length) {
        promises.push(
          prisma.habit.createMany({
            data: habitsList
          })
        )
      }
    }
    if (planner?.length) {
      for (const plan of planner) {
        const relatedTasks = task_list?.find(
          (task: any) => task.week === plan.week
        )?.tasks ?? [];

        const tasksData = relatedTasks.map((task: any) => ({
          userId,
          title: task.title,
          description: task.description ?? null,
          dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
          checklists: {
            create: task.checklists?.map((item: any) => ({
              title: item.title,
              description: item.description ?? null,
              expectedTime: item.expectedTime ?? null,
            })) ?? [],
          }
        }));

        const plannerEntry = {
          userId,
          learningPlanId: learningPlan.id,
          title: plan.milestone,
          description: plan.summary ?? null,
          week: Number(plan.week),
          tasks: { create: tasksData }
        };

        promises.push(prisma.planner.create({ data: plannerEntry }));
      }
    }
    await Promise.all(promises);

    return new Response(JSON.stringify(learningPlan), { status: 201 });
  } catch (error) {
    console.error("❌ Error creating learning plan:", error);
    return new Response(JSON.stringify({ error: "Failed to create learning plan" }), { status: 500 });
  }
}

// Get all learning plans
export async function GET() {
  try {
    const plans = await prisma.learningPlan.findMany({
      orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify(plans), { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching learning plans:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch learning plans" }), { status: 500 });
  }
}