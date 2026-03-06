import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { PresetCards } from "./PresetCards";
import { SettingsTabs } from "./SettingsTabs";
import { QualitySelector } from "./QualitySelector";
import { CrfSlider } from "./CrfSlider";
import { CodecSelector } from "./CodecSelector";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioBitrateSelector } from "./AudioBitrateSelector";
import { OutputDirSelector } from "./OutputDirSelector";
import { OutputFormatSelector } from "./OutputFormatSelector";
import { FilenameTemplateSelector } from "./FilenameTemplateSelector";
import { ConcurrencySelector } from "./ConcurrencySelector";
import { FpsSelector } from "./FpsSelector";
import { HardwareToggle } from "./HardwareToggle";
import { ImageSettings } from "@/components/image/ImageSettings";

export function SettingsPage() {
  const { t } = useTranslation();
  const { settingsMode } = useSettingsStore();
  const isPro = settingsMode === "professional";

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-[480px] py-2">
        <div className="flex flex-col gap-6">
          {/* Quick Presets */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("settings.quickPresets")}
            </h3>
            <PresetCards />
          </section>

          {/* Mode Tabs */}
          <SettingsTabs />

          {/* Compression Quality */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("settings.compressionQuality")}
            </h3>
            <div className="flex flex-col gap-0.5">
              {isPro && <CodecSelector />}
              {!isPro && <QualitySelector />}
              {isPro && <CrfSlider />}
              {isPro && <ResolutionSelector />}
              {isPro && <FpsSelector />}
              {isPro && <AudioBitrateSelector />}
            </div>
          </section>

          {/* Preferences */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("settings.preferences")}
            </h3>
            <div className="flex flex-col gap-0.5">
              <OutputFormatSelector />
              <OutputDirSelector />
              {isPro && <FilenameTemplateSelector />}
              {isPro && <HardwareToggle />}
              {isPro && <ConcurrencySelector />}
            </div>
          </section>

          {/* Image Compression Settings */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("image.settings.title")}
            </h3>
            <ImageSettings />
          </section>
        </div>
      </div>
    </div>
  );
}
