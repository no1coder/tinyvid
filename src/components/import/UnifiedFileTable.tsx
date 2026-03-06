import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  X,
  XCircle,
  AlertCircle,
  FolderOpen,
  FileVideo,
  Image as ImageIcon,
} from "lucide-react";
import type { UnifiedFileItem, TaskInfo } from "@/types";
import { formatFileSize, formatETA } from "@/lib/format";

type Phase = "empty" | "ready" | "running" | "done";

interface UnifiedFileTableProps {
  items: UnifiedFileItem[];
  tasks: TaskInfo[];
  phase: Phase;
  onRemoveItem: (path: string) => void;
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

function formatDimensions(w: number, h: number): string {
  return `${w}×${h}`;
}

const ROW_HEIGHT = 72;
const VIRTUALIZE_THRESHOLD = 25;

export function UnifiedFileTable({
  items,
  tasks,
  phase,
  onRemoveItem,
  onCancelTask,
  onShowInFolder,
}: UnifiedFileTableProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a task lookup by input path
  const taskByPath = new Map<string, TaskInfo>();
  for (const task of tasks) {
    taskByPath.set(task.inputPath, task);
  }

  const rows = items.map((item) => ({
    item,
    task: taskByPath.get(item.path),
  }));

  const useVirtual = rows.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  if (rows.length === 0) return null;

  const renderRow = (
    item: UnifiedFileItem,
    task: TaskInfo | undefined,
    index: number,
  ) => {
    const isVideo = item.type === "video";
    const isRunning = task?.status === "running";
    const isCompleted = task?.status === "completed";
    const isFailed = task?.status === "failed";
    const isCancelled = task?.status === "cancelled";
    const isPending = !task || task.status === "pending";
    const savedPercent =
      isCompleted && task.outputSize !== null && item.size > 0
        ? ((1 - task.outputSize / item.size) * 100).toFixed(0)
        : null;

    const isFirstRow = index === 0;
    const rowBg = isRunning
      ? "file-row-active"
      : isCompleted
        ? "file-row-done"
        : isFirstRow
          ? "file-row-primary"
          : "file-row";

    const rowHeight = isRunning ? "h-[72px]" : "h-16";

    const iconBgClass = isRunning
      ? "icon-bg-active"
      : isCompleted
        ? "icon-bg-done"
        : "bg-[#ffffff1a]";

    const iconColorClass = isRunning
      ? "text-primary"
      : isCompleted
        ? "text-success"
        : "opacity-80";

    // Metadata line varies by type
    const metaLine = isVideo
      ? (() => {
          const v = item.videoInfo;
          if (!v) return formatFileSize(item.size);
          return `${formatFileSize(v.size)} • ${v.width}x${v.height} • ${v.codec.toUpperCase()}`;
        })()
      : (() => {
          const img = item.imageInfo;
          if (!img) return formatFileSize(item.size);
          return `${img.format.toUpperCase()} • ${formatDimensions(img.width, img.height)} • ${formatFileSize(img.size)}`;
        })();

    // Icon component
    const IconComponent = isVideo ? FileVideo : ImageIcon;

    return (
      <div
        className={`${rowBg} flex ${rowHeight} items-center gap-4 rounded-[10px] px-4 transition-all`}
      >
        {/* File icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBgClass}`}
        >
          <IconComponent size={20} className={iconColorClass} />
        </div>

        {/* File info + progress */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className="truncate text-[14px] font-medium leading-tight"
            title={item.fileName}
          >
            {item.fileName}
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
              {isVideo && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {task.speed > 0 && (
                    <span>
                      {t("task.speed", { speed: task.speed.toFixed(1) })}
                    </span>
                  )}
                  {task.eta > 0 && (
                    <span>{t("task.eta", { time: formatETA(task.eta) })}</span>
                  )}
                </div>
              )}
            </div>
          ) : isCompleted && task.outputSize !== null ? (
            <span className="text-[12px] text-success">
              {formatFileSize(item.size)} ➔ {formatFileSize(task.outputSize)}
              {savedPercent !== null && ` (-${savedPercent}%)`}
            </span>
          ) : (
            <span className="text-[12px] text-muted-foreground">
              {metaLine}
              {isFailed && task?.error && (
                <span className="text-destructive"> · {task.error}</span>
              )}
            </span>
          )}
        </div>

        {/* Status badge */}
        {isPending && !task && phase === "ready" && (
          <span className="badge-ready shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            {t("status.ready")}
          </span>
        )}
        {isPending && task && (
          <span className="badge-ready shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            {t("status.ready")}
          </span>
        )}
        {isCompleted && (
          <span className="badge-success shrink-0 rounded px-2 py-1 text-[11px] font-semibold">
            {t("status.done")}
          </span>
        )}
        {isFailed && (
          <span
            className="badge-error shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            title={task.error ?? undefined}
          >
            <XCircle size={10} className="mr-0.5 inline" /> {t("status.failed")}
          </span>
        )}
        {isCancelled && (
          <span className="badge-cancelled shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
            <AlertCircle size={10} className="mr-0.5 inline" /> {t("status.cancelled")}
          </span>
        )}

        {/* Type indicator badge */}
        {phase === "ready" && (
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
            {isVideo ? t("mediaType.video") : t("mediaType.image")}
          </span>
        )}

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isPending && !task && (
            <button
              onClick={() => onRemoveItem(item.path)}
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
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { item, task } = rows[virtualRow.index];
            return (
              <div
                key={item.path}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                }}
              >
                {renderRow(item, task, virtualRow.index)}
              </div>
            );
          })}
        </div>
      ) : (
        rows.map(({ item, task }, index) => (
          <div key={item.path}>{renderRow(item, task, index)}</div>
        ))
      )}
    </div>
  );
}
