import type { RunningTask } from "../../main/types";

interface TaskListProps {
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
  emptyMessage: string;
}

export default function TaskList({ tasks, busyTaskId, onStopTask, emptyMessage }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-copy">{emptyMessage}</p>;
  }

  return (
    <div className="task-list-grid">
      {tasks.map((task) => (
        <article key={task.id} className="task-row">
          <div>
            <strong>{task.label}</strong>
            <p>{new Date(task.startedAt).toLocaleTimeString()}</p>
          </div>
          <button className="ghost-button" disabled={busyTaskId === task.id} onClick={() => void onStopTask(task.id)}>
            {busyTaskId === task.id ? "停止中..." : "停止"}
          </button>
        </article>
      ))}
    </div>
  );
}
