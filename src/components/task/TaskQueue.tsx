import { useTranslation } from "react-i18next";
import { Play, XCircle, Trash2 } from "lucide-react";
import type { TaskInfo, VideoInfo, CompressionConfig, ProgressEvent } from "@/types";
import { TaskCard } from "./TaskCard";

interface TaskQueueProps {
  tasks: TaskInfo[];
  videos: VideoInfo[];
  isCompressing: boolean;
  onStart: () => void;
  onCancelAll: () => void;
  onClearCompleted: () => void;
}

export function TaskQueue({
  tasks,
  videos,
  isCompressing,
  onStart,
  onCancelAll,
  onClearCompleted,
}: TaskQueueProps) {
  const { t } = useTranslation();

  const hasCompleted = tasks.some(
    (t) => t.status === "completed" || t.status === "failed" || t.status === "cancelled",
  );
  const canStart = videos.length > 0 && !isCompressing;

  return (
    <div className="flex flex-col gap-3">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onStart}
          disabled={!canStart}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play size={14} />
          {t("task.start")}
        </button>
        {isCompressing && (
          <button
            onClick={onCancelAll}
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            <XCircle size={14} />
            {t("task.cancelAll")}
          </button>
        )}
        {hasCompleted && (
          <button
            onClick={onClearCompleted}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Trash2 size={14} />
            {t("task.clearCompleted")}
          </button>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
          {t("task.noTasks")}
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
