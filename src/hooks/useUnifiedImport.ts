import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { probeVideos, probeImages } from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";
import { useImageStore } from "@/stores/imageStore";
import { useUnifiedStore } from "@/stores/unifiedStore";
import { useAppStore } from "@/stores/appStore";
import {
  isVideoExtension,
  isImageExtension,
  getFileExtension,
} from "@/lib/constants";

const COMPRESSED_PATTERN = /_compressed(?:_\d+)?\.mp4$/i;

export function useUnifiedImport() {
  const { t } = useTranslation();
  const { addVideos } = useTaskStore();
  const { addImages } = useImageStore();
  const { addToOrder } = useUnifiedStore();
  const { addToast } = useAppStore();
  const [isProbing, setIsProbing] = useState(false);

  const importFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;

      // Classify by extension
      const videoPaths: string[] = [];
      const imagePaths: string[] = [];
      const unsupported: string[] = [];

      for (const p of paths) {
        const ext = getFileExtension(p);
        if (isVideoExtension(ext)) {
          videoPaths.push(p);
        } else if (isImageExtension(ext)) {
          imagePaths.push(p);
        } else {
          unsupported.push(p);
        }
      }

      if (unsupported.length > 0) {
        addToast({
          type: "warning",
          message: t("error.unsupportedFiles", { count: unsupported.length }),
        });
      }

      // Warn about already-compressed video files
      const compressedPaths = videoPaths.filter((p) =>
        COMPRESSED_PATTERN.test(p),
      );
      const freshVideoPaths = videoPaths.filter(
        (p) => !COMPRESSED_PATTERN.test(p),
      );

      if (compressedPaths.length > 0) {
        addToast({
          type: "warning",
          message: t("error.alreadyCompressed", {
            count: compressedPaths.length,
          }),
        });
      }

      const videoPathsToProbe =
        freshVideoPaths.length > 0 ? freshVideoPaths : videoPaths;

      if (videoPathsToProbe.length === 0 && imagePaths.length === 0) return;

      setIsProbing(true);
      try {
        // Probe videos and images in parallel
        const [videos, images] = await Promise.all([
          videoPathsToProbe.length > 0
            ? probeVideos(videoPathsToProbe)
            : Promise.resolve([]),
          imagePaths.length > 0
            ? probeImages(imagePaths)
            : Promise.resolve([]),
        ]);

        // Track import order (preserve the original order from paths)
        const importedPaths: string[] = [];
        const videoPathSet = new Set(videos.map((v) => v.path));
        const imagePathSet = new Set(images.map((i) => i.path));

        for (const p of paths) {
          if (videoPathSet.has(p) || imagePathSet.has(p)) {
            importedPaths.push(p);
          }
        }

        if (videos.length > 0) addVideos(videos);
        if (images.length > 0) addImages(images);
        if (importedPaths.length > 0) addToOrder(importedPaths);

        // Notify about skipped images
        if (images.length < imagePaths.length) {
          const skipped = imagePaths.length - images.length;
          addToast({
            type: "warning",
            message: t("image.error.unsupportedSkipped", { count: skipped }),
          });
        }
      } catch (err) {
        console.error("Failed to probe files:", err);
        addToast({
          type: "error",
          message: t("error.probeFailed", { error: String(err) }),
        });
      } finally {
        setIsProbing(false);
      }
    },
    [addVideos, addImages, addToOrder, addToast, t],
  );

  return { importFiles, isProbing };
}
