import { prisma } from "@/lib/prisma";
// import React,{useState,useEffect} from "react";
import PlannerPage from "../../planner/page";
import { TaskProvider } from "@/context/TaskContext";

interface PlanPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;

  const plan = await prisma.learningPlan.findUnique({
    where: { id },
    select: { topic: true, id: true },
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-cyan-400">
        {plan ? plan.topic : "Plan not found"}
      </h1>
      <PlannerPage planId={plan?.id} />
    </div>
  );
}