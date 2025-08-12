"use client";

export function MoodInsight() {
  return (
    <div className="backdrop-blur-md rounded-xl border border-blue-500/20 p-4 shadow-inner h-50">
      <h3 className="text-white font-semibold mb-4">📊 Mood & Progress</h3>
      <div className="text-slate-300 text-sm space-y-2">
        <p>😊 You logged your mood as &quot;Happy&quot; 2 hours ago.</p>
        <p>🎯 Weekly Goal Progress: 3 / 5 goals completed</p>
        <p className="text-blue-400 italic">&quot;Keep up the energy! You&apos;re doing great.&quot;</p>
      </div>
    </div>
  );
}