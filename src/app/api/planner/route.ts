import { authOptions } from "@/lib/auth";
import { groqFetchWithRetry } from "@/lib/groqFetch";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

// export const runtime = "edge";

function extractJSON(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function POST(req: NextRequest) {
  console.log("➡️ Triggering fetchPlanner...");
  const { goalId } = await req.json();
  if (!goalId) {
    return new Response("Missing goalId", { status: 400 });
  }
  const session = await getServerSession(authOptions);
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    return new Response("Goal not found", { status: 404 });
  }

  const { title, hoursPerDay, targetWeeks } = goal;
  try {
    const roadmapRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content:
                "You are a structured learning planner. Generate a clear roadmap with milestones.",
            },
            {
              role: "user",
              content: `You are an expert learning planner. Create a ${targetWeeks} week roadmap for this learning goal: ${title} spending ${hoursPerDay} a day.
                Break into weeks with milestones only (no tasks yet). 
                Output only a stringified JSON object. Do not include any text outside the JSON. Do NOT include any prefix, labels, or explanatory text. Start immediately with '{'. 
                Example:
                { 
                  "planner": [ 
                    { 
                    "week": , 
                     "milestone": "...", 
                     "summary": "..." 
                     }, 
                  ]
                } 
                Rules:
                - Each week must have 1 milestone.
                - Keep milestones progressive (from basics → advanced).
                - Limit summary to 2–3 sentences.
                - Everything must be in planner, no extras needed other than that.
                - Do NOT include daily tasks here (that comes later).,
               `,
            },
          ],
          temperature: 0,
          stream: false,
        }),
      }
    );

    const roadmapData = await roadmapRes.json();
    const cleanRoadmapText = roadmapData.choices?.[0]?.message?.content?.trim();
    if (!cleanRoadmapText) throw new Error("No roadmap content received");
    const roadmap = JSON.parse(cleanRoadmapText);

    // 2. Generate TASKS for each week
    interface Task {
      day: string;
      description: string;
    }

    const tasks: Task[][] = [];

    for (const week of roadmap.planner) {
      const tasksRes = await groqFetchWithRetry(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [
              {
                role: "assistant",
                content:
                  "You are a task generator. Output structured weekly tasks only.",
              },
              {
                role: "user",
                content: `You are an expert tutor. For the goal '${title}', generate detailed tasks for Week ${week.week} with milestone: ${week.milestone}.
                  Break down the milestone into daily tasks.
                  Output only a stringified JSON object. Do not include any text outside the JSON. Do NOT include any prefix, labels, or explanatory text. Start immediately with '{'.
                  {
                    "week": ${week.week},
                    "tasks": [
                      {
                        "day": 1,
                        "title": "Task title e.g. 'Learn numbers 1-100'",
                        "description": "1–2 sentence actionable description",
                        "checklists": [
                           {
                             "title": "Numbers 1-50",
                             "description": "Study numbers 1–50 and practice counting objects.",
                             "expectedTime": "1 hour"
                           },
                           {
                             "title": "Numbers 51-100",
                             "description": "Study numbers 51–100 and use in simple sentences (age, price).",
                             "expectedTime": "1 hour"
                           }
                          ]
                        "dueDate": "YYYY-MM-DD"
                      }
                    ]
                  }
                  Rules:
                - Each day must have 2–5 checklists.
                - Tasks must directly support the milestone of that week.
                - Keep descriptions short, actionable, and focused (1–2 lines max).
                - Assign a dueDate (sequential inside the week).
                - Day 7 should always be Review & Self-Assessment of the week milestone.
                - Do not overlap content across days; each task should build on the previous one,
                - Keep the tone motivational but realistic`,
              },
            ],
            temperature: 0,
            stream: false,
          }),
        }
      );

      const rawText = await tasksRes.text();
      let tasksData:
        | { choices?: { message?: { content?: string } }[] }
        | undefined;
      try {
        tasksData = JSON.parse(rawText);
      } catch (err) {
        console.error("❌ Failed to parse tasksRes as JSON:", err);
        continue;
      }

      const cleanTasksText =
        tasksData?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!cleanTasksText) {
        console.error(`❌ No content in tasks response for Week ${week.week}`);
        continue;
      }

      const taskJsonString = extractJSON(cleanTasksText);
      if (!taskJsonString) {
        console.error(
          `❌ Could not extract JSON for Week ${week.week}:`,
          cleanTasksText
        );
        continue;
      }

      try {
        const parsedWeekTasks = JSON.parse(taskJsonString);
        tasks.push(parsedWeekTasks);
      } catch (err) {
        console.error(
          `❌ JSON parse error for Week ${week.week}:`,
          err,
          taskJsonString
        );
      }
    }


    const habitsRes = await groqFetchWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "assistant",
              content:
                "You are a habit coach. Generate recurring supportive habits.",
            },
            {
              role: "user",
              content: `For the goal '${title}', suggest recurring supportive habits.
              These should help the user succeed in the long term, not one-off tasks.
              Output only a stringified JSON object. Do not include any text outside the JSON. Do NOT include any prefix, labels, or explanatory text. Start immediately with '{'.
              {
                "habits": [
                  {
                    "title": "Habit title",
                    "frequency": "daily | weekly",
                    "description": "1–2 sentence motivating explanation"
                  }
                ]
              }
              Rules:
              - Each habit must be recurring.
              - Keep them simple, motivating, and supportive of the main goal.
              - At least 3 habits.
              - Frequencies should be either 'daily' or 'weekly'.`,
            },
          ],
          temperature: 0,
          stream: false,
        }),
      }
    );

    const habitsData = await habitsRes.json();
    if (!habitsData.choices?.length) {
      console.error("❌ No habits data in response:", habitsData);
      return new Response(JSON.stringify({ habits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const cleanHabitsText = habitsData.choices?.[0]?.message?.content?.trim();
    const habitsJsonString = extractJSON(cleanHabitsText || "");
    const habits = habitsJsonString ? JSON.parse(habitsJsonString) : null;
    console.log("Habits response:", habits?.habits, roadmap.planner, tasks);

    const dbRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/learning-plans`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          topic: title,
          planner: roadmap.planner,
          task_list: tasks,
          habits_list: habits?.habits || [],
          goalId: goal.id,
        }),
      }
    );

    const dbData = await dbRes.json();

    return new Response(
      JSON.stringify({ roadmap, tasks, habits, savedPlan: dbData }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Planner API failed:", err);
    return new Response(JSON.stringify({ error: "Planner API failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
