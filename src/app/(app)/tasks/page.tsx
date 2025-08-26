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
          <TaskList />
        </div>
      </div>
    </TaskProvider>
  );
}
