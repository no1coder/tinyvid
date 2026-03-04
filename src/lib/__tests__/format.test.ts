import { describe, it, expect } from "vitest";
import {
  formatFileSize,
  formatDuration,
  formatETA,
  formatBitrate,
  formatCompressionRatio,
} from "../format";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(52428800)).toBe("50.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB");
  });
});

describe("formatDuration", () => {
  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("formats hours", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});

describe("formatETA", () => {
  it("returns -- for zero/negative", () => {
    expect(formatETA(0)).toBe("--");
    expect(formatETA(-1)).toBe("--");
  });

  it("formats seconds", () => {
    expect(formatETA(30)).toBe("30s");
  });

  it("formats minutes and seconds", () => {
    expect(formatETA(125)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatETA(3661)).toBe("1h 1m");
  });
});

describe("formatBitrate", () => {
  it("returns N/A for zero", () => {
    expect(formatBitrate(0)).toBe("N/A");
  });

  it("formats kbps", () => {
    expect(formatBitrate(128000)).toBe("128 Kbps");
  });

  it("formats mbps", () => {
    expect(formatBitrate(5000000)).toBe("5.0 Mbps");
  });
});

describe("formatCompressionRatio", () => {
  it("returns N/A for zero original", () => {
    expect(formatCompressionRatio(0, 100)).toBe("N/A");
  });

  it("calculates ratio correctly", () => {
    expect(formatCompressionRatio(100, 70)).toBe("30.0%");
    expect(formatCompressionRatio(1000, 500)).toBe("50.0%");
  });
});
