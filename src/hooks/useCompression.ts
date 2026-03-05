import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  startCompression,
  cancelAll as cancelAllTauri,
  cancelTask as cancelTaskTauri,
  clearCompleted as clearCompletedTauri,
  retryFailed as retryFailedTauri,
  showInFolder as showInFolderTauri,
} from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";
import { useNotification } from "@/hooks/useNotification";
import { useDiskCheck } from "@/hooks/useDiskCheck";
import type { ProgressEvent } from "@/types";

export function useCompression() {
  const { t } = useTranslation();
  const [isCompressing, setIsCompressing] = useState(false);
  const { diskWarning, checkDisk, dismissDiskWarning } = useDiskCheck();
  const totalTasksRef = useRef(0);
  const doneCountRef = useRef(0);
  const completedCountRef = useRef(0);
  const failedCountRef = useRef(0);
  const { videos, setTasks, handleProgressEvent, clearCompletedTasks } =
    useTaskStore();
  const { config } = useSettingsStore();
  const { notify } = useNotification();
  const { addToast } = useAppStore();

  const handleProgress = useCallback(
    (event: ProgressEvent) => {
      handleProgressEvent(event);
      if (
        event.type === "completed" ||
        event.type === "failed" ||
        event.type === "cancelled"
      ) {
        if (event.type === "completed") completedCountRef.current += 1;
        if (event.type === "failed") failedCountRef.current += 1;
        doneCountRef.current += 1;
        if (doneCountRef.current >= totalTasksRef.current) {
          setIsCompressing(false);
          // Send completion notification
          const completed = completedCountRef.current;
          const failed = failedCountRef.current;
          if (completed > 0 || failed > 0) {
            const title =
              failed === 0
                ? t("notification.allCompleted")
                : t("notification.completedWithErrors");
            const body =
              failed === 0
                ? t("notification.completedBody", { count: completed })
                : t("notification.completedWithErrorsBody", {
                    completed,
                    failed,
                  });
            notify(title, body);
          }
        }
      }
    },
    [handleProgressEvent, notify, t],
  );

  const start = useCallback(async () => {
    if (videos.length === 0) return;

    const canProceed = await checkDisk(videos, config.outputDir);
    if (!canProceed) return;

    setIsCompressing(true);
    doneCountRef.current = 0;
    totalTasksRef.current = 0;
    completedCountRef.current = 0;
    failedCountRef.current = 0;

    try {
      const newTasks = await startCompression(videos, config, handleProgress);
      totalTasksRef.current = newTasks.length;
      setTasks(newTasks);
    } catch (err) {
      addToast({ type: "error", message: t("error.compressionFailed", { error: String(err) }) });
      setIsCompressing(false);
    }
  }, [videos, config, setTasks, handleProgress, checkDisk, t, addToast]);

  const retryFailed = useCallback(async () => {
    setIsCompressing(true);
    doneCountRef.current = 0;
    totalTasksRef.current = 0;
    completedCountRef.current = 0;
    failedCountRef.current = 0;

    try {
      const retriedTasks = await retryFailedTauri(config, handleProgress);
      if (retriedTasks.length === 0) {
        setIsCompressing(false);
        return;
      }
      totalTasksRef.current = retriedTasks.length;
      // Update task store: mark retried tasks as pending
      const currentTasks = useTaskStore.getState().tasks;
      const retriedIds = new Set(retriedTasks.map((rt) => rt.id));
      const updatedTasks = currentTasks.map((t) =>
        retriedIds.has(t.id)
          ? { ...t, status: "pending" as const, progress: 0, error: null }
          : t,
      );
      useTaskStore.setState({ tasks: updatedTasks });
    } catch (err) {
      addToast({ type: "error", message: String(err) });
      setIsCompressing(false);
    }
  }, [config, handleProgress, addToast]);

  const cancelTask = useCallback(async (taskId: string) => {
    try {
      await cancelTaskTauri(taskId);
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
  }, [addToast]);

  const cancelAll = useCallback(async () => {
    try {
      await cancelAllTauri();
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    setIsCompressing(false);
  }, [addToast]);

  const clearCompleted = useCallback(async () => {
    try {
      await clearCompletedTauri();
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    clearCompletedTasks();
  }, [clearCompletedTasks, addToast]);

  const showInFolder = useCallback(async (path: string) => {
    try {
      await showInFolderTauri(path);
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
  }, [addToast]);

  return {
    isCompressing,
    diskWarning,
    start,
    retryFailed,
    cancelTask,
    cancelAll,
    clearCompleted,
    showInFolder,
    dismissDiskWarning,
  };
}
