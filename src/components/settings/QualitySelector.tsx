import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { QUALITY_PRESETS } from "@/lib/constants";

export function QualitySelector() {
  const { t } = useTranslation();
  const { config, setCrf } = useSettingsStore();

  return (
    <div className="settings-row flex flex-col gap-2.5 px-4 py-3">
      <span className="text-[14px]">{t("settings.quality")}</span>
      <div className="flex gap-1">
        {QUALITY_PRESETS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setCrf(value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-all ${
              config.crf === value
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
