// /app/api/insights/mood-trends/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const startDate = start ? new Date(start) : new Date(0);
  const endDate = end ? new Date(end) : new Date();

  try {
    const moods = await prisma.mood.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    // Count moods per day
    const grouped: Record<string, string[]> = {};
    moods.forEach((m) => {
      const day = startOfDay(m.createdAt).toISOString();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(m.mood);
    });

    return NextResponse.json(grouped);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch mood trends" }, { status: 500 });
  }
}