"use client";

const upcoming = [
  { time: "07:30 PM", task: "Evening Review" },
  { time: "09:00 PM", task: "Read Book - 30 mins" },
];

export function UpcomingReminders() {
  return (
    <div className="rounded-2xl p-4 backdrop-blur-md bg-white/5 border border-pink-500/20 shadow-inner text-white h-50">
      <h3 className="text-pink-400 font-semibold mb-3">⏰ Upcoming</h3>
      <ul className="text-sm space-y-2">
        {upcoming.map((r, i) => (
          <li key={i} className="flex justify-between text-slate-300">
            <span>{r.task}</span>
            <span className="text-pink-300 font-mono">{r.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}