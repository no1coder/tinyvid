import { useCallback, useEffect, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export function useNotification() {
  const permissionRef = useRef(false);

  useEffect(() => {
    async function checkPermission() {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      permissionRef.current = granted;
    }
    checkPermission().catch(console.error);
  }, []);

  const notify = useCallback((title: string, body: string) => {
    if (!permissionRef.current) return;
    sendNotification({ title, body });
  }, []);

  return { notify };
}
