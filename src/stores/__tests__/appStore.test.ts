import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../appStore";

describe("appStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      encoders: [],
      ffmpegReady: false,
      ffmpegVersion: "",
    });
  });

  describe("defaults", () => {
    it("has empty encoders by default", () => {
      expect(useAppStore.getState().encoders).toEqual([]);
    });

    it("ffmpegReady is false by default", () => {
      expect(useAppStore.getState().ffmpegReady).toBe(false);
    });

    it("ffmpegVersion is empty by default", () => {
      expect(useAppStore.getState().ffmpegVersion).toBe("");
    });
  });

  describe("setTheme", () => {
    it("updates theme state", () => {
      useAppStore.getState().setTheme("dark");
      expect(useAppStore.getState().theme).toBe("dark");
    });

    it("persists to localStorage", () => {
      useAppStore.getState().setTheme("light");
      expect(localStorage.getItem("tinyvid-theme")).toBe("light");
    });

    it("supports system theme", () => {
      useAppStore.getState().setTheme("system");
      expect(useAppStore.getState().theme).toBe("system");
    });
  });

  describe("setLanguage", () => {
    it("updates language state", () => {
      useAppStore.getState().setLanguage("zh-CN");
      expect(useAppStore.getState().language).toBe("zh-CN");
    });

    it("persists to localStorage", () => {
      useAppStore.getState().setLanguage("zh-CN");
      expect(localStorage.getItem("tinyvid-language")).toBe("zh-CN");
    });
  });

  describe("setEncoders", () => {
    it("updates encoders list", () => {
      const encoders = [
        {
          name: "hevc_videotoolbox",
          codec: "h265",
          isHardware: true,
          priority: 10,
        },
      ];
      useAppStore.getState().setEncoders(encoders);
      expect(useAppStore.getState().encoders).toEqual(encoders);
    });

    it("replaces previous encoders", () => {
      useAppStore.getState().setEncoders([
        { name: "libx265", codec: "h265", isHardware: false, priority: 100 },
      ]);
      useAppStore.getState().setEncoders([
        { name: "libx264", codec: "h264", isHardware: false, priority: 99 },
      ]);
      expect(useAppStore.getState().encoders).toHaveLength(1);
      expect(useAppStore.getState().encoders[0].name).toBe("libx264");
    });
  });

  describe("setFfmpegReady", () => {
    it("updates ready state", () => {
      useAppStore.getState().setFfmpegReady(true);
      expect(useAppStore.getState().ffmpegReady).toBe(true);
    });
  });

  describe("setFfmpegVersion", () => {
    it("updates version string", () => {
      useAppStore.getState().setFfmpegVersion("8.0.1");
      expect(useAppStore.getState().ffmpegVersion).toBe("8.0.1");
    });
  });
});
