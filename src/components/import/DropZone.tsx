import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { SUPPORTED_FORMATS } from "@/lib/constants";

interface DropZoneProps {
  onFilesSelected: (paths: string[]) => void;
  disabled?: boolean;
  mode?: "full" | "compact";
}

export function DropZone({
  onFilesSelected,
  disabled,
  mode = "full",
}: DropZoneProps) {
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
      filters: [{ name: "Video", extensions: [...SUPPORTED_FORMATS] }],
    });
    if (result) {
      onFilesSelected(Array.isArray(result) ? result : [result]);
    }
  };

  // Compact mode: Add Files button matching design spec
  if (mode === "compact") {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          onClick={handleBrowseFiles}
          disabled={disabled}
          className="compact-add-btn flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all hover:brightness-125"
        >
          <Plus size={16} />
          {t("dropzone.addMore")}
        </button>
      </div>
    );
  }

  // Full mode: centered dropzone matching design exactly
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowseFiles}
      className={`flex h-full w-full flex-col items-center justify-center rounded-[20px] transition-all ${
        isDragging ? "glass-dropzone-active" : "glass-dropzone"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ gap: 24 }}
    >
      {/* Blue upload icon with circular background */}
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#0a84ff26]">
        <Upload size={32} className="text-primary" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-[20px] font-semibold">
          {isDragging ? t("dropzone.dragging") : t("dropzone.title")}
        </p>
        <p className="text-[14px] text-muted-foreground">
          {t("dropzone.subtitle")}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleBrowseFiles();
        }}
        disabled={disabled}
        className="rounded-[10px] bg-primary px-6 py-3 text-[14px] font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
        style={{ boxShadow: "0 4px 12px #0a84ff4d" }}
      >
        {t("dropzone.browse")}
      </button>
    </div>
  );
}
