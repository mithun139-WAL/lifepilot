import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const habits = await prisma.habit.findMany({
      where: {
        frequency: "DAILY",
        streak: { gt: 0 },
      },
      select: {
        id: true,
        description: true,
        streak: true,
      },
      orderBy: { streak: "desc" },
    });

    return NextResponse.json(habits);
  } catch (err) {
    console.error("❌ Error fetching streak habits:", err);
    return NextResponse.json(
      { error: "Failed to fetch streak habits" },
      { status: 500 }
    );
  }
}