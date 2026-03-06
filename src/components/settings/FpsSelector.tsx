import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { FPS_OPTIONS } from "@/lib/constants";

export function FpsSelector() {
  const { t } = useTranslation();
  const { config, setFps } = useSettingsStore();

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.fps.title")}</span>
      <select
        value={config.fps ?? ""}
        onChange={(e) => setFps(e.target.value || null)}
        className="cursor-pointer rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {FPS_OPTIONS.map(({ value, labelKey }) => (
          <option key={value ?? "original"} value={value ?? ""} className="bg-[#2a2a2a]">
            {t(labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
