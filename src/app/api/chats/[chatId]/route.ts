import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return Response.json({ success: false, error: "Chat not found" }, { status: 404 });
  }

  const { title } = await req.json();
  if (!title) {
    return Response.json({ success: false, error: "Title is required" }, { status: 400 });
  }

  const updatedChat = await prisma.chat.update({
    where: { id: chatId },
    data: { title },
  });

  return Response.json({ success: true, data: updatedChat }, { status: 200 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return Response.json({ success: false, error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ success: true, data: chat }, { status: 200 });
}