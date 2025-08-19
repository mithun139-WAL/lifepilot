import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { role, content } = await request.json();
  const url = new URL(request.url);
  const chatId = url.pathname.split("/").at(-2); // get chatId from URL
  const message = await prisma.message.create({
    data: {
      chatId,
      role,
      content,
    },
  });
  return new Response(JSON.stringify(message), { status: 200 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const chatId = url.pathname.split("/").at(-2); // get chatId from URL
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
  });
  return new Response(JSON.stringify(messages), { status: 200 });
}
