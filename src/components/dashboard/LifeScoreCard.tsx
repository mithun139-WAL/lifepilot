"use client";

export function LifeScoreCard() {
  const score = 82;

  return (
    <div className="rounded-2xl p-4 backdrop-blur-md bg-white/5 border border-cyan-500/20 shadow-[0_0_10px_#22d3ee40] text-center h-50">
      <h3 className="text-cyan-400 text-lg font-bold mb-2">✨ Life Score</h3>
      <p className="text-5xl font-extrabold text-white">{score}</p>
      <p className="text-slate-400 text-sm mt-1">Today’s energy level</p>
    </div>
  );
}