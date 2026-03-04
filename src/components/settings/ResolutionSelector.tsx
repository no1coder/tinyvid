import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { RESOLUTIONS } from "@/lib/constants";

export function ResolutionSelector() {
  const { t } = useTranslation();
  const { config, setResolution } = useSettingsStore();

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {t("settings.resolution.title")}
      </label>
      <select
        value={config.resolution}
        onChange={(e) => setResolution(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
      >
        {RESOLUTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label.startsWith("settings.") ? t(label) : label}
          </option>
        ))}
      </select>
    </div>
  );
}
