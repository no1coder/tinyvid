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
});
