import { useTranslation } from "react-i18next";
import { FolderOpen, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settingsStore";

export function OutputDirSelector() {
  const { t } = useTranslation();
  const { config, setOutputDir } = useSettingsStore();

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("settings.output.title"),
    });
    if (typeof selected === "string") {
      setOutputDir(selected);
    }
  };

  return (
    <div className="settings-row flex items-center justify-between px-4 py-3">
      <span className="text-[14px]">{t("settings.output.title")}</span>
      {config.outputDir ? (
        <div className="flex items-center gap-1.5">
          <span className="max-w-[200px] truncate rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px]">
            {config.outputDir.split("/").pop()}
          </span>
          <button
            onClick={handleBrowse}
            className="rounded-md p-1 text-muted-foreground transition-all hover:text-foreground"
            title={t("settings.output.change")}
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => setOutputDir(null)}
            className="rounded-md p-1 text-muted-foreground transition-all hover:text-destructive"
            title={t("settings.output.sameAsInput")}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleBrowse}
          className="flex items-center gap-1.5 rounded-md bg-[rgba(255,255,255,0.1)] px-2 py-1 text-[12px] text-muted-foreground transition-all hover:text-foreground"
        >
          <FolderOpen size={12} />
          {t("settings.output.sameAsInput")}
        </button>
      )}
    </div>
  );
}
