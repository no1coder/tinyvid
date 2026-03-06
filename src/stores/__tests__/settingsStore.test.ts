import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store to defaults
    useSettingsStore.setState({
      config: {
        codec: "h265",
        crf: 23,
        useHardware: true,
        resolution: "original",
        audioBitrate: "copy",
        outputDir: null,
        maxConcurrency: null,
        outputFormat: "mp4",
        filenameTemplate: "{name}_compressed",
        fps: null,
      },
    });
  });

  it("has correct default values", () => {
    const { config } = useSettingsStore.getState();
    expect(config.codec).toBe("h265");
    expect(config.crf).toBe(23);
    expect(config.useHardware).toBe(true);
    expect(config.resolution).toBe("original");
    expect(config.audioBitrate).toBe("copy");
  });

  it("setCodec creates new config object", () => {
    const before = useSettingsStore.getState().config;
    useSettingsStore.getState().setCodec("h264");
    const after = useSettingsStore.getState().config;
    expect(after.codec).toBe("h264");
    expect(before).not.toBe(after); // immutable
  });

  it("setCrf creates new config object", () => {
    useSettingsStore.getState().setCrf(18);
    expect(useSettingsStore.getState().config.crf).toBe(18);
  });

  it("setResolution updates resolution", () => {
    useSettingsStore.getState().setResolution("720p");
    expect(useSettingsStore.getState().config.resolution).toBe("720p");
  });

  it("setAudioBitrate updates audio bitrate", () => {
    useSettingsStore.getState().setAudioBitrate("128k");
    expect(useSettingsStore.getState().config.audioBitrate).toBe("128k");
  });

  it("setUseHardware updates hardware flag", () => {
    useSettingsStore.getState().setUseHardware(false);
    expect(useSettingsStore.getState().config.useHardware).toBe(false);
  });

  it("setFps updates fps", () => {
    useSettingsStore.getState().setFps("30");
    expect(useSettingsStore.getState().config.fps).toBe("30");
  });

  it("setFps creates new config object", () => {
    const before = useSettingsStore.getState().config;
    useSettingsStore.getState().setFps("24");
    const after = useSettingsStore.getState().config;
    expect(before).not.toBe(after);
  });

  it("setFps to non-null clears activePreset", () => {
    useSettingsStore.getState().applyPreset("balanced");
    expect(useSettingsStore.getState().activePreset).toBe("balanced");

    useSettingsStore.getState().setFps("30");
    expect(useSettingsStore.getState().activePreset).toBeNull();
  });

  it("applyPreset resets fps to null", () => {
    useSettingsStore.getState().setFps("24");
    expect(useSettingsStore.getState().config.fps).toBe("24");

    useSettingsStore.getState().applyPreset("balanced");
    expect(useSettingsStore.getState().config.fps).toBeNull();
  });

  it("applyPreset sets correct config values", () => {
    useSettingsStore.getState().applyPreset("social");
    const { config, activePreset } = useSettingsStore.getState();
    expect(config.codec).toBe("h264");
    expect(config.crf).toBe(25);
    expect(config.resolution).toBe("1080p");
    expect(config.audioBitrate).toBe("128k");
    expect(config.fps).toBeNull();
    expect(activePreset).toBe("social");
  });

  it("detectPreset returns null when fps is set", () => {
    // Start at balanced preset
    useSettingsStore.getState().applyPreset("balanced");
    expect(useSettingsStore.getState().activePreset).toBe("balanced");

    // Changing fps should clear preset
    useSettingsStore.getState().setFps("30");
    expect(useSettingsStore.getState().activePreset).toBeNull();

    // Setting fps back to null should re-detect balanced
    useSettingsStore.getState().setFps(null);
    expect(useSettingsStore.getState().activePreset).toBe("balanced");
  });
});
