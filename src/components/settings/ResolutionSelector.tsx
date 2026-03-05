import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { RESOLUTIONS } from "@/lib/constants";

export function ResolutionSelector() {
  const { t } = useTranslation();
  const { config, setResolution } = useSettingsStore();

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.resolution.title")}</span>
      <select
        value={config.resolution}
        onChange={(e) => setResolution(e.target.value)}
        className="cursor-pointer rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {RESOLUTIONS.map(({ value, label }) => (
          <option key={value} value={value} className="bg-[#2a2a2a]">
            {label.startsWith("settings.") ? t(label) : label}
          </option>
        ))}
      </select>
    </div>
  );
}
