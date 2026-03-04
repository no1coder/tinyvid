import { useState, useCallback } from "react";
import {
  startCompression,
  cancelAll as cancelAllTauri,
  clearCompleted as clearCompletedTauri,
} from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function useCompression() {
  const [isCompressing, setIsCompressing] = useState(false);
  const { videos, setTasks, handleProgressEvent, clearCompletedTasks } =
    useTaskStore();
  const { config } = useSettingsStore();

  const start = useCallback(async () => {
    if (videos.length === 0) return;
    setIsCompressing(true);
    try {
      const tasks = await startCompression(videos, config, (event) => {
        handleProgressEvent(event);
        // Check if all tasks are done
        if (event.type === "completed" || event.type === "failed" || event.type === "cancelled") {
          // We'll let the task list update naturally
        }
      });
      setTasks(tasks);
    } catch (err) {
      console.error("Compression failed:", err);
      setIsCompressing(false);
    }
  }, [videos, config, setTasks, handleProgressEvent]);

  const cancelAll = useCallback(async () => {
    try {
      await cancelAllTauri();
    } catch (err) {
      console.error("Cancel failed:", err);
    }
    setIsCompressing(false);
  }, []);

  const clearCompleted = useCallback(async () => {
    try {
      await clearCompletedTauri();
    } catch (err) {
      console.error("Clear failed:", err);
    }
    clearCompletedTasks();
  }, [clearCompletedTasks]);

  return { isCompressing, start, cancelAll, clearCompleted };
}
