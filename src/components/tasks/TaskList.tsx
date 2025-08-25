"use client";

import { useTasks } from "@/context/TaskContext";
import { CircleCheckBig, MoreVertical, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { TaskForm } from "./TaskForm";
import { Button } from "../ui/button";

interface TaskListProps {
  existingTasks: any[];
  refreshPlan?: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({ existingTasks, refreshPlan }) => {
  const {
    tasks,
    setTasks,
    toggleChecklistItem,
    renameTask,
    deleteChecklistItem,
    setOpenEditPopup,
    setCurrentTask,
    setParentTaskId,
  } = useTasks();

  const [menuOpen, setMenuOpen] = useState<{
    type: "task" | "checklist";
    id: number;
  } | null>(null);

  const [renamingId, setRenamingId] = useState<{
    type: "task" | "checklist";
    id: number;
  } | null>(null);

  const [newTitle, setNewTitle] = useState("");

  const handleToggleChecklist = async (taskId: string, check: any) => {
    await toggleChecklistItem(
      taskId,
      check.id,
      check.title,
      check.description,
      check.status === "COMPLETED" ? "PENDING" : "COMPLETED",
      check.expectedTime || ""
    );

    if (refreshPlan) refreshPlan();
  };


  useEffect(() => {
    setTasks(existingTasks);
    setParentTaskId(existingTasks[0]?.id || null);
  }, [existingTasks]);

  const formatDueDate = (dueDate: string) => {
    if (!dueDate) return null;

    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    let label = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    if (sameDay(date, today)) label += " (Today)";
    else if (sameDay(date, tomorrow)) label += " (Tomorrow)";
    else if (sameDay(date, yesterday)) label += " (Yesterday)";

    return label;
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-4 bg-gray-800 rounded-lg border border-gray-700"
        >
          {/* Parent task row */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col" style={{width: "100%"}}>
              <div className="flex items-center justify-between">
                <div>
                  <h3
                    className={`text-white font-medium ${
                      task.status === "COMPLETED"
                        ? "line-through text-gray-400"
                        : ""
                    }`}
                  >
                    {task.title}
                  </h3>
                </div>
                <Button
                  onClick={() => setOpenEditPopup(true)}
                  className="cursor-pointer text-white hover:text-gray-300 flex items-center gap-1"
                  variant={"neon"}
                >
                  <Plus size={16}/> Add Task
                </Button>
              </div>

              {/* Description */}
              {task.description && (
                <p className="text-sm text-gray-400 mt-1">{task.description}</p>
              )}

              {/* Due Date */}
              {task.dueDate && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatDueDate(task.dueDate)}
                </p>
              )}
            </div>

            {/* <div className="relative">
              <button
                onClick={() =>
                  setMenuOpen(
                    menuOpen?.id === task.id && menuOpen?.type === "task"
                      ? null
                      : { type: "task", id: task.id }
                  )
                }
              >
                <MoreVertical className="text-white w-5 h-5" />
              </button>
              {menuOpen?.id === task.id && menuOpen?.type === "task" && (
                <div className="absolute right-0 mt-2 w-28 bg-gray-700 text-white rounded shadow-lg z-10">
                  <button
                    onClick={() => {
                      setRenamingId({ type: "task", id: task.id });
                      setNewTitle(task.title);
                      setMenuOpen(null);
                    }}
                    className="block w-full text-left px-3 py-1 hover:bg-gray-600"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      deleteTask(task.id);
                      setMenuOpen(null);
                    }}
                    className="block w-full text-left px-3 py-1 hover:bg-gray-600"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div> */}
          </div>

          {/* Checklists */}
          {task?.checklists && task?.checklists?.length > 0 && (
            <div className="mt-3 ml-4 space-y-3">
              {task.checklists.map((check) => (
                <div
                  key={check.id}
                  onClick={() => task.id && handleToggleChecklist(task.id, check)}
                  className="flex justify-between items-start group"
                >
                  <div
                    className="flex items-start space-x-2 cursor-pointer"
                    // onClick={() => { toggleChecklistItem(task.id, check.id, check.title, check.description, check.status === "COMPLETED" ? "PENDING" : "COMPLETED", check.expectedTime || "") }}
                  >
                    {/* Custom radio */}
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition mt-1
                        ${
                          check?.status === "COMPLETED"
                            ? "bg-green-600 border-green-600"
                            : "border-gray-400 group-hover:border-green-400"
                        }`}
                    >
                      {check?.status === "COMPLETED" && (
                        <span className="text-white text-xs"><CircleCheckBig size={22}/></span>
                      )}
                    </div>

                    <div>
                      {/* Title */}
                      {renamingId?.type === "checklist" &&
                      renamingId?.id === Number(check.id) ? (
                        <input
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onBlur={() => {
                            renameTask(check.id, newTitle);
                            setRenamingId(null);
                          }}
                          className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`text-sm block ${
                            check.completedAt
                              ? "line-through text-gray-400"
                              : "text-white"
                          }`}
                        >
                          {check.title}
                        </span>
                      )}

                      {/* Description */}
                      {check.description && (
                        <p className="text-xs text-gray-400">
                          {check.description}
                        </p>
                      )}

                      {/* Expected time */}
                      {check.expectedTime && (
                        <p className="text-xs text-gray-500">
                          ⏱ {check.expectedTime}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ellipsis Menu */}
                  <div className="relative opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() =>
                        setMenuOpen(
                          menuOpen?.id === Number(check.id) &&
                            menuOpen?.type === "checklist"
                            ? null
                            : { type: "checklist", id: Number(check.id) }
                        )
                      }
                    >
                      <MoreVertical className="text-gray-300 w-4 h-4" />
                    </button>
                    {menuOpen?.id === Number(check.id) &&
                      menuOpen?.type === "checklist" && (
                        <div className="absolute right-0 mt-2 w-28 bg-gray-700 text-white rounded shadow-lg z-10">
                          <button
                            onClick={() => {
                              // setRenamingId({
                              //   type: "checklist",
                              //   id: check.id,
                              // });
                              // setNewTitle(check.title);
                              setCurrentTask(check);
                              setOpenEditPopup(true);
                              setMenuOpen(null);
                            }}
                            className="block w-full text-left px-3 py-1 hover:bg-gray-600"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (task.id && check.id) {
                                deleteChecklistItem(task.id, check.id);
                              }
                              setMenuOpen(null);
                            }}
                            className="block w-full text-left px-3 py-1 hover:bg-gray-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <TaskForm />
    </div>
  );
};
