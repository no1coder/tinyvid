import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, FolderOpen, FileVideo } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { SUPPORTED_FORMATS } from "@/lib/constants";

interface DropZoneProps {
  onFilesSelected: (paths: string[]) => void;
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, disabled }: DropZoneProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const paths = files
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => !!p);

      if (paths.length > 0) {
        onFilesSelected(paths);
      }
    },
    [disabled, onFilesSelected],
  );

  const handleBrowseFiles = async () => {
    if (disabled) return;
    const result = await open({
      multiple: true,
      filters: [
        {
          name: "Video",
          extensions: [...SUPPORTED_FORMATS],
        },
      ],
    });
    if (result) {
      const paths = Array.isArray(result) ? result : [result];
      onFilesSelected(paths);
    }
  };

  const handleBrowseFolder = async () => {
    if (disabled) return;
    const result = await open({ directory: true });
    if (result) {
      // When a directory is selected, pass it so the backend can scan for videos
      const dir = Array.isArray(result) ? result[0] : result;
      if (dir) onFilesSelected([dir]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {isDragging ? (
        <>
          <Upload size={32} className="mb-2 text-primary" />
          <p className="text-sm font-medium text-primary">
            {t("dropzone.dragging")}
          </p>
        </>
      ) : (
        <>
          <FileVideo size={32} className="mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">{t("dropzone.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("dropzone.subtitle")}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleBrowseFiles}
              disabled={disabled}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("dropzone.browse")}
            </button>
            <button
              onClick={handleBrowseFolder}
              disabled={disabled}
              className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              <FolderOpen size={12} />
              {t("dropzone.browseFolder")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
