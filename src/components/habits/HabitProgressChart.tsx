"use client";
import { useHabits } from "@/context/HabitContext";
import { PieChart, Pie, Cell } from "recharts";

export function HabitProgressChart() {
  const { habits } = useHabits();
  const daysInMonth = new Date().getDate();

  if (habits.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center mt-6">
        No habits to display progress for.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-4">
      {habits.map((habit) => {
        const completedDays = habit.progress.filter((v) => v === 1).length;
        const percentage = Math.round((completedDays / daysInMonth) * 100);

        const chartData = [
          { name: "Completed", value: completedDays },
          { name: "Remaining", value: daysInMonth - completedDays },
        ];

        return (
          <div
            key={habit.id}
            className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_0_20px_#3B82F6]/10 text-white text-center"
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: habit.color }}>
              {habit.name}
            </h3>

            <PieChart width={160} height={160}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                <Cell fill={habit.color} />
                <Cell fill="#1e293b" />
              </Pie>
            </PieChart>

            <p className="text-xs text-slate-300 mt-2">
              {completedDays} / {daysInMonth} days ({percentage}%)
            </p>
          </div>
        );
      })}
    </div>
  );
}