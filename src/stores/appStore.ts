import { create } from "zustand";
import type { EncoderInfo, Theme, Language } from "@/types";

interface AppState {
  theme: Theme;
  language: Language;
  encoders: EncoderInfo[];
  ffmpegReady: boolean;
  ffmpegVersion: string;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  setEncoders: (encoders: EncoderInfo[]) => void;
  setFfmpegReady: (ready: boolean) => void;
  setFfmpegVersion: (version: string) => void;
}

const loadTheme = (): Theme => {
  return (localStorage.getItem("tinyvid-theme") as Theme) || "system";
};

const loadLanguage = (): Language => {
  return (localStorage.getItem("tinyvid-language") as Language) || "en";
};

export const useAppStore = create<AppState>((set) => ({
  theme: loadTheme(),
  language: loadLanguage(),
  encoders: [],
  ffmpegReady: false,
  ffmpegVersion: "",

  setTheme: (theme) => {
    localStorage.setItem("tinyvid-theme", theme);
    applyTheme(theme);
    set({ theme });
  },

  setLanguage: (language) => {
    localStorage.setItem("tinyvid-language", language);
    set({ language });
  },

  setEncoders: (encoders) => set({ encoders }),
  setFfmpegReady: (ffmpegReady) => set({ ffmpegReady }),
  setFfmpegVersion: (ffmpegVersion) => set({ ffmpegVersion }),
}));

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

// Apply theme on load
applyTheme(loadTheme());
