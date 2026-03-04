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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {t("settings.codec")}
      </label>
      <div className="flex gap-2">
        {codecs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setCodec(value)}
            className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              config.codec === value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
