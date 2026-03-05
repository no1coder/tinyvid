import { create } from "zustand";
import type { CompressionConfig } from "@/types";
import { CRF_DEFAULT } from "@/lib/constants";

interface SettingsState {
  config: CompressionConfig;
  setCodec: (codec: string) => void;
  setCrf: (crf: number) => void;
  setUseHardware: (use: boolean) => void;
  setResolution: (resolution: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setOutputDir: (dir: string | null) => void;
  setMaxConcurrency: (max: number | null) => void;
}

const loadSaved = (): CompressionConfig => {
  try {
    const saved = localStorage.getItem("tinyvid-settings");
    if (saved) return JSON.parse(saved);
  } catch { /* use defaults */ }
  return {
    codec: "h265",
    crf: CRF_DEFAULT,
    useHardware: true,
    resolution: "original",
    audioBitrate: "copy",
    outputDir: null,
    maxConcurrency: null,
  };
};

const persist = (config: CompressionConfig) => {
  localStorage.setItem("tinyvid-settings", JSON.stringify(config));
};

export const useSettingsStore = create<SettingsState>((set) => ({
  config: loadSaved(),
  setCodec: (codec) =>
    set((state) => {
      const config = { ...state.config, codec };
      persist(config);
      return { config };
    }),
  setCrf: (crf) =>
    set((state) => {
      const config = { ...state.config, crf };
      persist(config);
      return { config };
    }),
  setUseHardware: (useHardware) =>
    set((state) => {
      const config = { ...state.config, useHardware };
      persist(config);
      return { config };
    }),
  setResolution: (resolution) =>
    set((state) => {
      const config = { ...state.config, resolution };
      persist(config);
      return { config };
    }),
  setAudioBitrate: (audioBitrate) =>
    set((state) => {
      const config = { ...state.config, audioBitrate };
      persist(config);
      return { config };
    }),
  setOutputDir: (outputDir) =>
    set((state) => {
      const config = { ...state.config, outputDir };
      persist(config);
      return { config };
    }),
  setMaxConcurrency: (maxConcurrency) =>
    set((state) => {
      const config = { ...state.config, maxConcurrency };
      persist(config);
      return { config };
    }),
}));
