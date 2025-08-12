"use client";
import { useHabits } from "@/context/HabitContext";
import { useState } from "react";

export function HabitList() {
  const { habits, editHabit, deleteHabit, updateProgress } = useHabits();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const todayIndex = new Date().getDate() - 1;

  const handleEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const handleSave = (id: string) => {
    if (editValue.trim()) {
      editHabit(id, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4 mt-4">
      {habits.length === 0 && (
        <p className="text-slate-400 text-sm">No habits yet. Add one!</p>
      )}
      {habits.map((habit) => {
        const isDoneToday = habit.progress[todayIndex] === 1;

        return (
          <div
            key={habit.id}
            className="flex justify-between items-center px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white shadow-[0_0_10px_#3B82F6]/10"
          >
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: habit.color }}
              />
              {editingId === habit.id ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSave(habit.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave(habit.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="bg-transparent border-b border-blue-400 outline-none text-white text-sm flex-1"
                />
              ) : (
                <span
                  onClick={() => handleEdit(habit.id, habit.name)}
                  className="text-sm cursor-pointer hover:underline"
                >
                  {habit.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={() =>
                  updateProgress(habit.id, todayIndex, isDoneToday ? 0 : 1)
                }
                className={`text-xs px-2 py-1 rounded-md border ${
                  isDoneToday
                    ? "bg-green-500/20 text-green-300 border-green-500"
                    : "bg-white/5 text-white border-white/20"
                } hover:opacity-80`}
              >
                {isDoneToday ? "Done" : "Mark Done"}
              </button>

              <button
                onClick={() => deleteHabit(habit.id)}
                className="text-red-400 hover:text-red-300"
              >
                🗑
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}