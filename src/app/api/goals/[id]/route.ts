import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;

    const goal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      );
    }

    // ensure goal belongs to logged in user
    if (goal.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: goal }, { status: 200 });
  } catch (error) {
    console.error("Error fetching goal by ID:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch goal" },
      { status: 500 }
    );
  }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
  ) {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
  
      const { id } = params;
  
      const goal = await prisma.goal.findUnique({ where: { id } });
  
      if (!goal) {
        return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
      }
  
      if (goal.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
  
      await prisma.goal.delete({ where: { id } });
  
      return NextResponse.json({ success: true, message: "Goal deleted successfully" }, { status: 200 });
    } catch (error) {
      console.error("Error deleting goal:", error);
      return NextResponse.json({ success: false, error: "Failed to delete goal" }, { status: 500 });
    }
  }