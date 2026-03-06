import { create } from "zustand";
import type { CompressionConfig } from "@/types";
import {
  CRF_DEFAULT,
  COMPRESSION_PRESETS,
  type SettingsMode,
} from "@/lib/constants";

interface SettingsState {
  config: CompressionConfig;
  settingsMode: SettingsMode;
  activePreset: string | null;
  setCodec: (codec: string) => void;
  setCrf: (crf: number) => void;
  setUseHardware: (use: boolean) => void;
  setResolution: (resolution: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setOutputDir: (dir: string | null) => void;
  setMaxConcurrency: (max: number | null) => void;
  setOutputFormat: (format: string) => void;
  setFilenameTemplate: (template: string) => void;
  setFps: (fps: string | null) => void;
  setSettingsMode: (mode: SettingsMode) => void;
  applyPreset: (presetId: string) => void;
}

const CONFIG_DEFAULTS: CompressionConfig = {
  codec: "h265",
  crf: CRF_DEFAULT,
  useHardware: true,
  resolution: "original",
  audioBitrate: "copy",
  outputDir: null,
  maxConcurrency: null,
  outputFormat: "mp4",
  filenameTemplate: "{name}_compressed",
  fps: null,
};

const loadSaved = (): CompressionConfig => {
  try {
    const saved = localStorage.getItem("tinyvid-settings");
    if (saved) return { ...CONFIG_DEFAULTS, ...JSON.parse(saved) };
  } catch { /* use defaults */ }
  return { ...CONFIG_DEFAULTS };
};

const loadSettingsMode = (): SettingsMode => {
  try {
    const saved = localStorage.getItem("tinyvid-settings-mode");
    if (saved === "basic" || saved === "professional") return saved;
  } catch { /* use default */ }
  return "basic";
};

const persist = (config: CompressionConfig) => {
  localStorage.setItem("tinyvid-settings", JSON.stringify(config));
};

const detectPreset = (config: CompressionConfig): string | null => {
  // Non-default fps means custom config, no preset matches
  if (config.fps !== null) return null;

  for (const preset of COMPRESSION_PRESETS) {
    if (
      config.codec === preset.codec &&
      config.crf === preset.crf &&
      config.resolution === preset.resolution &&
      config.audioBitrate === preset.audioBitrate
    ) {
      return preset.id;
    }
  }
  return null;
};

const loadActivePreset = (): string | null => {
  try {
    const saved = localStorage.getItem("tinyvid-active-preset");
    if (saved) return saved;
  } catch { /* use default */ }
  // Derive from actual config instead of hardcoding
  return detectPreset(loadSaved());
};

const updateWithPresetDetection = (
  state: SettingsState,
  configUpdate: Partial<CompressionConfig>,
): Partial<SettingsState> => {
  const config = { ...state.config, ...configUpdate };
  persist(config);
  const activePreset = detectPreset(config);
  if (activePreset) {
    localStorage.setItem("tinyvid-active-preset", activePreset);
  } else {
    localStorage.removeItem("tinyvid-active-preset");
  }
  return { config, activePreset };
};

export const useSettingsStore = create<SettingsState>((set) => ({
  config: loadSaved(),
  settingsMode: loadSettingsMode(),
  activePreset: loadActivePreset(),
  setCodec: (codec) =>
    set((state) => updateWithPresetDetection(state, { codec })),
  setCrf: (crf) =>
    set((state) => updateWithPresetDetection(state, { crf })),
  setUseHardware: (useHardware) =>
    set((state) => {
      const config = { ...state.config, useHardware };
      persist(config);
      return { config };
    }),
  setResolution: (resolution) =>
    set((state) => updateWithPresetDetection(state, { resolution })),
  setAudioBitrate: (audioBitrate) =>
    set((state) => updateWithPresetDetection(state, { audioBitrate })),
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
  setOutputFormat: (outputFormat) =>
    set((state) => {
      const config = { ...state.config, outputFormat };
      persist(config);
      return { config };
    }),
  setFilenameTemplate: (filenameTemplate) =>
    set((state) => {
      const config = { ...state.config, filenameTemplate };
      persist(config);
      return { config };
    }),
  setFps: (fps) =>
    set((state) => updateWithPresetDetection(state, { fps })),
  setSettingsMode: (settingsMode) => {
    localStorage.setItem("tinyvid-settings-mode", settingsMode);
    set({ settingsMode });
  },
  applyPreset: (presetId) =>
    set((state) => {
      const preset = COMPRESSION_PRESETS.find((p) => p.id === presetId);
      if (!preset) return state;
      const config = {
        ...state.config,
        codec: preset.codec,
        crf: preset.crf,
        resolution: preset.resolution,
        audioBitrate: preset.audioBitrate,
        fps: null, // Reset fps when applying preset
      };
      persist(config);
      localStorage.setItem("tinyvid-active-preset", presetId);
      return { config, activePreset: presetId };
    }),
}));
