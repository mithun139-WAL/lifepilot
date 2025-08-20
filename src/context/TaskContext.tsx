"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Task = {
  id: number;
  title: string;
  status: "pending" | "completed";
  description?: string;
  dueDate?: string;
  startTime?: string;
  day?: number; // Optional, used for planner tasks
};

type TaskContextType = {
  tasks: Task[];
  setTasks: any;
  addTask: (params: { title: string; description: string; dueDate: string; startTime: string }) => void;
  deleteTask: (id: number) => void;
  toggleStatus: (id: number) => void;
  editTask: (id: number, newTask: Omit<Task, "id">) => void;
  openEditPopup: boolean;
  setOpenEditPopup: any;
  currentTask: Task | null;
  setCurrentTask: any;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openEditPopup, setOpenEditPopup] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("lifePilotTasks");
    if (stored) setTasks(JSON.parse(stored));
  }, []);

  // Save to localStorage on tasks change
  useEffect(() => {
    localStorage.setItem("lifePilotTasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = ({title, description, dueDate,startTime}: {title: string; description: string; dueDate: string; startTime: string}) => {
    const newTask: Task = {
      id: Date.now(),
      title,
      description,
      dueDate,
      startTime,
      status: "pending",
    };
    setTasks((prev) => [newTask, ...prev]);
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

  const editTask = (id: number, newTask: Task) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...newTask } : task))
    );
  };

  return (
    <TaskContext.Provider
      value={{
        tasks, setTasks, addTask, deleteTask, toggleStatus, editTask, openEditPopup, setOpenEditPopup, currentTask, setCurrentTask
      }}
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