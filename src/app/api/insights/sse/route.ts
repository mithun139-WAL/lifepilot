// src/app/api/insights/sse/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const sendData = async () => {
        try {
          const tasks = await prisma.task.findMany();
          const habits = await prisma.habit.findMany({ include: { completions: true } });
          const data = { tasks, habits };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (err) {
          console.error("SSE Error:", err);
        }
      };

      // Send initial data
      sendData();

      // Interval for updates
      intervalId = setInterval(sendData, 5000);

      // Detect when client disconnects
      const closeHandler = () => {
        clearInterval(intervalId);
        controller.close();
        console.log("SSE client disconnected");
      };

      // Abort signal from Next.js request
      req.signal.addEventListener("abort", closeHandler);
    },
    cancel() {
      // Cleanup if stream is cancelled
      clearInterval(intervalId);
      console.log("SSE stream cancelled");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}