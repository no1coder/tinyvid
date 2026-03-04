import { useTranslation } from "react-i18next";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Ban,
  AlertCircle,
} from "lucide-react";
import type { TaskInfo } from "@/types";
import { formatFileSize, formatCompressionRatio } from "@/lib/format";
import { TaskProgress } from "./TaskProgress";

interface TaskCardProps {
  task: TaskInfo;
}

const statusIcons = {
  pending: Clock,
  running: Loader2,
  paused: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
};

const statusColors = {
  pending: "text-muted-foreground",
  running: "text-primary",
  paused: "text-yellow-500",
  completed: "text-green-500",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

export function TaskCard({ task }: TaskCardProps) {
  const { t } = useTranslation();
  const Icon = statusIcons[task.status] || AlertCircle;
  const colorClass = statusColors[task.status] || "text-muted-foreground";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            size={14}
            className={`shrink-0 ${colorClass} ${task.status === "running" ? "animate-spin" : ""}`}
          />
          <span className="truncate text-xs font-medium">
            {task.fileName}
          </span>
        </div>
        <span className={`shrink-0 text-[10px] font-medium ${colorClass}`}>
          {t(`task.status.${task.status}`)}
        </span>
      </div>

      {(task.status === "running" || task.status === "completed") && (
        <TaskProgress percent={task.progress} status={task.status} />
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatFileSize(task.inputSize)}</span>
        {task.status === "running" && (
          <span>{task.progress.toFixed(1)}%</span>
        )}
        {task.status === "completed" && task.outputSize != null && (
          <span>
            {formatFileSize(task.outputSize)} (
            {formatCompressionRatio(task.inputSize, task.outputSize)}{" "}
            saved)
          </span>
        )}
        {task.status === "failed" && task.error && (
          <span className="text-destructive truncate max-w-[200px]">
            {task.error}
          </span>
        )}
      </div>
    </div>
  );
}
