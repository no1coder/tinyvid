import { useTranslation } from "react-i18next";
import { X, Trash2 } from "lucide-react";
import type { VideoInfo } from "@/types";
import { formatFileSize, formatDuration } from "@/lib/format";

interface FileListProps {
  videos: VideoInfo[];
  onRemove: (path: string) => void;
  onClearAll: () => void;
}

export function FileList({ videos, onRemove, onClearAll }: FileListProps) {
  const { t } = useTranslation();

  if (videos.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        {t("fileList.empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs text-muted-foreground">
          {videos.length} file{videos.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 size={12} />
          {t("fileList.clearAll")}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr className="border-b border-border text-left">
              <th className="px-3 py-1.5 font-medium">{t("fileList.name")}</th>
              <th className="px-3 py-1.5 font-medium text-right">
                {t("fileList.resolution")}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">
                {t("fileList.duration")}
              </th>
              <th className="px-3 py-1.5 font-medium text-right">
                {t("fileList.size")}
              </th>
              <th className="px-3 py-1.5 font-medium text-center">
                {t("fileList.codec")}
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <tr
                key={video.path}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="max-w-[200px] truncate px-3 py-1.5">
                  {video.fileName}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {video.width}x{video.height}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {formatDuration(video.duration)}
                </td>
                <td className="px-3 py-1.5 text-right text-muted-foreground">
                  {formatFileSize(video.size)}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase">
                    {video.codec}
                  </span>
                </td>
                <td className="px-1 py-1.5">
                  <button
                    onClick={() => onRemove(video.path)}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
