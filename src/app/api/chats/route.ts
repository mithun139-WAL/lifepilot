import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const { title } = await request.json();
  const chat = await prisma.chat.create({
    data: { title },
  });
  return new Response(JSON.stringify(chat), { status: 200 });
}

export async function GET() {
  const chats = await prisma.chat.findMany({
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  console.log('Fetched chats:', chats);
  return new Response(JSON.stringify(chats), { status: 200 });
}