"use client";

import { useState } from "react";
import { useTasks } from "@/context/TaskContext";
import { CheckCircle, Circle, EllipsisVertical } from "lucide-react";

interface TaskListProps {
  tasks: any[];
}
export function TaskList({
  tasks = [],
}: TaskListProps) {
  const {setTasks, toggleStatus, deleteTask, openEditPopup,setOpenEditPopup, currentTask, setCurrentTask } = useTasks();
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {tasks.map((task) => {
        const isCompleted = task?.status === "completed";

        return (
          <div
            key={task?.id || task?.title}
            className="bg-white/10 backdrop-blur-md border border-blue-500/20 rounded-xl p-4 shadow hover:shadow-lg transition relative"
            onMouseEnter={() => setHoveredId(task?.id)}
            onMouseLeave={() => {
              setHoveredId(null);
              setMenuOpenId(null);
            }}
          >
            <div className="flex items-start gap-3">
              {/* Status toggle */}
              <button onClick={() => toggleStatus(task.id)} className="mt-1">
                {isCompleted ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : hoveredId === task.id ? (
                  <CheckCircle className="w-6 h-6 text-gray-400 hover:text-green-500" />
                ) : (
                  <Circle className="w-6 h-6 text-gray-400" />
                )}
              </button>

              {/* Task content */}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3
                    className={`font-semibold ${isCompleted
                        ? "line-through text-gray-400"
                        : "text-white"
                      }`}
                  >
                    {task.title}
                  </h3>

                  {/* Ellipsis menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === task.id ? null : task.id);
                      }}
                      className="p-1 rounded-full hover:bg-gray-700"
                    >
                      <EllipsisVertical className="w-5 h-5 text-gray-400" />
                    </button>

                    {menuOpenId === task.id && (
                      <div className="absolute right-0 mt-1 w-28 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            setCurrentTask(task);
                            setOpenEditPopup(true);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-t-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpenId(null);
                            deleteTask(task.id);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-lg"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {task.description && (
                  <p
                    className={`text-sm ${isCompleted
                        ? "line-through text-gray-400"
                        : "text-gray-300"
                      }`}
                  >
                    {task.description}
                  </p>
                )}

                {(task.startDate || task.startTime) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {task.startDate} {task.startTime}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}