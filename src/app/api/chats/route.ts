import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { title, userId } = await request.json();

    if (!title || !userId) {
      return Response.json({ success: false, error: "title and userId are required" }, { status: 400 });
    }

    const chat = await prisma.chat.create({
      data: { title, userId },
    });

    return Response.json({ success: true, data: chat }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("POST /chats error:", error.message);
    } else {
      console.error("POST /chats error:", error);
    }
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ success: true, data: chats }, { status: 200 });
  } catch (error) {
    console.error("GET /chats error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { chatId } = await request.json();
    if (!chatId) {
      return NextResponse.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    await prisma.chat.delete({ where: { id: chatId } });

    return NextResponse.json({ success: true, data: { id: chatId } }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: "An unknown error occurred" }, { status: 500 });
  }
}