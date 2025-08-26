import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
// import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const startDate = start ? new Date(start) : new Date(0);
  const endDate = end ? new Date(end) : new Date();

  try {
    const tasks = await prisma.task.findMany({
      where: {
        dueDate: { gte: startDate, lte: endDate },
      },
    });

    const stats = tasks.reduce(
      (acc, task) => {
        if (task.status === "COMPLETED") acc.completed += 1;
        else acc.pending += 1;
        return acc;
      },
      { completed: 0, pending: 0 }
    );

    return NextResponse.json(stats);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch task stats" }, { status: 500 });
  }
}