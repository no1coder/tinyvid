import { useTranslation } from "react-i18next";
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  Image as ImageIcon,
  FolderOpen,
} from "lucide-react";
import type { ImageInfo, TaskInfo } from "@/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(w: number, h: number): string {
  return `${w}x${h}`;
}

interface ImageFileTableProps {
  images: ImageInfo[];
  tasks: TaskInfo[];
  phase: "ready" | "running" | "done";
  onRemoveImage: (path: string) => void;
  onCancelTask: (taskId: string) => void;
  onShowInFolder: (path: string) => void;
}

export function ImageFileTable({
  images,
  tasks,
  phase,
  onRemoveImage,
  onCancelTask,
  onShowInFolder,
}: ImageFileTableProps) {
  const { t } = useTranslation();

  // Map tasks by input path for lookup
  const taskByPath = new Map<string, TaskInfo>();
  for (const task of tasks) {
    taskByPath.set(task.inputPath, task);
  }

  const items = images.map((img) => ({
    image: img,
    task: taskByPath.get(img.path),
  }));

  return (
    <div className="flex flex-col gap-1">
      {items.map(({ image, task }) => (
        <div
          key={image.path}
          className="glass-row flex items-center gap-3 rounded-lg px-3 py-2 transition-all"
        >
          {/* Format icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
            <ImageIcon size={16} className="text-muted-foreground" />
          </div>

          {/* File info */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[12px] font-medium text-foreground">
              {image.fileName}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{image.format.toUpperCase()}</span>
              <span>{formatDimensions(image.width, image.height)}</span>
              <span>{formatSize(image.size)}</span>
            </div>
          </div>

          {/* Status / action area */}
          {phase === "ready" && (
            <button
              onClick={() => onRemoveImage(image.path)}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}

          {phase === "running" && task && (
            <div className="flex items-center gap-2">
              {task.status === "running" && (
                <Loader2
                  size={14}
                  className="animate-spin text-primary"
                />
              )}
              {task.status === "pending" && (
                <span className="text-[10px] text-muted-foreground">
                  {t("image.status.pending")}
                </span>
              )}
              {task.status === "completed" && (
                <CheckCircle2 size={14} className="text-green-400" />
              )}
              {task.status === "failed" && (
                <XCircle size={14} className="text-red-400" />
              )}
              {task.status === "cancelled" && (
                <XCircle size={14} className="text-muted-foreground" />
              )}
              {(task.status === "running" || task.status === "pending") && (
                <button
                  onClick={() => onCancelTask(task.id)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {phase === "done" && task && (
            <div className="flex items-center gap-2">
              {task.status === "completed" && (
                <>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-green-400">
                      {task.outputSize
                        ? formatSize(task.outputSize)
                        : "—"}
                    </span>
                    {task.outputSize && (
                      <span className="text-[9px] text-muted-foreground">
                        {(
                          ((image.size - task.outputSize) / image.size) *
                          100
                        ).toFixed(1)}
                        % {t("image.stats.saved")}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onShowInFolder(task.outputPath)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                    title={t("task.showInFolder")}
                  >
                    <FolderOpen size={14} />
                  </button>
                </>
              )}
              {task.status === "failed" && (
                <span
                  className="max-w-[120px] truncate text-[10px] text-red-400"
                  title={task.error ?? ""}
                >
                  {task.error ?? t("image.status.failed")}
                </span>
              )}
              {task.status === "cancelled" && (
                <span className="text-[10px] text-muted-foreground">
                  {t("image.status.cancelled")}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
