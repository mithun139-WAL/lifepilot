"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Checklist = {
  id: number;
  title: string;
  completedAt?: string | null;
  description?: string;
  expectedTime?: string;
};

export type Task = {
  id: number;
  title: string;
  status: "PENDING" | "COMPLETED";
  description?: string;
  dueDate?: string;
  startTime?: string;
  day?: number; // Optional, used for planner tasks
  checklists?: Checklist[]; // ✅ Added
};

type TaskContextType = {
  tasks: Task[];
  setTasks: any;
  addTask: (params: { title: string; description: string; dueDate: string; startTime: string }) => void;
  deleteTask: (id: number) => void;
  toggleStatus: (id: number) => void;
  editTask: (id: number, newTask: Omit<Task, "id">) => void;
  renameTask: (id: number, newTitle: string) => void;
  // ✅ Checklist operations
  addChecklistItem: (taskId: number, title: string) => void;
  toggleChecklistItem: (taskId: number, checklistId: number) => void;
  deleteChecklistItem: (taskId: number, checklistId: number) => void;

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


  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("lifePilotTasks", JSON.stringify(tasks));
  }, [tasks]);

  const addTask = ({ title, description, dueDate, startTime }: { title: string; description: string; dueDate: string; startTime: string }) => {
    const newTask: Task = {
      id: Date.now(),
      title,
      description,
      dueDate,
      startTime,
      status: "PENDING",
      checklists: [], // ✅ start with empty checklist
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
          ? { ...task, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" }
          : task
      )
    );
  };

  const editTask = (id: number, newTask: Task) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...newTask } : task))
    );
  };

  const renameTask = (id: number, newTitle: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, title: newTitle } : task))
    );
  };

  // ✅ Checklist ops
  const addChecklistItem = (taskId: number, title: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
            ...task,
            checklists: [
              ...(task.checklists || []),
              { id: Date.now(), title, completedAt: null },
            ],
          }
          : task
      )
    );
  };

  const toggleChecklistItem = (taskId: number, checklistId: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
            ...task,
            checklists: task.checklists?.map((item) =>
              item.id === checklistId
                ? {
                  ...item,
                  completedAt: item.completedAt ? null : new Date().toISOString(),
                }
                : item
            ),
          }
          : task
      )
    );
  };

  const deleteChecklistItem = (taskId: number, checklistId: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
            ...task,
            checklists: task.checklists?.filter((item) => item.id !== checklistId),
          }
          : task
      )
    );
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        setTasks,
        addTask,
        deleteTask,
        toggleStatus,
        editTask,
        renameTask,
        addChecklistItem,
        toggleChecklistItem,
        deleteChecklistItem,
        openEditPopup,
        setOpenEditPopup,
        currentTask,
        setCurrentTask,
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
