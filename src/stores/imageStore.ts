import { create } from "zustand";
import type {
  ImageInfo,
  ImageCompressionConfig,
  ImageCompressionMode,
  ImageOutputFormat,
  TaskInfo,
  ProgressEvent,
} from "@/types";

interface ImageState {
  // Image list
  images: ImageInfo[];
  addImages: (images: ImageInfo[]) => void;
  removeImage: (path: string) => void;
  clearImages: () => void;

  // Tasks
  tasks: TaskInfo[];
  setTasks: (tasks: TaskInfo[]) => void;
  clearCompletedTasks: () => void;
  handleProgressEvent: (event: ProgressEvent) => void;

  // Settings
  config: ImageCompressionConfig;
  setMode: (mode: ImageCompressionMode) => void;
  setQuality: (quality: number) => void;
  setOutputFormat: (format: ImageOutputFormat) => void;
  setOutputDir: (dir: string | null) => void;
  setFilenameTemplate: (template: string) => void;
  setKeepMetadata: (keep: boolean) => void;
}

const CONFIG_DEFAULTS: ImageCompressionConfig = {
  mode: "lossless",
  quality: 80,
  outputFormat: "same",
  outputDir: null,
  filenameTemplate: "{name}_compressed",
  maxConcurrency: null,
  keepMetadata: true,
};

const loadSaved = (): ImageCompressionConfig => {
  try {
    const saved = localStorage.getItem("tinyvid-image-settings");
    if (saved) return { ...CONFIG_DEFAULTS, ...JSON.parse(saved) };
  } catch {
    /* use defaults */
  }
  return { ...CONFIG_DEFAULTS };
};

const persist = (config: ImageCompressionConfig) => {
  localStorage.setItem("tinyvid-image-settings", JSON.stringify(config));
};

export const useImageStore = create<ImageState>((set) => ({
  // Image list
  images: [],
  addImages: (newImages) =>
    set((state) => {
      const existingPaths = new Set(state.images.map((i) => i.path));
      const unique = newImages.filter((i) => !existingPaths.has(i.path));
      return { images: [...state.images, ...unique] };
    }),
  removeImage: (path) =>
    set((state) => ({
      images: state.images.filter((i) => i.path !== path),
    })),
  clearImages: () => set({ images: [] }),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  clearCompletedTasks: () =>
    set((state) => ({
      tasks: state.tasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          t.status !== "failed",
      ),
    })),
  handleProgressEvent: (event) =>
    set((state) => {
      const tasks = state.tasks.map((task) => {
        if (task.id !== event.taskId) return task;

        switch (event.type) {
          case "started":
            return { ...task, status: "running" as const, progress: 0 };
          case "progress":
            return {
              ...task,
              progress: event.percent ?? task.progress,
            };
          case "completed":
            return {
              ...task,
              status: "completed" as const,
              progress: 100,
              outputPath: event.outputPath ?? task.outputPath,
              outputSize: event.outputSize ?? task.outputSize,
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
      return { tasks };
    }),

  // Settings
  config: loadSaved(),
  setMode: (mode) =>
    set((state) => {
      const config = { ...state.config, mode };
      persist(config);
      return { config };
    }),
  setQuality: (quality) =>
    set((state) => {
      const config = { ...state.config, quality };
      persist(config);
      return { config };
    }),
  setOutputFormat: (outputFormat) =>
    set((state) => {
      const config = { ...state.config, outputFormat };
      persist(config);
      return { config };
    }),
  setOutputDir: (outputDir) =>
    set((state) => {
      const config = { ...state.config, outputDir };
      persist(config);
      return { config };
    }),
  setFilenameTemplate: (filenameTemplate) =>
    set((state) => {
      const config = { ...state.config, filenameTemplate };
      persist(config);
      return { config };
    }),
  setKeepMetadata: (keepMetadata) =>
    set((state) => {
      const config = { ...state.config, keepMetadata };
      persist(config);
      return { config };
    }),
}));
