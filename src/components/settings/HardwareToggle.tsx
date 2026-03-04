import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";

export function HardwareToggle() {
  const { t } = useTranslation();
  const { config, setUseHardware } = useSettingsStore();
  const { encoders } = useAppStore();

  const hwEncoder = encoders.find((e) => e.isHardware);
  const hasHardware = !!hwEncoder;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {t("settings.hardware.title")}
      </label>
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-muted-foreground" />
          <span className="text-xs">
            {hasHardware
              ? t("settings.hardware.detected", { encoder: hwEncoder.name })
              : t("settings.hardware.none")}
          </span>
        </div>
        <button
          onClick={() => setUseHardware(!config.useHardware)}
          disabled={!hasHardware}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            config.useHardware && hasHardware
              ? "bg-primary"
              : "bg-muted"
          } ${!hasHardware ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              config.useHardware && hasHardware
                ? "translate-x-4"
                : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
