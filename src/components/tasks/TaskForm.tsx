"use client";

import { useState,useEffect } from "react";
import { useTasks } from "@/context/TaskContext";
import { useLoader } from "../common/Loader";

export function TaskForm() {
  const { addTask, openEditPopup, setOpenEditPopup,currentTask,setCurrentTask,editTask } = useTasks();

  useEffect(() => {
    if (currentTask?.id) {
      setTitle(currentTask.title);
      setDescription(currentTask.description || "");
      setStartDate(currentTask.startDate || "");
      setTime(currentTask.startTime || "");
    }
  }, [currentTask]);

  const { showLoader, hideLoader } = useLoader();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [time, setTime] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartDate("");
    setTime("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    showLoader();

    // extend your addTask to also store desc/date/time if needed
    if (currentTask?.id) {
      editTask(currentTask.id, {
        title,
        description,
        startDate,
        startTime: time,
      });
    } else {
      addTask({
        title,
        description,
        startDate,
        startTime: time,
      });
    }

    setTimeout(() => {
      hideLoader();
      setOpenEditPopup(false);
      resetForm();
    }, 1000);
  };

  return (
    <div className="flex justify-end">
      {/* Add Task Button */}
      <button
        onClick={() => setOpenEditPopup(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md"
      >
        Create Task
      </button>

      {/* Popup / Modal */}
      {openEditPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h2 className="text-lg font-semibold mb-4">Create Task</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-500"
                required
              />

              {/* Description */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-500"
              />

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-500"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setOpenEditPopup(false);
                    resetForm();
                  }}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100 text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow"
                >
                  Save
                </button>
              </div>
            </form>

            {/* Close (X) button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
