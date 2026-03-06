import { useTranslation } from "react-i18next";
import { Upload, Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  SUPPORTED_FORMATS,
  SUPPORTED_IMAGE_FORMATS,
  ALL_SUPPORTED_FORMATS,
} from "@/lib/constants";
import { useTauriDragDrop } from "@/hooks/useTauriDragDrop";

type AcceptMode = "all" | "video" | "image";

interface DropZoneProps {
  onFilesSelected: (paths: string[]) => void;
  disabled?: boolean;
  mode?: "full" | "compact";
  accept?: AcceptMode;
}

function getDialogFilter(accept: AcceptMode) {
  switch (accept) {
    case "video":
      return [{ name: "Video", extensions: [...SUPPORTED_FORMATS] }];
    case "image":
      return [{ name: "Images", extensions: [...SUPPORTED_IMAGE_FORMATS] }];
    default:
      return [{ name: "Media", extensions: [...ALL_SUPPORTED_FORMATS] }];
  }
}

export function DropZone({
  onFilesSelected,
  disabled,
  mode = "full",
  accept = "all",
}: DropZoneProps) {
  const { t } = useTranslation();

  // Use Tauri's native drag-drop event (works with system file manager)
  const { isDragging } = useTauriDragDrop(
    (paths) => {
      if (!disabled) {
        onFilesSelected(paths);
      }
    },
    !disabled,
  );

  const handleBrowseFiles = async () => {
    if (disabled) return;
    const result = await open({
      multiple: true,
      filters: getDialogFilter(accept),
    });
    if (result) {
      onFilesSelected(Array.isArray(result) ? result : [result]);
    }
  };

  // Compact mode: Add Files button matching design spec
  if (mode === "compact") {
    return (
      <button
        onClick={handleBrowseFiles}
        disabled={disabled}
        className="compact-add-btn flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all hover:brightness-125"
      >
        <Plus size={16} />
        {t("dropzone.addMore")}
      </button>
    );
  }

  // Full mode: centered dropzone matching design exactly
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleBrowseFiles}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleBrowseFiles();
        }
      }}
      aria-label={t("dropzone.title")}
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
