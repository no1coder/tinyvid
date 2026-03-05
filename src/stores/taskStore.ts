import { create } from "zustand";
import type {
  TaskInfo,
  ProgressEvent,
  VideoInfo,
  CompressionConfig,
  EncoderInfo,
} from "@/types";
import { estimateVideo } from "@/lib/estimation";

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
  updateEstimations: (
    config: CompressionConfig,
    encoders: EncoderInfo[],
  ) => void;
}

/** Create a fresh TaskInfo with all fields initialized */
function createDefaultTaskInfo(partial: Partial<TaskInfo> & { id: string; inputPath: string; fileName: string; inputSize: number }): TaskInfo {
  return {
    outputPath: "",
    status: "pending",
    progress: 0,
    outputSize: null,
    error: null,
    fps: 0,
    speed: 0,
    eta: 0,
    currentSize: 0,
    timeElapsed: 0,
    estimatedOutputSize: null,
    estimatedTime: null,
    ...partial,
  };
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
    set((state) => {
      // Ensure all tasks have the new fields initialized
      const initialized = tasks.map((t) => createDefaultTaskInfo(t));
      return { tasks: [...state.tasks, ...initialized] };
    }),

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
              fps: event.fps ?? task.fps,
              speed: event.speed ?? task.speed,
              eta: event.eta ?? task.eta,
              currentSize: event.currentSize ?? task.currentSize,
              timeElapsed: event.timeElapsed ?? task.timeElapsed,
            };
          case "completed":
            return {
              ...task,
              status: "completed" as const,
              progress: 100,
              outputPath: event.outputPath ?? task.outputPath,
              outputSize: event.outputSize ?? null,
              fps: 0,
              speed: 0,
              eta: 0,
            };
          case "failed":
            return {
              ...task,
              status: "failed" as const,
              error: event.error ?? "Unknown error",
              fps: 0,
              speed: 0,
              eta: 0,
            };
          case "cancelled":
            return { ...task, status: "cancelled" as const, fps: 0, speed: 0, eta: 0 };
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

  updateEstimations: (config, encoders) =>
    set((state) => {
      const updatedVideos = state.videos; // videos don't change
      // Also update tasks if they have matching input paths
      const updatedTasks = state.tasks.map((task) => {
        const video = state.videos.find((v) => v.path === task.inputPath);
        if (!video || task.status !== "pending") return task;
        const est = estimateVideo(video, config, encoders);
        return {
          ...task,
          estimatedOutputSize: est.estimatedSize,
          estimatedTime: est.estimatedTime,
        };
      });
      return { videos: updatedVideos, tasks: updatedTasks };
    }),
}));
