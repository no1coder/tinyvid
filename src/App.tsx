import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Play, XCircle, Trash2, RotateCcw, AlertTriangle, X, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DropZone } from "@/components/import/DropZone";
import { FileTable } from "@/components/import/FileTable";
import { StatsBar } from "@/components/task/StatsBar";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { TaskHistoryPage } from "@/components/task/TaskHistoryPage";
import { useAppStore } from "@/stores/appStore";
import { useTaskStore } from "@/stores/taskStore";
import { useFileImport } from "@/hooks/useFileImport";
import { useCompression } from "@/hooks/useCompression";
import { useHardwareInfo } from "@/hooks/useHardwareInfo";
import { useEstimation } from "@/hooks/useEstimation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";

type Phase = "empty" | "ready" | "running" | "done";

function usePhase(): Phase {
  const { videos, tasks } = useTaskStore();

  return useMemo(() => {
    if (videos.length === 0 && tasks.length === 0) return "empty";
    if (tasks.length === 0) return "ready";

    const hasActive = tasks.some(
      (t) => t.status === "running" || t.status === "pending",
    );
    if (hasActive) return "running";

    return "done";
  }, [videos, tasks]);
}

function CompressorPage() {
  const { t } = useTranslation();
  const phase = usePhase();
  const { videos, tasks, removeVideo, clearVideos } = useTaskStore();
  const { importFiles, isProbing } = useFileImport();
  const {
    isCompressing,
    start,
    retryFailed,
    cancelTask,
    cancelAll,
    clearCompleted,
    showInFolder,
    diskWarning,
    dismissDiskWarning,
  } = useCompression();
  const hasFailed = tasks.some((t) => t.status === "failed");

  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {};

    if (phase === "ready") {
      map["space"] = start;
      map["enter"] = start;
      map["delete"] = clearVideos;
      map["backspace"] = clearVideos;
    }

    if (phase === "running") {
      map["escape"] = cancelAll;
    }

    if (phase === "done") {
      if (hasFailed) {
        map["r"] = retryFailed;
      }
      map["n"] = () => {
        clearCompleted();
        clearVideos();
      };
    }

    return map;
  }, [phase, hasFailed, start, clearVideos, cancelAll, retryFailed, clearCompleted]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex h-full flex-col">
      {/* Disk space warning banner */}
      {diskWarning && (
        <div className="flex animate-slide-in-top items-center gap-2 bg-[#ffcc001a] px-5 py-2 text-xs text-[#ffcc00]">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{diskWarning}</span>
          <button
            onClick={dismissDiskWarning}
            className="rounded p-0.5 transition-colors hover:bg-[#ffcc0033]"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Phase: empty — Full-page DropZone */}
      {phase === "empty" && (
        <div className="flex flex-1 animate-fade-in">
          <DropZone
            onFilesSelected={importFiles}
            disabled={isProbing}
            mode="full"
          />
        </div>
      )}

      {/* Phase: ready — File list + actions */}
      {phase === "ready" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          {/* Toolbar — design: height 40, space-between */}
          <div className="mb-4 flex h-10 items-center justify-between">
            <DropZone
              onFilesSelected={importFiles}
              disabled={isProbing}
              mode="compact"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={clearVideos}
                className="clear-btn flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
              >
                <Trash2 size={14} />
                {t("fileList.clearAll")}
              </button>
              <button
                onClick={start}
                disabled={videos.length === 0 || isCompressing}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
                style={{ boxShadow: "0 2px 8px rgba(10, 132, 255, 0.3)" }}
              >
                <Play size={14} />
                {t("task.start")}
              </button>
            </div>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-auto">
            <FileTable
              videos={videos}
              tasks={tasks}
              phase="ready"
              onRemoveVideo={removeVideo}
              onCancelTask={cancelTask}
              onShowInFolder={showInFolder}
            />
          </div>
        </div>
      )}

      {/* Phase: running — Progress + stats */}
      {phase === "running" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="mb-4 flex h-10 items-center justify-between">
            <StatsBar tasks={tasks} videos={videos} phase="running" />
            <button
              onClick={cancelAll}
              className="cancel-btn ml-4 flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
            >
              <XCircle size={14} />
              {t("task.cancelAll")}
            </button>
          </div>

          {/* File list with progress */}
          <div className="flex-1 overflow-auto">
            <FileTable
              videos={videos}
              tasks={tasks}
              phase="running"
              onRemoveVideo={removeVideo}
              onCancelTask={cancelTask}
              onShowInFolder={showInFolder}
            />
          </div>
        </div>
      )}

      {/* Phase: done — Results */}
      {phase === "done" && (
        <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
          {/* Stats summary */}
          <div className="mb-4 flex h-10 items-center justify-between">
            <StatsBar tasks={tasks} videos={videos} phase="done" />
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
                  clearVideos();
                }}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ boxShadow: "0 2px 8px rgba(10, 132, 255, 0.3)" }}
              >
                <Plus size={14} />
                {t("task.newBatch")}
              </button>
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-auto">
            <FileTable
              videos={videos}
              tasks={tasks}
              phase="done"
              onRemoveVideo={removeVideo}
              onCancelTask={cancelTask}
              onShowInFolder={showInFolder}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  useHardwareInfo();
  useEstimation();
  const { updateInfo, dismissUpdate } = useUpdateCheck();

  const { page } = useAppStore();

  return (
    <AppLayout updateInfo={updateInfo} onDismissUpdate={dismissUpdate}>
      {page === "compressor" && <CompressorPage />}
      {page === "tasks" && <TaskHistoryPage />}
      {page === "settings" && <SettingsPage />}
    </AppLayout>
  );
}
