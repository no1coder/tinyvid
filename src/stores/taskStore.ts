import { create } from "zustand";
import type { TaskInfo, ProgressEvent, VideoInfo } from "@/types";

interface TaskState {
  videos: VideoInfo[];
  tasks: TaskInfo[];
  addVideos: (newVideos: VideoInfo[]) => void;
  removeVideo: (path: string) => void;
  clearVideos: () => void;
  setTasks: (tasks: TaskInfo[]) => void;
  handleProgressEvent: (event: ProgressEvent) => void;
  removeTask: (taskId: string) => void;
  clearCompletedTasks: () => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  videos: [],
  tasks: [],

  addVideos: (newVideos) =>
    set((state) => {
      // Deduplicate by path
      const existingPaths = new Set(state.videos.map((v) => v.path));
      const unique = newVideos.filter((v) => !existingPaths.has(v.path));
      return { videos: [...state.videos, ...unique] };
    }),

  removeVideo: (path) =>
    set((state) => ({
      videos: state.videos.filter((v) => v.path !== path),
    })),

  clearVideos: () => set({ videos: [] }),

  setTasks: (tasks) =>
    set((state) => ({
      tasks: [...state.tasks, ...tasks],
    })),

  handleProgressEvent: (event) =>
    set((state) => {
      const updatedTasks = state.tasks.map((task) => {
        if (task.id !== event.taskId) return task;

        switch (event.type) {
          case "started":
            return { ...task, status: "running" as const, progress: 0 };
          case "progress":
            return {
              ...task,
              status: "running" as const,
              progress: event.percent ?? task.progress,
            };
          case "completed":
            return {
              ...task,
              status: "completed" as const,
              progress: 100,
              outputPath: event.outputPath ?? task.outputPath,
              outputSize: event.outputSize ?? null,
            };
          case "failed":
            return {
              ...task,
              status: "failed" as const,
              error: event.error ?? "Unknown error",
            };
          case "cancelled":
            return { ...task, status: "cancelled" as const };
          default:
            return task;
        }
      });
      return { tasks: updatedTasks };
    }),

  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    })),

  clearCompletedTasks: () =>
    set((state) => ({
      tasks: state.tasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          t.status !== "failed",
      ),
    })),
}));
