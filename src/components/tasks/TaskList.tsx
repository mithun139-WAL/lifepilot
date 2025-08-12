"use client";

import { useState } from "react";
import { useTasks } from "@/context/TaskContext";

export function TaskList() {
  const { tasks, deleteTask, toggleStatus, editTask } = useTasks();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleEditSubmit = (id: number) => {
    if (editText.trim()) {
      editTask(id, editText);
      setEditingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pending Tasks */}
      <div className="backdrop-blur-md bg-white/5 rounded-xl p-4 border border-blue-500/20">
        <h2 className="text-lg font-semibold text-cyan-300 mb-3">📋 Pending</h2>
        {tasks
          .filter((task) => task.status === "pending")
          .map((task) => (
            <div
              key={task.id}
              className="flex justify-between items-center px-4 py-2 rounded-lg bg-white/10 border border-white/10 mb-2"
            >
              {editingId === task.id ? (
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={() => handleEditSubmit(task.id)}
                  onKeyDown={(e) => e.key === "Enter" && handleEditSubmit(task.id)}
                  className="bg-transparent border-none outline-none text-white flex-1"
                  autoFocus
                />
              ) : (
                <span onClick={() => {
                  setEditingId(task.id);
                  setEditText(task.title);
                }} className="cursor-pointer">
                  {task.title}
                </span>
              )}
              <div className="flex gap-2">
                <button onClick={() => toggleStatus(task.id)} className="text-green-400 hover:text-green-300">✔</button>
                <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-300">🗑</button>
              </div>
            </div>
          ))}
      </div>

      {/* Completed Tasks */}
      <div className="backdrop-blur-md bg-white/5 rounded-xl p-4 border border-blue-500/20">
        <h2 className="text-lg font-semibold text-green-400 mb-3">✅ Completed</h2>
        {tasks
          .filter((task) => task.status === "completed")
          .map((task) => (
            <div
              key={task.id}
              className="flex justify-between items-center px-4 py-2 rounded-lg bg-white/10 border border-white/10 mb-2 text-slate-400 line-through"
            >
              <span>{task.title}</span>
              <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-300">🗑</button>
            </div>
          ))}
      </div>
    </div>
  );
}