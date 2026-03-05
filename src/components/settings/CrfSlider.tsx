import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { CRF_MIN, CRF_MAX } from "@/lib/constants";

export function CrfSlider() {
  const { t } = useTranslation();
  const { config, setCrf } = useSettingsStore();

  return (
    <div className="settings-row flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px]">{t("settings.quality")}</span>
        <span className="rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-0.5 font-mono text-[12px] font-semibold">
          {config.crf}
        </span>
      </div>
      <input
        type="range"
        min={CRF_MIN}
        max={CRF_MAX}
        step={1}
        value={config.crf}
        onChange={(e) => setCrf(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{t("settings.qualityHint.high")}</span>
        <span>{t("settings.qualityHint.low")}</span>
      </div>
    </div>
  );
}
