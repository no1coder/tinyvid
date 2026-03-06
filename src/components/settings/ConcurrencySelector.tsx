import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";

const OPTIONS = [
  { value: null, label: "auto" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
] as const;

export function ConcurrencySelector() {
  const { t } = useTranslation();
  const { config, setMaxConcurrency } = useSettingsStore();

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.concurrency.title")}</span>
      <div className="flex gap-1">
        {OPTIONS.map(({ value, label }) => {
          const isActive =
            value === null
              ? config.maxConcurrency === null
              : config.maxConcurrency === value;
          const displayLabel =
            value === null ? t("settings.concurrency.auto") : label;

          return (
            <button
              key={label}
              onClick={() => setMaxConcurrency(value)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
