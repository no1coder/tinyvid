import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { probeVideos } from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { useAppStore } from "@/stores/appStore";

const COMPRESSED_PATTERN = /_compressed(?:_\d+)?\.mp4$/i;

export function useFileImport() {
  const { t } = useTranslation();
  const { addVideos } = useTaskStore();
  const { addToast } = useAppStore();
  const [isProbing, setIsProbing] = useState(false);

  const importFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;

      // Warn about already-compressed files
      const compressedPaths = paths.filter((p) => COMPRESSED_PATTERN.test(p));
      const freshPaths = paths.filter((p) => !COMPRESSED_PATTERN.test(p));

      if (compressedPaths.length > 0) {
        addToast({
          type: "warning",
          message: t("error.alreadyCompressed", { count: compressedPaths.length }),
        });
      }

      const pathsToProbe = freshPaths.length > 0 ? freshPaths : paths;

      setIsProbing(true);
      try {
        const videos = await probeVideos(pathsToProbe);
        if (videos.length > 0) {
          addVideos(videos);
        }
      } catch (err) {
        console.error("Failed to probe videos:", err);
      } finally {
        setIsProbing(false);
      }
    },
    [addVideos, addToast, t],
  );

  return { importFiles, isProbing };
}
