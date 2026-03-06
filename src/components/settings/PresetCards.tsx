import { useTranslation } from "react-i18next";
import type { LucideProps } from "lucide-react";
import { Share2, Scale, Archive } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { COMPRESSION_PRESETS } from "@/lib/constants";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  share: Share2,
  scale: Scale,
  archive: Archive,
};

export function PresetCards() {
  const { t } = useTranslation();
  const { activePreset, applyPreset } = useSettingsStore();

  return (
    <div className="flex gap-2">
      {COMPRESSION_PRESETS.map((preset) => {
        const Icon = ICONS[preset.icon];
        const isActive = activePreset === preset.id;

        return (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-all ${
              isActive
                ? "bg-primary/15 ring-1 ring-primary/50 shadow-sm shadow-primary/10"
                : "bg-[rgba(255,255,255,0.05)] ring-1 ring-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.08)]"
            }`}
          >
            {Icon && (
              <Icon
                size={18}
                className={
                  isActive ? "text-primary" : "text-muted-foreground"
                }
              />
            )}
            <span
              className={`text-[12px] font-medium ${
                isActive ? "text-primary" : "text-foreground"
              }`}
            >
              {t(preset.labelKey)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t(preset.descKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
