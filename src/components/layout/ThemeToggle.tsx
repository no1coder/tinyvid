import { Sun, Moon, Monitor } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { Theme } from "@/types";

const themes: { value: Theme; icon: typeof Sun }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useAppStore();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      {themes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`rounded-md p-1.5 transition-colors ${
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
