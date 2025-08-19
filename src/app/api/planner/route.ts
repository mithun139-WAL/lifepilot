import { groqFetchWithRetry } from "@/lib/groqFetch";
import { NextRequest } from "next/server";

export const runtime = "edge";

function extractJSON(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function POST(req: NextRequest) {
  const { goal, duration } = await req.json();
  if (!goal || !duration) {
    return new Response("Missing goal or duration", { status: 400 });
  }

  try {
    // 1. Generate ROADMAP
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
              content: `You are an expert learning planner. Create a ${duration} roadmap for this learning goal: ${goal}.
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
    console.log("📡 Full roadmapData:", JSON.stringify(roadmapData, null, 2));
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
      console.log(`Generating tasks for Week ${week.week}...`);
    
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
                content: "You are a task generator. Output structured weekly tasks only.",
              },
              {
                role: "user",
                content: `You are an expert tutor. For the goal '${goal}', generate detailed tasks for Week ${week.week} with milestone: ${week.milestone}.
                  Break down the milestone into daily tasks.
                  Output only a stringified JSON object. Do not include any text outside the JSON. Do NOT include any prefix, labels, or explanatory text. Start immediately with '{'.
                  {
                    "week": ${week.week},
                    "tasks": [
                      {
                        "day": 1,
                        "title": "Task title",
                        "description": "1–2 sentence explanation",
                        "expectedTime": "1–2 hours",
                        "dueDate": "YYYY-MM-DD"
                      }
                    ]
                  }`
              }
            ],
            temperature: 0,
            stream: false,
          }),
        }
      );
    
      const rawText = await tasksRes.text();
      console.log(`📡 Raw tasks response (Week ${week.week}):`, rawText);
    
      let tasksData: { choices?: { message?: { content?: string } }[] } | undefined;
      try {
        tasksData = JSON.parse(rawText);
      } catch (err) {
        console.error("❌ Failed to parse tasksRes as JSON:", err);
        continue;
      }
    
      const cleanTasksText = tasksData?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!cleanTasksText) {
        console.error(`❌ No content in tasks response for Week ${week.week}`);
        continue;
      }
    
      const taskJsonString = extractJSON(cleanTasksText);
      if (!taskJsonString) {
        console.error(`❌ Could not extract JSON for Week ${week.week}:`, cleanTasksText);
        continue;
      }
    
      try {
        const parsedWeekTasks = JSON.parse(taskJsonString);
        tasks.push(parsedWeekTasks);
      } catch (err) {
        console.error(`❌ JSON parse error for Week ${week.week}:`, err, taskJsonString);
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
              content: `For the goal '${goal}', suggest recurring supportive habits.
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
        return new Response(
          JSON.stringify({ habits: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    console.log("Habits response:", habitsData);
    const cleanHabitsText = habitsData.choices?.[0]?.message?.content?.trim();
    const habitsJsonString = extractJSON(cleanHabitsText || "");
    const habits = habitsJsonString ? JSON.parse(habitsJsonString) : null;

    return new Response(JSON.stringify({ roadmap, tasks, habits }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Planner API failed:", err);
    return new Response(JSON.stringify({ error: "Planner API failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
