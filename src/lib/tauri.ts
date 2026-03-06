import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  VideoInfo,
  EncoderInfo,
  CompressionConfig,
  TaskInfo,
  ProgressEvent,
  DiskSpaceInfo,
  ImageInfo,
  ImageCompressionConfig,
} from "@/types";

export async function detectHardware(): Promise<EncoderInfo[]> {
  return invoke<EncoderInfo[]>("detect_hardware");
}

export async function getFfmpegVersion(): Promise<string> {
  return invoke<string>("get_ffmpeg_version");
}

export async function probeVideos(paths: string[]): Promise<VideoInfo[]> {
  return invoke<VideoInfo[]>("probe_videos", { paths });
}

export async function startCompression(
  videos: VideoInfo[],
  config: CompressionConfig,
  onProgress: (event: ProgressEvent) => void,
): Promise<TaskInfo[]> {
  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;
  return invoke<TaskInfo[]>("start_compression", {
    videos,
    config,
    channel,
  });
}

export async function cancelTask(taskId: string): Promise<void> {
  return invoke("cancel_task", { taskId });
}

export async function cancelAll(): Promise<void> {
  return invoke("cancel_all");
}

export async function getTasks(): Promise<TaskInfo[]> {
  return invoke<TaskInfo[]>("get_tasks");
}

export async function clearCompleted(): Promise<void> {
  return invoke("clear_completed");
}

export async function removeTask(taskId: string): Promise<void> {
  return invoke("remove_task", { taskId });
}

export async function retryFailed(
  config: CompressionConfig,
  onProgress: (event: ProgressEvent) => void,
): Promise<TaskInfo[]> {
  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;
  return invoke<TaskInfo[]>("retry_failed", { config, channel });
}

export async function checkDiskSpace(
  outputDir: string,
  estimatedBytes: number,
): Promise<DiskSpaceInfo> {
  return invoke<DiskSpaceInfo>("check_disk_space", {
    outputDir,
    estimatedBytes,
  });
}

export async function showInFolder(path: string): Promise<void> {
  return invoke("show_in_folder", { path });
}

// --- Image compression commands ---

export async function probeImages(paths: string[]): Promise<ImageInfo[]> {
  return invoke<ImageInfo[]>("probe_images", { paths });
}

export async function addImageTasks(
  images: ImageInfo[],
  config: ImageCompressionConfig,
): Promise<TaskInfo[]> {
  return invoke<TaskInfo[]>("add_image_tasks", { images, config });
}

export async function runImageCompression(
  config: ImageCompressionConfig,
  onProgress: (event: ProgressEvent) => void,
): Promise<void> {
  const channel = new Channel<ProgressEvent>();
  channel.onmessage = onProgress;
  return invoke("run_image_compression", { config, channel });
}

export async function cancelImageTask(taskId: string): Promise<void> {
  return invoke("cancel_image_task", { taskId });
}

export async function cancelAllImages(): Promise<void> {
  return invoke("cancel_all_images");
}

export async function getImageTasks(): Promise<TaskInfo[]> {
  return invoke<TaskInfo[]>("get_image_tasks");
}

export async function clearCompletedImages(): Promise<void> {
  return invoke("clear_completed_images");
}

export async function removeImageTask(taskId: string): Promise<void> {
  return invoke("remove_image_task", { taskId });
}

export async function retryFailedImages(): Promise<TaskInfo[]> {
  return invoke<TaskInfo[]>("retry_failed_images");
}
