import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";

export function CodecSelector() {
  const { t } = useTranslation();
  const { config, setCodec } = useSettingsStore();

  const codecs = [
    { value: "h265", label: "H.265 (HEVC)" },
    { value: "h264", label: "H.264 (AVC)" },
  ];

  return (
    <div className="settings-row flex items-center justify-between rounded-t-[10px] px-4 py-3">
      <span className="text-[14px]">{t("settings.codec")}</span>
      <div className="flex gap-1">
        {codecs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setCodec(value)}
            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-all ${
              config.codec === value
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
