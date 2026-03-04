import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { CRF_MIN, CRF_MAX } from "@/lib/constants";

export function CrfSlider() {
  const { t } = useTranslation();
  const { config, setCrf } = useSettingsStore();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          {t("settings.quality")}
        </label>
        <span className="text-xs font-mono font-medium">{config.crf}</span>
      </div>
      <input
        type="range"
        min={CRF_MIN}
        max={CRF_MAX}
        step={1}
        value={config.crf}
        onChange={(e) => setCrf(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{t("settings.qualityHint.high")}</span>
        <span>{t("settings.qualityHint.low")}</span>
      </div>
    </div>
  );
}
