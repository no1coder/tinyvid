import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { OUTPUT_FORMATS } from "@/lib/constants";

export function OutputFormatSelector() {
  const { t } = useTranslation();
  const { config, setOutputFormat } = useSettingsStore();

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.format.title")}</span>
      <div className="flex gap-1">
        {OUTPUT_FORMATS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setOutputFormat(value)}
            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all ${
              config.outputFormat === value
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
