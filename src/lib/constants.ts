export const APP_VERSION = "0.1.0";
export const GITHUB_REPO = "no1coder/tinyvid";
export const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

export const SUPPORTED_FORMATS = [
  "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v",
  "ts", "mts", "m2ts", "vob", "mpg", "mpeg", "3gp",
] as const;

export const CRF_MIN = 18;
export const CRF_MAX = 28;
export const CRF_DEFAULT = 23;

export const QUALITY_PRESETS = [
  { value: 18, labelKey: "settings.qualityPreset.lossless" },
  { value: 21, labelKey: "settings.qualityPreset.high" },
  { value: 23, labelKey: "settings.qualityPreset.balanced" },
  { value: 28, labelKey: "settings.qualityPreset.compact" },
] as const;

export type SettingsMode = "basic" | "professional";

export interface CompressionPreset {
  readonly id: string;
  readonly labelKey: string;
  readonly descKey: string;
  readonly icon: string;
  readonly codec: string;
  readonly crf: number;
  readonly resolution: string;
  readonly audioBitrate: string;
}

export const COMPRESSION_PRESETS: readonly CompressionPreset[] = [
  {
    id: "social",
    labelKey: "settings.preset.social",
    descKey: "settings.preset.socialDesc",
    icon: "share",
    codec: "h264",
    crf: 25,
    resolution: "1080p",
    audioBitrate: "128k",
  },
  {
    id: "balanced",
    labelKey: "settings.preset.balanced",
    descKey: "settings.preset.balancedDesc",
    icon: "scale",
    codec: "h265",
    crf: 23,
    resolution: "original",
    audioBitrate: "copy",
  },
  {
    id: "archive",
    labelKey: "settings.preset.archive",
    descKey: "settings.preset.archiveDesc",
    icon: "archive",
    codec: "h265",
    crf: 18,
    resolution: "original",
    audioBitrate: "copy",
  },
] as const;

export const RESOLUTIONS = [
  { value: "original", label: "settings.resolution.original" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
] as const;

export const AUDIO_BITRATES = [
  { value: "copy", label: "settings.audio.copy" },
  { value: "320k", label: "320 kbps" },
  { value: "256k", label: "256 kbps" },
  { value: "128k", label: "128 kbps" },
  { value: "96k", label: "96 kbps" },
] as const;

export const OUTPUT_FORMATS = [
  { value: "mp4", label: "MP4" },
  { value: "mkv", label: "MKV" },
] as const;

export const FILENAME_TEMPLATES = [
  { value: "{name}_compressed", labelKey: "settings.filename.compressed" },
  { value: "{name}_{date}", labelKey: "settings.filename.date" },
  { value: "{name}_{codec}_{resolution}", labelKey: "settings.filename.detailed" },
] as const;

export const FPS_OPTIONS = [
  { value: null, labelKey: "settings.fps.original" },
  { value: "30", labelKey: "settings.fps.30" },
  { value: "24", labelKey: "settings.fps.24" },
] as const;

export const SUPPORTED_IMAGE_FORMATS = [
  "jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif",
] as const;

export const IMAGE_OUTPUT_FORMATS = [
  { value: "same", labelKey: "image.settings.formatSame" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
] as const;

export const IMAGE_FILENAME_TEMPLATES = [
  { value: "{name}_compressed", labelKey: "image.settings.filenameCompressed" },
  { value: "{name}_{date}", labelKey: "image.settings.filenameDate" },
] as const;

// Combined formats for unified import
export const ALL_SUPPORTED_FORMATS = [
  ...SUPPORTED_FORMATS,
  ...SUPPORTED_IMAGE_FORMATS,
] as const;

const VIDEO_EXT_SET = new Set(SUPPORTED_FORMATS.map((f) => f.toLowerCase()));
const IMAGE_EXT_SET = new Set(SUPPORTED_IMAGE_FORMATS.map((f) => f.toLowerCase()));

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXT_SET.has(ext.toLowerCase().replace(/^\./, ""));
}

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXT_SET.has(ext.toLowerCase().replace(/^\./, ""));
}

export function getFileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
}
