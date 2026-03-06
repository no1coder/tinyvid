import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SettingsMode } from "@/lib/constants";

const TABS: { value: SettingsMode; labelKey: string }[] = [
  { value: "basic", labelKey: "settings.mode.basic" },
  { value: "professional", labelKey: "settings.mode.professional" },
];

export function SettingsTabs() {
  const { t } = useTranslation();
  const { settingsMode, setSettingsMode } = useSettingsStore();

  return (
    <div className="flex gap-1 rounded-lg bg-[rgba(255,255,255,0.05)] p-1">
      {TABS.map(({ value, labelKey }) => (
        <button
          key={value}
          onClick={() => setSettingsMode(value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
            settingsMode === value
              ? "bg-[rgba(255,255,255,0.12)] text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
