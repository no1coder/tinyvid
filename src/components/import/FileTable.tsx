import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { X, XCircle, AlertCircle, FolderOpen, FileVideo } from "lucide-react";
import type { VideoInfo, TaskInfo } from "@/types";
import { formatFileSize, formatETA } from "@/lib/format";

type Phase = "empty" | "ready" | "running" | "done";

interface FileTableProps {
  videos: VideoInfo[];
  tasks: TaskInfo[];
  phase: Phase;
  onRemoveVideo: (path: string) => void;
  onCancelTask: (taskId: string) => void;
  onShowInFolder?: (path: string) => void;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="progress-track h-[6px] w-full rounded-full">
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, percent)}%` }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

const ROW_HEIGHT = 72;
const VIRTUALIZE_THRESHOLD = 25;

export function FileTable({
  videos,
  tasks,
  phase,
  onRemoveVideo,
  onCancelTask,
  onShowInFolder,
}: FileTableProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = videos.map((video) => {
    const task = tasks.find((tk) => tk.inputPath === video.path);
    return { video, task };
  });

  const useVirtual = rows.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  if (rows.length === 0) return null;

  const renderRow = (video: VideoInfo, task: TaskInfo | undefined, index: number) => {
    const isRunning = task?.status === "running";
    const isCompleted = task?.status === "completed";
    const isFailed = task?.status === "failed";
    const isCancelled = task?.status === "cancelled";
    const isPending = !task || task.status === "pending";
    const savedPercent =
      isCompleted && task.outputSize !== null && video.size > 0
        ? ((1 - task.outputSize / video.size) * 100).toFixed(0)
        : null;

    // Design spec row backgrounds:
    // Running: #0a84ff0d + #0a84ff4d border, height 72
    // Done: #34c7590d + #34c75933 border
    // First row: #ffffff0d + #ffffff1a border
    // Other rows: #ffffff05
    const isFirstRow = index === 0;
    const rowBg = isRunning
      ? "file-row-active"
      : isCompleted
        ? "file-row-done"
        : isFirstRow
          ? "file-row-primary"
          : "file-row";

    const rowHeight = isRunning ? "h-[72px]" : "h-16";

    // Icon background per state: running=blue, done=green, default=white
    const iconBgClass = isRunning
      ? "icon-bg-active"
      : isCompleted
        ? "icon-bg-done"
        : "bg-[#ffffff1a]";

    // Icon color per state
    const iconColorClass = isRunning
      ? "text-primary"
      : isCompleted
        ? "text-success"
        : "opacity-80";

    return (
      <div className={`${rowBg} flex ${rowHeight} items-center gap-4 rounded-[10px] px-4 transition-all`}>
        {/* File icon */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}>
          <FileVideo size={20} className={iconColorClass} />
        </div>

        {/* File info + progress */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[14px] font-medium leading-tight" title={video.fileName}>
            {video.fileName}
          </span>
          {isRunning ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <ProgressBar percent={task.progress} />
                </div>
                <span className="shrink-0 text-[11px] font-mono font-medium text-primary">
                  {task.progress.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {task.speed > 0 && (
                  <span>{t("task.speed", { speed: task.speed.toFixed(1) })}</span>
                )}
                {task.eta > 0 && (
                  <span>{t("task.eta", { time: formatETA(task.eta) })}</span>
                )}
              </div>
            </div>
          ) : isCompleted && task.outputSize !== null ? (
            <span className="text-[12px] text-success">
              {formatFileSize(video.size)} ➔ {formatFileSize(task.outputSize)}
              {savedPercent !== null && ` (-${savedPercent}%)`}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground">
              {formatFileSize(video.size)} • {video.width}x{video.height}
              {isFailed && task.error && (
                <span className="text-destructive"> · {task.error}</span>
              )}
            </span>
          )}
        </div>

        {/* Status badge */}
        {isPending && !task && phase === "ready" && (
          <span className="badge-ready shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            Ready
          </span>
        )}
        {isPending && task && (
          <span className="badge-ready shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            Ready
          </span>
        )}
        {isCompleted && (
          <span className="badge-success shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            Done
          </span>
        )}
        {isFailed && (
          <span className="badge-error shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" title={task.error ?? undefined}>
            <XCircle size={10} className="mr-0.5 inline" /> Failed
          </span>
        )}
        {isCancelled && (
          <span className="badge-cancelled shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
            <AlertCircle size={10} className="mr-0.5 inline" /> Cancelled
          </span>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isPending && !task && (
            <button
              onClick={() => onRemoveVideo(video.path)}
              className="row-action-btn rounded-md p-2 transition-all"
            >
              <X size={14} className="opacity-60" />
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => task && onCancelTask(task.id)}
              className="row-action-btn rounded-md p-2 transition-all"
            >
              <X size={14} className="opacity-60" />
            </button>
          )}
          {isCompleted && task?.outputPath && onShowInFolder && (
            <button
              onClick={() => onShowInFolder(task.outputPath)}
              className="row-action-btn rounded-md p-2 text-muted-foreground transition-all hover:text-primary"
              title={t("task.showInFolder")}
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={scrollRef} className="flex flex-col gap-2 overflow-auto">
      {useVirtual ? (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { video, task } = rows[virtualRow.index];
            return (
              <div
                key={video.path}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                }}
              >
                {renderRow(video, task, virtualRow.index)}
              </div>
            );
          })}
        </div>
      ) : (
        rows.map(({ video, task }, index) => (
          <div key={video.path}>{renderRow(video, task, index)}</div>
        ))
      )}
    </div>
  );
}
