"use client";

/**
 * src/app/(app)/tasks/page.tsx
 *
 * WHY THIS CHANGED:
 * The old page was an async Server Component that:
 *  1. Called getServerSession() to get the user ID
 *  2. Queried Prisma directly to pre-load tasks as SSR data
 *  3. Passed those tasks to <TaskList existingTasks={tasks} />
 *
 * Now:
 *  - Auth is handled by middleware + AuthProvider (client-side)
 *  - TaskList/TaskContext fetches tasks from FastAPI via apiClient on mount
 *  - existingTasks={[]} means "no SSR pre-load; TaskContext will fetch"
 *
 * TaskList already has client-side fetching via TaskContext — passing an
 * empty array just skips the redundant SSR pre-load. The UX is unchanged
 * (tasks appear after the first client-side fetch, which is fast).
 */

import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskProvider } from "@/context/TaskContext";

export default function TasksPage() {
  return (
    <TaskProvider>
      <div>
        <div className="flex flex-col gap-6 h-full">
          <h1 className="text-2xl font-bold text-cyan-400">📝 Your Tasks</h1>
          <TaskForm />
          <TaskList existingTasks={[]} />
        </div>
      </div>
    </TaskProvider>
  );
}
