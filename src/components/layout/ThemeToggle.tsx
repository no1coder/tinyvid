import { Sun, Moon } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { Theme } from "@/types";

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore();

  const cycleTheme = () => {
    const order: Theme[] = ["dark", "light", "system"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      onClick={cycleTheme}
      className="glass-btn flex h-8 w-8 items-center justify-center rounded-lg transition-all"
      title={theme}
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
