"use client";
import { useState, useEffect } from "react";

export function FocusPanel() {
  const [focus, setFocus] = useState(0);
  const fetchFocus = async () => {
    const res = await fetch("/api/tasks/focus");
    const data = await res.json();
    setFocus(data.focus || 0);
  };

  useEffect(() => {
    fetchFocus();
  }, []);

  const distractions = 100 - focus;

  return (
    <div className="rounded-2xl p-4 backdrop-blur-md bg-white/5 border border-yellow-500/20 shadow-[0_0_10px_#facc1530] text-white h-60">
      <h3 className="text-yellow-300 font-semibold mb-2">🧘‍♂️ Focus Balance</h3>
      <div className="flex items-center justify-between text-sm">
        <span>
          🟢 Focus: <span className="font-bold text-green-400">{focus}%</span>
        </span>
        <span>
          🔴 Distractions:{" "}
          <span className="font-bold text-red-400">{distractions}%</span>
        </span>
      </div>
      <div className="mt-3 w-full bg-slate-700 rounded-full h-2">
        <div
          className="bg-green-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${focus}%` }}
        />
      </div>
    </div>
  );
}
