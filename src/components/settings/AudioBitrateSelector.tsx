import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { AUDIO_BITRATES } from "@/lib/constants";

export function AudioBitrateSelector() {
  const { t } = useTranslation();
  const { config, setAudioBitrate } = useSettingsStore();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {t("settings.audio.title")}
      </label>
      <select
        value={config.audioBitrate}
        onChange={(e) => setAudioBitrate(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
      >
        {AUDIO_BITRATES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label.startsWith("settings.") ? t(label) : label}
          </option>
        ))}
      </select>
    </div>
  );
}
