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
