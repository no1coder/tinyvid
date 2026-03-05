import { useTranslation } from "react-i18next";
import { CrfSlider } from "./CrfSlider";
import { CodecSelector } from "./CodecSelector";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioBitrateSelector } from "./AudioBitrateSelector";
import { OutputDirSelector } from "./OutputDirSelector";
import { ConcurrencySelector } from "./ConcurrencySelector";
import { HardwareToggle } from "./HardwareToggle";

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-[480px] py-2">
        <div className="flex flex-col gap-6">
          {/* Compression Quality */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("settings.compressionQuality")}
            </h3>
            <div className="flex flex-col gap-0.5">
              <CodecSelector />
              <CrfSlider />
              <ResolutionSelector />
              <AudioBitrateSelector />
            </div>
          </section>

          {/* Preferences */}
          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-muted-foreground">
              {t("settings.preferences")}
            </h3>
            <div className="flex flex-col gap-0.5">
              <HardwareToggle />
              <OutputDirSelector />
              <ConcurrencySelector />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
