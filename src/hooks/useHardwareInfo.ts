import { useEffect } from "react";
import { detectHardware, getFfmpegVersion } from "@/lib/tauri";
import { useAppStore } from "@/stores/appStore";

export function useHardwareInfo() {
  const { setEncoders, setFfmpegReady, setFfmpegVersion } = useAppStore();

  useEffect(() => {
    const init = async () => {
      try {
        const [encoders, version] = await Promise.all([
          detectHardware(),
          getFfmpegVersion(),
        ]);
        setEncoders(encoders);
        setFfmpegVersion(version);
        setFfmpegReady(true);
      } catch (err) {
        console.error("FFmpeg detection failed:", err);
        setFfmpegReady(false);
      }
    };
    init();
  }, [setEncoders, setFfmpegReady, setFfmpegVersion]);
}
