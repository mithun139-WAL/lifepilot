import { TaskList } from "@/components/tasks/TaskList";
import { TaskForm } from "@/components/tasks/TaskForm";

export default function TasksPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 h-full">
        <h1 className="text-2xl font-bold text-cyan-400">📝 Your Tasks</h1>

        <TaskForm />

        <TaskList />
      </div>
    </div>
  );
}
