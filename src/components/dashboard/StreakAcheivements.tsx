"use client";

export function StreakAchievements() {
  const streaks = [
    { label: "Daily Log", value: 7, icon: "📅" },
    { label: "Meditation", value: 3, icon: "🧘" },
    { label: "Deep Work", value: 5, icon: "🔥" },
  ];

  return (
    <div className="backdrop-blur-md rounded-2xl border border-orange-400/20 p-4 shadow-inner bg-white/5 h-50">
      <h3 className="text-white font-semibold mb-4">🔥 Streaks</h3>
      <ul className="space-y-3">
        {streaks.map((s, i) => (
          <li key={i} className="flex items-center justify-between text-sm text-slate-300">
            <span className="flex gap-2 items-center">
              <span className="text-xl">{s.icon}</span>
              {s.label}
            </span>
            <span className="font-bold text-orange-400">{s.value}d</span>
          </li>
        ))}
      </ul>
    </div>
  );
}