import { useCallback, useState } from "react";
import { probeVideos } from "@/lib/tauri";
import { useTaskStore } from "@/stores/taskStore";

export function useFileImport() {
  const { addVideos } = useTaskStore();
  const [isProbing, setIsProbing] = useState(false);

  const importFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setIsProbing(true);
      try {
        const videos = await probeVideos(paths);
        if (videos.length > 0) {
          addVideos(videos);
        }
      } catch (err) {
        console.error("Failed to probe videos:", err);
      } finally {
        setIsProbing(false);
      }
    },
    [addVideos],
  );

  return { importFiles, isProbing };
}
