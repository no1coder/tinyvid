import { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Play,
  XCircle,
  Trash2,
  RotateCcw,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { SUPPORTED_IMAGE_FORMATS } from "@/lib/constants";
import { useImageStore } from "@/stores/imageStore";
import { useImageImport } from "@/hooks/useImageImport";
import { useImageCompression } from "@/hooks/useImageCompression";
import { ImageFileTable } from "./ImageFileTable";
import { ImageSettings } from "./ImageSettings";

type Phase = "empty" | "ready" | "running" | "done";

function usePhase(): Phase {
  const { images, tasks } = useImageStore();

  return useMemo(() => {
    if (images.length === 0 && tasks.length === 0) return "empty";
    if (tasks.length === 0) return "ready";

    const hasActive = tasks.some(
      (t) => t.status === "running" || t.status === "pending",
    );
    if (hasActive) return "running";

    return "done";
  }, [images, tasks]);
}

export function ImagePage() {
  const { t } = useTranslation();
  const phase = usePhase();
  const { images, tasks, removeImage, clearImages } = useImageStore();
  const { importFiles, isProbing } = useImageImport();
  const {
    isCompressing,
    start,
    retryFailed,
    cancelTask,
    cancelAll,
    clearCompleted,
    showInFolder,
  } = useImageCompression();
  const hasFailed = tasks.some((t) => t.status === "failed");

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isProbing) return;

      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => !!p);

      if (paths.length > 0) {
        importFiles(paths);
      }
    },
    [isProbing, importFiles],
  );

  const handleBrowseFiles = async () => {
    if (isProbing) return;
    const result = await open({
      multiple: true,
      filters: [
        { name: "Images", extensions: [...SUPPORTED_IMAGE_FORMATS] },
      ],
    });
    if (result) {
      importFiles(Array.isArray(result) ? result : [result]);
    }
  };

  // Stats for running/done phases
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalSaved = tasks.reduce((acc, t) => {
    if (t.status === "completed" && t.outputSize) {
      return acc + (t.inputSize - t.outputSize);
    }
    return acc;
  }, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Phase: empty — Full-page DropZone */}
      {phase === "empty" && (
        <div className="flex flex-1 animate-fade-in">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseFiles}
            className={`flex h-full w-full flex-col items-center justify-center rounded-[20px] transition-all ${
              isDragging ? "glass-dropzone-active" : "glass-dropzone"
            } ${isProbing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            style={{ gap: 24 }}
          >
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#0a84ff26]">
              <ImageIcon size={32} className="text-primary" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-[20px] font-semibold">
                {isDragging
                  ? t("image.dropzone.dragging")
                  : t("image.dropzone.title")}
              </p>
              <p className="text-[14px] text-muted-foreground">
                {t("image.dropzone.subtitle")}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseFiles();
              }}
              disabled={isProbing}
              className="rounded-[10px] bg-primary px-6 py-3 text-[14px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ boxShadow: "0 4px 12px #0a84ff4d" }}
            >
              {t("image.dropzone.browse")}
            </button>
          </div>
        </div>
      )}

      {/* Phase: ready — File list + settings + actions */}
      {phase === "ready" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          <div className="mb-4 flex h-10 items-center justify-between">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <button
                onClick={handleBrowseFiles}
                disabled={isProbing}
                className="compact-add-btn flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all hover:brightness-125"
              >
                <Plus size={16} />
                {t("image.dropzone.addMore")}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearImages}
                className="clear-btn flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
              >
                <Trash2 size={14} />
                {t("fileList.clearAll")}
              </button>
              <button
                onClick={start}
                disabled={images.length === 0 || isCompressing}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                style={{ boxShadow: "0 2px 8px rgba(10, 132, 255, 0.3)" }}
              >
                <Play size={14} />
                {t("image.task.start")}
              </button>
            </div>
          </div>

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <ImageFileTable
                images={images}
                tasks={tasks}
                phase="ready"
                onRemoveImage={removeImage}
                onCancelTask={cancelTask}
                onShowInFolder={showInFolder}
              />
            </div>
            <ImageSettings />
          </div>
        </div>
      )}

      {/* Phase: running — Progress */}
      {phase === "running" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          <div className="mb-4 flex h-10 items-center justify-between">
            <span className="text-[13px] text-muted-foreground">
              {t("image.stats.compressing", {
                current: completedCount,
                total: tasks.length,
              })}
            </span>
            <button
              onClick={cancelAll}
              className="cancel-btn ml-4 flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
            >
              <XCircle size={14} />
              {t("task.cancelAll")}
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <ImageFileTable
              images={images}
              tasks={tasks}
              phase="running"
              onRemoveImage={removeImage}
              onCancelTask={cancelTask}
              onShowInFolder={showInFolder}
            />
          </div>
        </div>
      )}

      {/* Phase: done — Results */}
      {phase === "done" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          <div className="mb-4 flex h-10 items-center justify-between">
            <div className="flex items-center gap-3 text-[13px]">
              <span className="text-green-400">
                {t("image.stats.successCount", { count: completedCount })}
              </span>
              {totalSaved > 0 && (
                <span className="text-muted-foreground">
                  {t("image.stats.totalSaved", {
                    size:
                      totalSaved > 1024 * 1024
                        ? `${(totalSaved / (1024 * 1024)).toFixed(1)} MB`
                        : `${(totalSaved / 1024).toFixed(1)} KB`,
                  })}
                </span>
              )}
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              {hasFailed && (
                <button
                  onClick={retryFailed}
                  className="glass-btn flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-[#ffcc00] transition-all"
                >
                  <RotateCcw size={14} />
                  {t("task.retryFailed")}
                </button>
              )}
              <button
                onClick={clearCompleted}
                className="outline-btn flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
              >
                <Trash2 size={14} />
                {t("task.clearCompleted")}
              </button>
              <button
                onClick={() => {
                  clearCompleted();
                  clearImages();
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ boxShadow: "0 2px 8px rgba(10, 132, 255, 0.3)" }}
              >
                <Plus size={14} />
                {t("task.newBatch")}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <ImageFileTable
              images={images}
              tasks={tasks}
              phase="done"
              onRemoveImage={removeImage}
              onCancelTask={cancelTask}
              onShowInFolder={showInFolder}
            />
          </div>
        </div>
      )}
    </div>
  );
}
