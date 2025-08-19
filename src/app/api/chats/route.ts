import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const { title,userId } = await request.json();
  const chat = await prisma.chat.create({
    data: { title,userId },
  });
  return new Response(JSON.stringify(chat), { status: 200 });
}

export async function GET() {
  const chats = await prisma.chat.findMany({
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  return new Response(JSON.stringify(chats), { status: 200 });
}