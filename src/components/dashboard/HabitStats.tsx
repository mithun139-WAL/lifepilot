"use client";

const habits = [
  { name: "Drink Water", done: true },
  { name: "10-min Walk", done: false },
  { name: "Read 10 pages", done: true },
  { name: "Meditation", done: false },
];

export function HabitStats() {
  return (
    <div className="backdrop-blur-md rounded-xl border border-blue-500/20 p-4 shadow-inner h-50">
      <h3 className="text-white font-semibold mb-4">✅ Habits Today</h3>
      <ul className="space-y-3">
        {habits.map((habit, i) => (
          <li
            key={i}
            className={`flex justify-between text-sm ${
              habit.done ? "text-green-400" : "text-slate-300"
            }`}
          >
            {habit.name}
            <span>{habit.done ? "✔️" : "⏳"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}