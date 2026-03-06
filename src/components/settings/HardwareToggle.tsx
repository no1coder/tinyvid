import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";

export function HardwareToggle() {
  const { t } = useTranslation();
  const { config, setUseHardware } = useSettingsStore();
  const { encoders } = useAppStore();

  const hwEncoder = encoders.find((e) => e.isHardware);
  const hasHardware = !!hwEncoder;

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px]">{t("settings.hardware.title")}</span>
        <span className="text-[11px] text-muted-foreground">
          {hasHardware
            ? t("settings.hardware.detected", { encoder: hwEncoder.name })
            : t("settings.hardware.none")}
        </span>
      </div>
      <button
        role="switch"
        aria-checked={config.useHardware && hasHardware}
        aria-label={t("settings.hardware.title")}
        onClick={() => setUseHardware(!config.useHardware)}
        disabled={!hasHardware}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          config.useHardware && hasHardware
            ? "bg-success"
            : "bg-muted-foreground/30"
        } ${!hasHardware ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
            config.useHardware && hasHardware
              ? "translate-x-5"
              : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
