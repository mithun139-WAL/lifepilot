"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLoader } from "@/components/common/Loader";


export type Checklist = {
  id: string;
  title: string;
  completedAt?: string | null;
  description?: string;
  expectedTime?: string;
  status?: "PENDING" | "COMPLETED";
};

export type Task = {
  id?: string;
  title: string;
  status: "PENDING" | "COMPLETED";
  description?: string;
  dueDate?: string;
  startTime?: string;
  day?: number; // Optional, used for planner tasks
  checklists?: Checklist[]; // ✅ Added
  expectedTime?: string;
};

type TaskContextType = {
  tasks: Task[];
  setTasks: any;
  addTask: (params: { title: string; description: string; dueDate?: string; startTime?: string }) => void;
  deleteTask: (id: string) => void;
  toggleStatus: (id: string) => void;
  editTask: (id: string, newTask: Omit<Task, "id">) => void;
  renameTask: (id: string, newTitle: string) => void;
  // ✅ Checklist operations
  addChecklistItem: (taskId: string, title: string, description: string) => void;
  toggleChecklistItem: (taskId: string, checklistId: string, title: string, description: string, status: string, expectedTime: string) => void;
  deleteChecklistItem: (taskId: string, checklistId: string) => void;
  editChecklistItem: (taskId: string, checklistId: string, newTitle: string, description: string, expectedTime: string, status:string) => void;

  openEditPopup: boolean;
  setOpenEditPopup: any;
  currentTask: Task | null;
  setCurrentTask: any;
  parentTaskId: string | null;
  setParentTaskId: any;
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openEditPopup, setOpenEditPopup] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const { showLoader, hideLoader } = useLoader();
  const [parentTaskId, setParentTaskId] = useState<string | null>(null);

  const fetchTaskDetailsAPI = async (taskId: string) => {
    try {
      showLoader();
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch task details");
      const result = await response.json();
      console.log("Fetched task details api is called:", result);
      setTasks([result.data]);
    } catch (error) {
      console.error("Error fetching task details:", error);
    } finally {
      setTimeout(hideLoader, 500);
    }
  };

  const addTask = ({ title, description, dueDate, startTime }: { title: string; description: string; dueDate?: string; startTime?: string }) => {
    const newTask: Task = {
      title,
      description,
      status: "PENDING",
    };
    console.log("Adding task:", newTask);
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const toggleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, status: task.status === "PENDING" ? "COMPLETED" : "PENDING" }
          : task
      )
    );
  };

  const editTask = (id: string, newTask: Task) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...newTask } : task))
    );
  };

  const renameTask = (id: string, newTitle: string) => {
    // setTasks((prev) =>
    //   prev.map((task) => (task.id === id ? { ...task, title: newTitle } : task))
    // );
  };

  // ✅ Checklist operations

  const addCheckListItemAPI = async (data: any) => {
    try {
      showLoader();
      const response = await fetch(`/api/tasks/${data.taskId}/checklists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add checklist item");
      const result = await response.json();
      fetchTaskDetailsAPI(data.taskId);
      return result;
    } catch (error) {
      console.error("Error adding checklist item:", error);
      throw error;
    }
    finally {
      hideLoader();
    }
  }

  const editCheckListItemAPI = async (data: any) => {
    try {
      showLoader();
      const response = await fetch(`/api/tasks/${data.taskId}/checklists/${data.checklistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to edit checklist item");
      const result = await response.json();
      fetchTaskDetailsAPI(data.taskId);
      return result;
    } catch (error) {
      console.error("Error editing checklist item:", error);
      throw error;
    }
    finally {
      hideLoader();
    }
  }

  const deleteCheckListItemAPI = async (taskId: string, checklistId: string) => {
    try {
      showLoader();
      const response = await fetch(`/api/tasks/${taskId}/checklists/${checklistId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete checklist item");
      const result = await response.json();
      fetchTaskDetailsAPI(taskId);
      return result;
    } catch (error) {
      console.error("Error deleting checklist item:", error);
      throw error;
    }
    finally {
      hideLoader();
    }
  }

  const addChecklistItem = async (taskId: string, title: string, description: string) => {
    if (!taskId || !title.trim()) return;
    try {
      const newTask = await addCheckListItemAPI({ taskId, title, description });
      console.log('task after adding', newTask);
      // setTasks((prev) =>
      //   prev.map((task) =>
      //     task.id === taskId
      //       ? {
      //         ...task,
      //         checklists: [
      //           ...(task.checklists || []),
      //           { id: newTask?.id, title: newTask?.title, description: newTask?.description, status: newTask?.status, expectedTime: newTask?.expectedTime || "" } as Checklist,
      //         ],
      //       }
      //       : task
      //   )
      // );
    } catch (error) {
      console.error('Error adding checklist item:', error);
    }
  };

  const toggleChecklistItem = async(
    taskId: string,
    checklistId: string,
    title: string,
    description: string,
    status: string,
    expectedTime: string
  ) => {
    if (!taskId || !checklistId) return;
    // Ensure status is of the correct type
    try {
      const result = await editCheckListItemAPI({ taskId, checklistId, title, description, status, expectedTime });
      // setTasks((prev) =>
      //   prev.map((task) =>
      //     task.id === taskId
      //       ? {
      //         ...task,
      //         checklists: task.checklists?.map((item) =>
      //           item.id === checklistId
      //             ? {
      //               ...item,
      //               status: result?.status,
      //             }
      //             : item
      //         ),
      //       }
      //       : task
      //   )
      // );
    }
    catch (error) {
      console.error("Error toggling checklist item:", error);
    }
  };

  const deleteChecklistItem = async(taskId: string, checklistId: string) => {
    if (!taskId || !checklistId) return;

    try {
      const result = await deleteCheckListItemAPI(taskId, checklistId);
      // setTasks((prev) =>
      //   prev.map((task) =>
      //     task.id === taskId
      //       ? {
      //         ...task,
      //         checklists: task.checklists?.filter((item) => item.id !== checklistId),
      //       }
      //       : task
      //   )
      // );
    } catch (error) {
      console.error("Error deleting checklist item:", error);
    }
    
  };

  const editChecklistItem = async (taskId: string, checklistId: string, newTitle: string, description: string, expectedTime: string,status: string) => {
    if (!taskId || !checklistId || !newTitle.trim()) return;
    try {
      const result = await editCheckListItemAPI({ taskId, checklistId, title: newTitle, description, expectedTime, status });
      // setTasks((prev) =>
      //   prev.map((task) =>
      //     task.id === taskId
      //       ? {
      //         ...task,
      //         checklists: task.checklists?.map((item) =>
      //           item.id === checklistId ? { ...item, title: newTitle, description } : item
      //         ),
      //       }
      //       : task
      //   )
      // );
    } catch (error) {
      console.error("Error editing checklist item:", error);
    }
  }

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
        editChecklistItem,
        openEditPopup,
        setOpenEditPopup,
        currentTask,
        setCurrentTask,
        parentTaskId,
        setParentTaskId
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
