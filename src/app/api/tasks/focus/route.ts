import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const tasks = await prisma.task.findMany({
      where: { userId },
      select: { status: true },
    });

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const focusPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return NextResponse.json({ focus: focusPercent });
  } catch (error) {
    console.error("Error fetching focus:", error);
    return NextResponse.json({ focus: 0 }, { status: 500 });
  }
}
