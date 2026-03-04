import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { CodecSelector } from "./CodecSelector";
import { CrfSlider } from "./CrfSlider";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioBitrateSelector } from "./AudioBitrateSelector";
import { HardwareToggle } from "./HardwareToggle";

export function ParameterPanel() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
      </div>
      <CodecSelector />
      <CrfSlider />
      <ResolutionSelector />
      <AudioBitrateSelector />
      <HardwareToggle />
    </div>
  );
}
