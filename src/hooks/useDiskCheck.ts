import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { checkDiskSpace } from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { formatFileSize } from "@/lib/format";

export function useDiskCheck() {
  const { t } = useTranslation();
  const [diskWarning, setDiskWarning] = useState<string | null>(null);

  const checkDisk = useCallback(
    async (videos: { path: string; size: number }[], outputDir: string | null) => {
      setDiskWarning(null);

      const currentTasks = useTaskStore.getState().tasks;
      const totalEstimated =
        currentTasks.length > 0
          ? currentTasks.reduce(
              (sum, t) => sum + (t.estimatedOutputSize ?? t.inputSize),
              0,
            )
          : videos.reduce((sum, v) => sum + v.size, 0);

      const outputCheckDir =
        outputDir ??
        (() => {
          const lastSlash = videos[0].path.lastIndexOf("/");
          return lastSlash > 0 ? videos[0].path.substring(0, lastSlash) : "/";
        })();

      try {
        const diskInfo = await checkDiskSpace(outputCheckDir, totalEstimated);
        if (!diskInfo.sufficient) {
          setDiskWarning(
            t("error.insufficientDisk", {
              available: formatFileSize(diskInfo.availableBytes),
              required: formatFileSize(diskInfo.requiredBytes),
            }),
          );
          return false;
        }
        if (diskInfo.tight) {
          setDiskWarning(
            t("error.tightDisk", {
              available: formatFileSize(diskInfo.availableBytes),
            }),
          );
        }
        return true;
      } catch {
        // Continue if check itself fails
        return true;
      }
    },
    [t],
  );

  const dismissDiskWarning = useCallback(() => {
    setDiskWarning(null);
  }, []);

  return { diskWarning, checkDisk, dismissDiskWarning };
}
