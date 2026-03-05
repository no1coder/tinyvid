import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  VideoInfo,
  EncoderInfo,
  CompressionConfig,
  TaskInfo,
  ProgressEvent,
  DiskSpaceInfo,
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
