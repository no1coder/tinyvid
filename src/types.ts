export interface VideoInfo {
  path: string;
  fileName: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
  audioCodec: string | null;
  audioBitrate: number | null;
}

export type TaskStatusType =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskInfo {
  id: string;
  inputPath: string;
  outputPath: string;
  fileName: string;
  status: TaskStatusType;
  progress: number;
  inputSize: number;
  outputSize: number | null;
  error: string | null;
  // Real-time progress fields
  fps: number;
  speed: number;
  eta: number;
  currentSize: number;
  timeElapsed: number;
  // Estimation fields
  estimatedOutputSize: number | null;
  estimatedTime: number | null;
}

export interface EstimationResult {
  estimatedSize: number;
  estimatedTime: number;
  ratio: number;
}

export interface ProgressEvent {
  type: "started" | "progress" | "completed" | "failed" | "cancelled";
  taskId: string;
  percent?: number;
  fps?: number;
  speed?: number;
  timeElapsed?: number;
  eta?: number;
  currentSize?: number;
  outputPath?: string;
  outputSize?: number;
  error?: string;
}

export interface CompressionConfig {
  codec: string;
  crf: number;
  useHardware: boolean;
  resolution: string;
  audioBitrate: string;
  outputDir: string | null;
  maxConcurrency: number | null;
  outputFormat: string;
  filenameTemplate: string;
  fps: string | null;
}

export interface EncoderInfo {
  name: string;
  codec: string;
  isHardware: boolean;
  priority: number;
}

export interface DiskSpaceInfo {
  availableBytes: number;
  totalBytes: number;
  requiredBytes: number;
  sufficient: boolean;
  tight: boolean;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  releaseNotes: string;
}

export interface ImageInfo {
  path: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
  format: string;
}

export type ImageCompressionMode = "lossless" | "lossy";
export type ImageOutputFormat = "same" | "jpeg" | "png" | "webp";

export interface ImageCompressionConfig {
  mode: ImageCompressionMode;
  quality: number;
  outputFormat: ImageOutputFormat;
  outputDir: string | null;
  filenameTemplate: string;
  maxConcurrency: number | null;
  keepMetadata: boolean;
}

// Unified file type for mixed video/image lists
export type MediaType = "video" | "image";

export interface UnifiedFileItem {
  id: string;
  type: MediaType;
  path: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
  // Present when type === "video"
  videoInfo?: VideoInfo;
  // Present when type === "image"
  imageInfo?: ImageInfo;
}

export type Theme = "light" | "dark" | "system";
export type Language = "en" | "zh-CN";
