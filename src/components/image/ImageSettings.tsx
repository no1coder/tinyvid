import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { Folder } from "lucide-react";
import { useImageStore } from "@/stores/imageStore";
import {
  IMAGE_OUTPUT_FORMATS,
  IMAGE_FILENAME_TEMPLATES,
} from "@/lib/constants";
import type { ImageCompressionMode, ImageOutputFormat } from "@/types";

export function ImageSettings() {
  const { t } = useTranslation();
  const {
    config,
    setMode,
    setQuality,
    setOutputFormat,
    setOutputDir,
    setFilenameTemplate,
    setKeepMetadata,
  } = useImageStore();

  const handleBrowseDir = async () => {
    const result = await open({ directory: true });
    if (result) {
      setOutputDir(result as string);
    }
  };

  return (
    <div className="flex w-full shrink-0 flex-col gap-4 rounded-xl bg-white/[0.03] p-4">


      {/* Mode toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("image.settings.mode")}
        </label>
        <div className="flex rounded-lg bg-white/[0.04] p-0.5">
          {(["lossless", "lossy"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setMode(mode as ImageCompressionMode)}
              className={`flex-1 rounded-md py-1.5 text-[12px] font-medium transition-all ${
                config.mode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`image.settings.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Quality slider (lossy only) */}
      {config.mode === "lossy" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            {t("image.settings.quality")} — {config.quality}%
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={config.quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/60">
            <span>{t("image.settings.qualitySmaller")}</span>
            <span>{t("image.settings.qualityBetter")}</span>
          </div>
        </div>
      )}

      {/* Output format */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("image.settings.outputFormat")}
        </label>
        <div className="grid grid-cols-2 gap-1">
          {IMAGE_OUTPUT_FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              onClick={() => setOutputFormat(fmt.value as ImageOutputFormat)}
              className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
                config.outputFormat === fmt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              {"labelKey" in fmt ? t(fmt.labelKey) : fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filename template */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("image.settings.filename")}
        </label>
        <div className="flex flex-col gap-1">
          {IMAGE_FILENAME_TEMPLATES.map((tpl) => (
            <button
              key={tpl.value}
              onClick={() => setFilenameTemplate(tpl.value)}
              className={`rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-all ${
                config.filenameTemplate === tpl.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(tpl.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Output directory */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("image.settings.outputDir")}
        </label>
        <button
          onClick={handleBrowseDir}
          className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-all hover:text-foreground"
        >
          <Folder size={12} />
          <span className="truncate">
            {config.outputDir || t("image.settings.sameAsInput")}
          </span>
        </button>
        {config.outputDir && (
          <button
            onClick={() => setOutputDir(null)}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground"
          >
            {t("image.settings.resetDir")}
          </button>
        )}
      </div>

      {/* Keep metadata */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t("image.settings.keepMetadata")}
        </label>
        <button
          onClick={() => setKeepMetadata(!config.keepMetadata)}
          className={`h-5 w-9 rounded-full transition-all ${
            config.keepMetadata ? "bg-primary" : "bg-white/[0.1]"
          }`}
        >
          <div
            className={`h-4 w-4 rounded-full bg-white transition-transform ${
              config.keepMetadata ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
