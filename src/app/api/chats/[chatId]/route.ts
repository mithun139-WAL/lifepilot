import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return NextResponse.json(
      { success: false, error: "Chat not found" },
      { status: 404 }
    );
  }

  const { title } = await req.json();
  if (!title) {
    return NextResponse.json(
      { success: false, error: "Title is required" },
      { status: 400 }
    );
  }

  const updatedChat = await prisma.chat.update({
    where: { id: chatId },
    data: { title },
  });

  return NextResponse.json({ success: true, data: updatedChat }, { status: 200 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const { chatId } = params;

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return NextResponse.json(
      { success: false, error: "Chat not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: chat }, { status: 200 });
}