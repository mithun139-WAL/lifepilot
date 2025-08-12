import { AddHabitForm } from "@/components/habits/AddHabitForm";
import { HabitList } from "@/components/habits/HabitList";
import { HabitProgressChart } from "@/components/habits/HabitProgressChart";
import React from "react";

const HabitsPage = () => {
  return (
    <div className="flex flex-col gap-6 h-full">
      <HabitProgressChart />
      <HabitList />
      <AddHabitForm />
    </div>
  );
};

export default HabitsPage;
