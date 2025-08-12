"use client";
import { useHabits } from "@/context/HabitContext";
import { useState } from "react";

export function AddHabitForm() {
  const { addHabit } = useHabits();
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addHabit(title.trim());
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        placeholder="New Habit..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-blue-500/20 text-white focus:outline-none"
      />
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow"
      >
        Add
      </button>
    </form>
  );
}