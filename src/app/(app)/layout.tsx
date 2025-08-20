// ProtectedLayout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const userId = session.user.id;

  const goal = await prisma.goal.findFirst({
    where: { userId },
    include: { LearningPlan: true },
  });

  if (!goal) {
    redirect("/goal");
  }

  if (goal && goal.LearningPlan.length === 0) {
    redirect("/goal");
  }

  return <MainLayout>{children}</MainLayout>;
}