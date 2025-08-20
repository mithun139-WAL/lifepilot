import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { role, content } = await request.json();
    const url = new URL(request.url);
    const chatId = url.pathname.split("/").at(-2);
    if (!chatId || !role || !content) {
      return Response.json({ success: false, error: "chatId, role, and content are required" }, { status: 400 });
    }
    const message = await prisma.message.create({
      data: { chatId, role, content },
    });

    return Response.json({ success: true, data: message }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("POST /chats/[chatId]/messages error:", error.message);
    } else {
      console.error("POST /chats/[chatId]/messages error:", error);
    }
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const chatId = url.pathname.split("/").at(-2);
    if (!chatId) {
      return Response.json({ success: false, error: "chatId is required" }, { status: 400 });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({ success: true, data: messages }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("GET /chats/[chatId]/messages error:", error.message);
    } else {
      console.error("GET /chats/[chatId]/messages error:", error);
    }
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { messageId } = await request.json();
    if (!messageId) {
      return Response.json({ success: false, error: "messageId is required" }, { status: 400 });
    }

    await prisma.message.delete({ where: { id: messageId } });

    return Response.json({ success: true, data: { id: messageId } }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }
    return Response.json({ success: false, error: "An unknown error occurred" }, { status: 500 });
  }
}