import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { FILENAME_TEMPLATES } from "@/lib/constants";

export function FilenameTemplateSelector() {
  const { t } = useTranslation();
  const { config, setFilenameTemplate } = useSettingsStore();

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "-");

  const preview = config.filenameTemplate
    .replace("{name}", "video")
    .replace("{date}", dateStr)
    .replace("{time}", timeStr)
    .replace("{codec}", config.codec)
    .replace("{resolution}", config.resolution);

  return (
    <div className="settings-row flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px]">{t("settings.filename.title")}</span>
        <select
          value={config.filenameTemplate}
          onChange={(e) => setFilenameTemplate(e.target.value)}
          className="cursor-pointer rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {FILENAME_TEMPLATES.map(({ value, labelKey }) => (
            <option key={value} value={value} className="bg-[#2a2a2a]">
              {t(labelKey)}
            </option>
          ))}
        </select>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {t("settings.filename.preview", {
          name: `${preview}.${config.outputFormat}`,
        })}
      </span>
    </div>
  );
}
