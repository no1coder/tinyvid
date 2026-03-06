import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { probeImages } from "@/lib/tauri";
import { useImageStore } from "@/stores/imageStore";
import { useAppStore } from "@/stores/appStore";

export function useImageImport() {
  const { t } = useTranslation();
  const { addImages } = useImageStore();
  const { addToast } = useAppStore();
  const [isProbing, setIsProbing] = useState(false);

  const importFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;

      setIsProbing(true);
      try {
        const images = await probeImages(paths);
        if (images.length > 0) {
          addImages(images);
        }
        if (images.length < paths.length) {
          const skipped = paths.length - images.length;
          addToast({
            type: "warning",
            message: t("image.error.unsupportedSkipped", { count: skipped }),
          });
        }
      } catch (err) {
        console.error("Failed to probe images:", err);
        addToast({
          type: "error",
          message: t("image.error.probeFailed", { error: String(err) }),
        });
      } finally {
        setIsProbing(false);
      }
    },
    [addImages, addToast, t],
  );

  return { importFiles, isProbing };
}
