import { create } from "zustand";
import type { EncoderInfo, Theme, Language } from "@/types";

export type PageId = "compressor" | "tasks" | "settings";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
}

interface AppState {
  page: PageId;
  theme: Theme;
  language: Language;
  encoders: EncoderInfo[];
  ffmpegReady: boolean;
  ffmpegVersion: string;
  setPage: (page: PageId) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  setEncoders: (encoders: EncoderInfo[]) => void;
  setFfmpegReady: (ready: boolean) => void;
  setFfmpegVersion: (version: string) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const loadTheme = (): Theme => {
  return (localStorage.getItem("tinyvid-theme") as Theme) || "system";
};

const loadLanguage = (): Language => {
  return (localStorage.getItem("tinyvid-language") as Language) || "en";
};

export const useAppStore = create<AppState>((set) => ({
  page: "compressor",
  theme: loadTheme(),
  language: loadLanguage(),
  encoders: [],
  ffmpegReady: false,
  ffmpegVersion: "",

  setPage: (page) => set({ page }),

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

  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id),
  })),
}));

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Default is dark (glassmorphism), light is opt-in
  if (theme === "system") {
    const isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    root.classList.toggle("light", isLight);
    root.classList.toggle("dark", !isLight);
  } else {
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }
}

// Apply theme on load
applyTheme(loadTheme());
