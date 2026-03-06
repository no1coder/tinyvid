import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  addImageTasks,
  runImageCompression,
  cancelAllImages,
  cancelImageTask as cancelImageTaskTauri,
  clearCompletedImages as clearCompletedImagesTauri,
  retryFailedImages as retryFailedImagesTauri,
  showInFolder as showInFolderTauri,
} from "@/lib/tauri";
import { useImageStore } from "@/stores/imageStore";
import { useAppStore } from "@/stores/appStore";
import { useNotification } from "@/hooks/useNotification";
import type { ProgressEvent } from "@/types";

export function useImageCompression() {
  const { t } = useTranslation();
  const [isCompressing, setIsCompressing] = useState(false);
  const totalTasksRef = useRef(0);
  const doneCountRef = useRef(0);
  const completedCountRef = useRef(0);
  const failedCountRef = useRef(0);
  const { images, config, setTasks, handleProgressEvent, clearCompletedTasks } =
    useImageStore();
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
          const completed = completedCountRef.current;
          const failed = failedCountRef.current;
          if (completed > 0 || failed > 0) {
            const title =
              failed === 0
                ? t("image.notification.allCompleted")
                : t("image.notification.completedWithErrors");
            const body =
              failed === 0
                ? t("image.notification.completedBody", { count: completed })
                : t("image.notification.completedWithErrorsBody", {
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
    if (images.length === 0) return;

    setIsCompressing(true);
    doneCountRef.current = 0;
    totalTasksRef.current = 0;
    completedCountRef.current = 0;
    failedCountRef.current = 0;

    try {
      const newTasks = await addImageTasks(images, config);
      totalTasksRef.current = newTasks.length;
      setTasks(newTasks);
      await runImageCompression(config, handleProgress);
    } catch (err) {
      addToast({
        type: "error",
        message: t("image.error.compressionFailed", { error: String(err) }),
      });
      setIsCompressing(false);
    }
  }, [images, config, setTasks, handleProgress, t, addToast]);

  const retryFailed = useCallback(async () => {
    setIsCompressing(true);
    doneCountRef.current = 0;
    totalTasksRef.current = 0;
    completedCountRef.current = 0;
    failedCountRef.current = 0;

    try {
      const retriedTasks = await retryFailedImagesTauri();
      if (retriedTasks.length === 0) {
        setIsCompressing(false);
        return;
      }
      totalTasksRef.current = retriedTasks.length;
      const currentTasks = useImageStore.getState().tasks;
      const retriedIds = new Set(retriedTasks.map((rt) => rt.id));
      const updatedTasks = currentTasks.map((t) =>
        retriedIds.has(t.id)
          ? { ...t, status: "pending" as const, progress: 0, error: null }
          : t,
      );
      useImageStore.setState({ tasks: updatedTasks });
      await runImageCompression(config, handleProgress);
    } catch (err) {
      addToast({ type: "error", message: String(err) });
      setIsCompressing(false);
    }
  }, [config, handleProgress, addToast]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        await cancelImageTaskTauri(taskId);
      } catch (err) {
        addToast({ type: "error", message: String(err) });
      }
    },
    [addToast],
  );

  const cancelAll = useCallback(async () => {
    try {
      await cancelAllImages();
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    setIsCompressing(false);
  }, [addToast]);

  const clearCompleted = useCallback(async () => {
    try {
      await clearCompletedImagesTauri();
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    clearCompletedTasks();
  }, [clearCompletedTasks, addToast]);

  const showInFolder = useCallback(
    async (path: string) => {
      try {
        await showInFolderTauri(path);
      } catch (err) {
        addToast({ type: "error", message: String(err) });
      }
    },
    [addToast],
  );

  return {
    isCompressing,
    start,
    retryFailed,
    cancelTask,
    cancelAll,
    clearCompleted,
    showInFolder,
  };
}
