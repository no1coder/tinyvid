import { useMemo } from "react";
import { create } from "zustand";
import { useTaskStore } from "@/stores/taskStore";
import { useImageStore } from "@/stores/imageStore";
import type { UnifiedFileItem, TaskInfo, MediaType } from "@/types";

interface UnifiedState {
  // Track import order across both types
  importOrder: string[];
  // Track which task IDs belong to which media type
  taskTypeMap: Record<string, MediaType>;

  addToOrder: (paths: string[]) => void;
  removeFromOrder: (path: string) => void;
  clearOrder: () => void;
  registerTaskType: (taskId: string, type: MediaType) => void;
  registerTaskTypes: (taskIds: string[], type: MediaType) => void;
  clearTaskTypes: () => void;
  getTaskType: (taskId: string) => MediaType | undefined;
}

export const useUnifiedStore = create<UnifiedState>((set, get) => ({
  importOrder: [],
  taskTypeMap: {},

  addToOrder: (paths) =>
    set((state) => {
      const existing = new Set(state.importOrder);
      const newPaths = paths.filter((p) => !existing.has(p));
      return { importOrder: [...state.importOrder, ...newPaths] };
    }),

  removeFromOrder: (path) =>
    set((state) => ({
      importOrder: state.importOrder.filter((p) => p !== path),
    })),

  clearOrder: () => set({ importOrder: [], taskTypeMap: {} }),

  registerTaskType: (taskId, type) =>
    set((state) => ({
      taskTypeMap: { ...state.taskTypeMap, [taskId]: type },
    })),

  registerTaskTypes: (taskIds, type) =>
    set((state) => {
      const updates: Record<string, MediaType> = {};
      for (const id of taskIds) {
        updates[id] = type;
      }
      return { taskTypeMap: { ...state.taskTypeMap, ...updates } };
    }),

  clearTaskTypes: () => set({ taskTypeMap: {} }),

  getTaskType: (taskId) => get().taskTypeMap[taskId],
}));

// Selector: build unified file items from both stores, ordered by import order
export function useUnifiedItems(): UnifiedFileItem[] {
  const videos = useTaskStore((s) => s.videos);
  const images = useImageStore((s) => s.images);
  const importOrder = useUnifiedStore((s) => s.importOrder);

  return useMemo(() => {
    const videoMap = new Map(videos.map((v) => [v.path, v]));
    const imageMap = new Map(images.map((i) => [i.path, i]));

    const items: UnifiedFileItem[] = [];
    const seen = new Set<string>();

    for (const path of importOrder) {
      if (seen.has(path)) continue;
      seen.add(path);

      const video = videoMap.get(path);
      if (video) {
        items.push({
          id: path,
          type: "video",
          path: video.path,
          fileName: video.fileName,
          size: video.size,
          width: video.width,
          height: video.height,
          videoInfo: video,
        });
        continue;
      }

      const image = imageMap.get(path);
      if (image) {
        items.push({
          id: path,
          type: "image",
          path: image.path,
          fileName: image.fileName,
          size: image.size,
          width: image.width,
          height: image.height,
          imageInfo: image,
        });
      }
    }

    // Add any items not in importOrder (e.g. from restored state)
    for (const video of videos) {
      if (!seen.has(video.path)) {
        items.push({
          id: video.path,
          type: "video",
          path: video.path,
          fileName: video.fileName,
          size: video.size,
          width: video.width,
          height: video.height,
          videoInfo: video,
        });
      }
    }
    for (const image of images) {
      if (!seen.has(image.path)) {
        items.push({
          id: image.path,
          type: "image",
          path: image.path,
          fileName: image.fileName,
          size: image.size,
          width: image.width,
          height: image.height,
          imageInfo: image,
        });
      }
    }

    return items;
  }, [videos, images, importOrder]);
}

// Selector: merge tasks from both stores
export function useUnifiedTasks(): TaskInfo[] {
  const videoTasks = useTaskStore((s) => s.tasks);
  const imageTasks = useImageStore((s) => s.tasks);
  return useMemo(() => [...videoTasks, ...imageTasks], [videoTasks, imageTasks]);
}

// Selector: check if any files exist
export function useHasFiles(): boolean {
  const videoCount = useTaskStore((s) => s.videos.length);
  const imageCount = useImageStore((s) => s.images.length);
  return videoCount > 0 || imageCount > 0;
}
