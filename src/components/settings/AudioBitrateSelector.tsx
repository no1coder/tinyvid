import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { AUDIO_BITRATES } from "@/lib/constants";

export function AudioBitrateSelector() {
  const { t } = useTranslation();
  const { config, setAudioBitrate } = useSettingsStore();

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.audio.title")}</span>
      <select
        value={config.audioBitrate}
        onChange={(e) => setAudioBitrate(e.target.value)}
        className="cursor-pointer rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {AUDIO_BITRATES.map(({ value, label }) => (
          <option key={value} value={value} className="bg-[#2a2a2a]">
            {label.startsWith("settings.") ? t(label) : label}
          </option>
        ))}
      </select>
    </div>
  );
}
