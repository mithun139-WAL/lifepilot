"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Task = {
  id: number;
  title: string;
  status: "pending" | "completed";
};

type TaskContextType = {
  tasks: Task[];
  addTask: (title: string) => void;
  deleteTask: (id: number) => void;
  toggleStatus: (id: number) => void;
  editTask: (id: number, newTitle: string) => void;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("lifePilotTasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  // Save to localStorage on tasks change
  useEffect(() => {
    localStorage.setItem("lifePilotTasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (title: string) => {
    const newTask: Task = {
      id: Date.now(),
      title,
      status: "pending",
    };
    setTasks([newTask, ...tasks]);
  };

  const deleteTask = (id: number) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const toggleStatus = (id: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, status: task.status === "pending" ? "completed" : "pending" }
          : task
      )
    );
  };

  const editTask = (id: number, newTitle: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, title: newTitle } : task))
    );
  };

  return (
    <TaskContext.Provider
      value={{ tasks, addTask, deleteTask, toggleStatus, editTask }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error("useTasks must be used within TaskProvider");
  return context;
};