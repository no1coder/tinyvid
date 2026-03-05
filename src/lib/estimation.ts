import type { VideoInfo, CompressionConfig, EncoderInfo, EstimationResult } from "@/types";
import { CRF_DEFAULT } from "@/lib/constants";

/**
 * Resolution pixel counts for scaling estimation.
 */
const RESOLUTION_PIXELS: Record<string, number> = {
  "1080p": 1920 * 1080,
  "720p": 1280 * 720,
  "480p": 854 * 480,
};

/**
 * Estimate the output file size based on CRF, codec, and resolution.
 *
 * CRF model: every 6 CRF units approximately halves the bitrate.
 * Formula: estimatedSize = originalSize * 2^((defaultCRF - targetCRF) / 6)
 * H.265 is ~40% more efficient than H.264 at the same perceptual quality.
 */
export function estimateOutputSize(
  video: VideoInfo,
  config: CompressionConfig,
): number {
  const crfDelta = CRF_DEFAULT - config.crf;
  // CRF scaling: lower CRF = larger file, higher CRF = smaller file
  let ratio = Math.pow(2, crfDelta / 6);

  // H.265 is ~40% more efficient than H.264
  if (config.codec === "h265") {
    ratio *= 0.6;
  }

  // Resolution scaling: if downscaling, reduce proportionally by pixel count
  if (config.resolution !== "original") {
    const targetPixels = RESOLUTION_PIXELS[config.resolution];
    if (targetPixels) {
      const originalPixels = video.width * video.height;
      if (originalPixels > 0 && targetPixels < originalPixels) {
        ratio *= targetPixels / originalPixels;
      }
    }
  }

  // Clamp ratio to reasonable range [0.05, 2.0]
  ratio = Math.max(0.05, Math.min(2.0, ratio));

  return Math.round(video.size * ratio);
}

/**
 * Estimate compression time in seconds.
 *
 * Hardware encoders are significantly faster than software encoders.
 * Typical speeds: HW 50-150x realtime, SW 5-20x realtime.
 */
export function estimateCompressionTime(
  video: VideoInfo,
  config: CompressionConfig,
  encoders: EncoderInfo[],
): number {
  const hasHwEncoder = encoders.some(
    (e) => e.codec === config.codec && e.isHardware,
  );
  const useHw = config.useHardware && hasHwEncoder;

  // Estimated encoding speed as a multiple of realtime
  const baseSpeed = useHw ? 80 : 10;

  // Resolution scaling: downscaling is faster
  let speedMultiplier = 1.0;
  if (config.resolution !== "original") {
    const targetPixels = RESOLUTION_PIXELS[config.resolution];
    if (targetPixels) {
      const originalPixels = video.width * video.height;
      if (originalPixels > 0 && targetPixels < originalPixels) {
        speedMultiplier = originalPixels / targetPixels;
      }
    }
  }

  const effectiveSpeed = baseSpeed * speedMultiplier;
  const estimatedSeconds = video.duration / effectiveSpeed;

  // Minimum 1 second
  return Math.max(1, Math.round(estimatedSeconds));
}

/**
 * Compute full estimation result for a video.
 */
export function estimateVideo(
  video: VideoInfo,
  config: CompressionConfig,
  encoders: EncoderInfo[],
): EstimationResult {
  const estimatedSize = estimateOutputSize(video, config);
  const estimatedTime = estimateCompressionTime(video, config, encoders);
  const ratio = video.size > 0 ? estimatedSize / video.size : 1;

  return { estimatedSize, estimatedTime, ratio };
}
