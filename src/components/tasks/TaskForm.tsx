"use client";

import { useState } from "react";
import { useTasks } from "@/context/TaskContext";
import { useLoader } from "../common/Loader";

export function TaskForm() {
  const [task, setTask] = useState("");
  const { addTask } = useTasks();
  const { showLoader, hideLoader } = useLoader();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;
    showLoader();
    addTask(task);
    setTimeout(() => {
      hideLoader();
    }, 1000); // Simulate network delay
    setTask("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        type="text"
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Add a new task..."
        className="flex-1 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-md border border-blue-500/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-[0_0_10px_#3B82F6] transition"
      >
        Add
      </button>
    </form>
  );
}