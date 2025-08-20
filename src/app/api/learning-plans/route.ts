import { prisma } from "@/lib/prisma";

// Create a new learning plan
export async function POST(request: Request) {
  try {
    const { userId, topic, planner, task_list, habits_list, goalId } = await request.json();

    if (!userId || !topic || !goalId) {
      return new Response(JSON.stringify({ error: "userId and topic are required" }), { status: 400 });
    }

    const plan = await prisma.learningPlan.create({
      data: { 
        user: { connect: { id: userId } }, 
        topic, 
        planner, 
        task_list, 
        habits_list, 
        goal: { connect: { id: goalId } } 
      },
    });

    return new Response(JSON.stringify(plan), { status: 201 });
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