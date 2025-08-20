import { prisma } from "@/lib/prisma";

interface PlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;

  const plan = await prisma.learningPlan.findUnique({
    where: { id },
    select: { topic: true },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">
        {plan ? plan.topic : "Plan not found"}
      </h1>
    </div>
  );
}