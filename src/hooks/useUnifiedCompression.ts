import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  startCompression,
  cancelAll as cancelAllVideoTauri,
  cancelTask as cancelVideoTaskTauri,
  clearCompleted as clearCompletedVideoTauri,
  retryFailed as retryFailedVideoTauri,
  addImageTasks,
  runImageCompression,
  cancelAllImages as cancelAllImagesTauri,
  cancelImageTask as cancelImageTaskTauri,
  clearCompletedImages as clearCompletedImagesTauri,
  retryFailedImages as retryFailedImagesTauri,
  showInFolder as showInFolderTauri,
} from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { useImageStore } from "@/stores/imageStore";
import { useUnifiedStore } from "@/stores/unifiedStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";
import { useNotification } from "@/hooks/useNotification";
import { useDiskCheck } from "@/hooks/useDiskCheck";
import type { ProgressEvent } from "@/types";

export function useUnifiedCompression() {
  const { t } = useTranslation();
  const [isCompressing, setIsCompressing] = useState(false);
  const { diskWarning, checkDisk, dismissDiskWarning } = useDiskCheck();
  const { notify } = useNotification();
  const { addToast } = useAppStore();
  const { registerTaskTypes, getTaskType } = useUnifiedStore();

  // Counters for completion tracking
  const totalTasksRef = useRef(0);
  const doneCountRef = useRef(0);
  const completedCountRef = useRef(0);
  const failedCountRef = useRef(0);

  const videoStore = useTaskStore;
  const imageStore = useImageStore;

  const videos = useTaskStore((s) => s.videos);
  const images = useImageStore((s) => s.images);
  const imageConfig = useImageStore((s) => s.config);
  const { config: videoConfig } = useSettingsStore();

  const resetCounters = () => {
    totalTasksRef.current = 0;
    doneCountRef.current = 0;
    completedCountRef.current = 0;
    failedCountRef.current = 0;
  };

  const checkAllDone = useCallback(() => {
    if (doneCountRef.current >= totalTasksRef.current) {
      setIsCompressing(false);
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
            : t("notification.completedWithErrorsBody", { completed, failed });
        notify(title, body);
      }
    }
  }, [notify, t]);

  const handleVideoProgress = useCallback(
    (event: ProgressEvent) => {
      videoStore.getState().handleProgressEvent(event);
      if (
        event.type === "completed" ||
        event.type === "failed" ||
        event.type === "cancelled"
      ) {
        if (event.type === "completed") completedCountRef.current += 1;
        if (event.type === "failed") failedCountRef.current += 1;
        doneCountRef.current += 1;
        checkAllDone();
      }
    },
    [checkAllDone],
  );

  const handleImageProgress = useCallback(
    (event: ProgressEvent) => {
      imageStore.getState().handleProgressEvent(event);
      if (
        event.type === "completed" ||
        event.type === "failed" ||
        event.type === "cancelled"
      ) {
        if (event.type === "completed") completedCountRef.current += 1;
        if (event.type === "failed") failedCountRef.current += 1;
        doneCountRef.current += 1;
        checkAllDone();
      }
    },
    [checkAllDone],
  );

  const start = useCallback(async () => {
    const hasVideos = videos.length > 0;
    const hasImages = images.length > 0;
    if (!hasVideos && !hasImages) return;

    // Disk check for videos
    if (hasVideos) {
      const canProceed = await checkDisk(videos, videoConfig.outputDir);
      if (!canProceed) return;
    }

    setIsCompressing(true);
    resetCounters();

    try {
      const promises: Promise<void>[] = [];

      if (hasVideos) {
        promises.push(
          startCompression(videos, videoConfig, handleVideoProgress).then(
            (newTasks) => {
              totalTasksRef.current += newTasks.length;
              registerTaskTypes(
                newTasks.map((t) => t.id),
                "video",
              );
              videoStore.getState().setTasks(newTasks);
            },
          ),
        );
      }

      if (hasImages) {
        // Two-phase: add tasks first so store has entries before progress events arrive
        const newImageTasks = await addImageTasks(images, imageConfig);
        totalTasksRef.current += newImageTasks.length;
        registerTaskTypes(
          newImageTasks.map((t) => t.id),
          "image",
        );
        imageStore.getState().setTasks(newImageTasks);
        // Now start compression — channel events will find tasks in store
        promises.push(
          runImageCompression(imageConfig, handleImageProgress),
        );
      }

      await Promise.all(promises);

      // Edge case: if no tasks were created
      if (totalTasksRef.current === 0) {
        setIsCompressing(false);
      }
    } catch (err) {
      addToast({
        type: "error",
        message: t("error.compressionFailed", { error: String(err) }),
      });
      setIsCompressing(false);
    }
  }, [
    videos,
    images,
    videoConfig,
    imageConfig,
    checkDisk,
    handleVideoProgress,
    handleImageProgress,
    registerTaskTypes,
    addToast,
    t,
  ]);

  const retryFailed = useCallback(async () => {
    setIsCompressing(true);
    resetCounters();

    try {
      const promises: Promise<void>[] = [];

      const videoHasFailed = videoStore
        .getState()
        .tasks.some((t) => t.status === "failed");
      const imageHasFailed = imageStore
        .getState()
        .tasks.some((t) => t.status === "failed");

      if (videoHasFailed) {
        promises.push(
          retryFailedVideoTauri(videoConfig, handleVideoProgress).then(
            (retriedTasks) => {
              if (retriedTasks.length === 0) return;
              totalTasksRef.current += retriedTasks.length;
              registerTaskTypes(
                retriedTasks.map((t) => t.id),
                "video",
              );
              const currentTasks = videoStore.getState().tasks;
              const retriedIds = new Set(retriedTasks.map((rt) => rt.id));
              const updatedTasks = currentTasks.map((t) =>
                retriedIds.has(t.id)
                  ? {
                      ...t,
                      status: "pending" as const,
                      progress: 0,
                      error: null,
                    }
                  : t,
              );
              videoStore.setState({ tasks: updatedTasks });
            },
          ),
        );
      }

      if (imageHasFailed) {
        const retriedTasks = await retryFailedImagesTauri();
        if (retriedTasks.length > 0) {
          totalTasksRef.current += retriedTasks.length;
          registerTaskTypes(
            retriedTasks.map((t) => t.id),
            "image",
          );
          const currentTasks = imageStore.getState().tasks;
          const retriedIds = new Set(retriedTasks.map((rt) => rt.id));
          const updatedTasks = currentTasks.map((t) =>
            retriedIds.has(t.id)
              ? {
                  ...t,
                  status: "pending" as const,
                  progress: 0,
                  error: null,
                }
              : t,
          );
          imageStore.setState({ tasks: updatedTasks });
          promises.push(
            runImageCompression(imageConfig, handleImageProgress),
          );
        }
      }

      await Promise.all(promises);

      if (totalTasksRef.current === 0) {
        setIsCompressing(false);
      }
    } catch (err) {
      addToast({ type: "error", message: String(err) });
      setIsCompressing(false);
    }
  }, [
    videoConfig,
    imageConfig,
    handleVideoProgress,
    handleImageProgress,
    registerTaskTypes,
    addToast,
  ]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        const type = getTaskType(taskId);
        if (type === "image") {
          await cancelImageTaskTauri(taskId);
        } else {
          await cancelVideoTaskTauri(taskId);
        }
      } catch (err) {
        addToast({ type: "error", message: String(err) });
      }
    },
    [getTaskType, addToast],
  );

  const cancelAll = useCallback(async () => {
    try {
      await Promise.all([cancelAllVideoTauri(), cancelAllImagesTauri()]);
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    setIsCompressing(false);
  }, [addToast]);

  const clearCompleted = useCallback(async () => {
    try {
      await Promise.all([
        clearCompletedVideoTauri(),
        clearCompletedImagesTauri(),
      ]);
    } catch (err) {
      addToast({ type: "error", message: String(err) });
    }
    videoStore.getState().clearCompletedTasks();
    imageStore.getState().clearCompletedTasks();
  }, [addToast]);

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
