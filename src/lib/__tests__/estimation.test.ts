import { describe, it, expect } from "vitest";
import {
  estimateOutputSize,
  estimateCompressionTime,
  estimateVideo,
} from "@/lib/estimation";
import type { VideoInfo, CompressionConfig, EncoderInfo } from "@/types";

const mockVideo: VideoInfo = {
  path: "/test/video.mp4",
  fileName: "video.mp4",
  size: 100_000_000, // 100 MB
  duration: 60, // 60 seconds
  width: 1920,
  height: 1080,
  codec: "h264",
  bitrate: 13_000_000,
  fps: 30,
  audioCodec: "aac",
  audioBitrate: 128000,
};

const defaultConfig: CompressionConfig = {
  codec: "h265",
  crf: 23,
  useHardware: true,
  resolution: "original",
  audioBitrate: "copy",
  outputDir: null,
  maxConcurrency: null,
};

const hwEncoder: EncoderInfo = {
  name: "hevc_videotoolbox",
  codec: "h265",
  isHardware: true,
  priority: 10,
};

const swEncoder: EncoderInfo = {
  name: "libx265",
  codec: "h265",
  isHardware: false,
  priority: 100,
};

describe("estimateOutputSize", () => {
  it("should estimate with default CRF and H.265", () => {
    const result = estimateOutputSize(mockVideo, defaultConfig);
    // CRF 23 = default, ratio = 1.0, H.265 factor = 0.6
    // 100MB * 0.6 = 60MB
    expect(result).toBe(60_000_000);
  });

  it("should estimate with H.264", () => {
    const config = { ...defaultConfig, codec: "h264" };
    const result = estimateOutputSize(mockVideo, config);
    // CRF 23 = default, ratio = 1.0, no H.265 factor
    // 100MB * 1.0 = 100MB
    expect(result).toBe(100_000_000);
  });

  it("should estimate with lower CRF (higher quality = larger file)", () => {
    const config = { ...defaultConfig, crf: 18 };
    const result = estimateOutputSize(mockVideo, config);
    // CRF delta = 23 - 18 = 5, ratio = 2^(5/6) ≈ 1.78, H.265 factor = 0.6
    // 100MB * 1.78 * 0.6 ≈ 107MB
    expect(result).toBeGreaterThan(90_000_000);
    expect(result).toBeLessThan(120_000_000);
  });

  it("should estimate with higher CRF (lower quality = smaller file)", () => {
    const config = { ...defaultConfig, crf: 28 };
    const result = estimateOutputSize(mockVideo, config);
    // CRF delta = 23 - 28 = -5, ratio = 2^(-5/6) ≈ 0.56, H.265 factor = 0.6
    // 100MB * 0.56 * 0.6 ≈ 33.6MB
    expect(result).toBeGreaterThan(25_000_000);
    expect(result).toBeLessThan(45_000_000);
  });

  it("should reduce size when downscaling to 720p", () => {
    const config = { ...defaultConfig, resolution: "720p" };
    const fullSizeResult = estimateOutputSize(mockVideo, defaultConfig);
    const result = estimateOutputSize(mockVideo, config);
    // 720p has fewer pixels than 1080p, so size should be smaller
    expect(result).toBeLessThan(fullSizeResult);
  });

  it("should not scale if resolution is 'original'", () => {
    const result1 = estimateOutputSize(mockVideo, defaultConfig);
    const config = { ...defaultConfig, resolution: "original" };
    const result2 = estimateOutputSize(mockVideo, config);
    expect(result1).toBe(result2);
  });

  it("should not upscale if video is smaller than target", () => {
    const smallVideo = { ...mockVideo, width: 640, height: 480 };
    const config = { ...defaultConfig, resolution: "1080p" };
    const result = estimateOutputSize(smallVideo, config);
    // Should not scale up, same as original resolution
    const originalResult = estimateOutputSize(smallVideo, defaultConfig);
    expect(result).toBe(originalResult);
  });

  it("should clamp ratio to minimum", () => {
    // Very high CRF with H.265 and heavy downscaling
    const config = { ...defaultConfig, crf: 28, resolution: "480p" };
    const result = estimateOutputSize(mockVideo, config);
    // Should still be a positive number
    expect(result).toBeGreaterThan(0);
    // Minimum ratio is 0.05, so minimum is 5MB
    expect(result).toBeGreaterThanOrEqual(5_000_000);
  });
});

describe("estimateCompressionTime", () => {
  it("should estimate faster with hardware encoder", () => {
    const hwTime = estimateCompressionTime(mockVideo, defaultConfig, [
      hwEncoder,
      swEncoder,
    ]);
    const swConfig = { ...defaultConfig, useHardware: false };
    const swTime = estimateCompressionTime(mockVideo, swConfig, [
      hwEncoder,
      swEncoder,
    ]);
    expect(hwTime).toBeLessThan(swTime);
  });

  it("should estimate faster with downscaling", () => {
    // Use a longer video so times don't both clamp to 1
    const longVideo = { ...mockVideo, duration: 600 };
    const fullTime = estimateCompressionTime(longVideo, defaultConfig, [
      hwEncoder,
    ]);
    const config = { ...defaultConfig, resolution: "480p" };
    const downscaledTime = estimateCompressionTime(longVideo, config, [
      hwEncoder,
    ]);
    expect(downscaledTime).toBeLessThan(fullTime);
  });

  it("should return at least 1 second", () => {
    const shortVideo = { ...mockVideo, duration: 0.1 };
    const result = estimateCompressionTime(shortVideo, defaultConfig, [
      hwEncoder,
    ]);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("should fall back to software speed when no HW encoder available", () => {
    const result = estimateCompressionTime(mockVideo, defaultConfig, [
      swEncoder,
    ]);
    // Software: 60s / 10x = 6s
    expect(result).toBe(6);
  });
});

describe("estimateVideo", () => {
  it("should return all estimation fields", () => {
    const result = estimateVideo(mockVideo, defaultConfig, [
      hwEncoder,
      swEncoder,
    ]);
    expect(result).toHaveProperty("estimatedSize");
    expect(result).toHaveProperty("estimatedTime");
    expect(result).toHaveProperty("ratio");
    expect(result.estimatedSize).toBeGreaterThan(0);
    expect(result.estimatedTime).toBeGreaterThan(0);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThan(2);
  });

  it("should compute correct ratio", () => {
    const result = estimateVideo(mockVideo, defaultConfig, [swEncoder]);
    expect(result.ratio).toBeCloseTo(
      result.estimatedSize / mockVideo.size,
      5,
    );
  });
});
