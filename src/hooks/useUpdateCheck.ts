import { useEffect, useCallback, useState } from "react";
import { APP_VERSION, GITHUB_REPO, UPDATE_CHECK_INTERVAL } from "@/lib/constants";
import type { UpdateInfo } from "@/types";

const STORAGE_KEY = "tinyvid-last-update-check";
const DISMISSED_KEY = "tinyvid-dismissed-version";

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json" } },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const latestVersion = (data.tag_name as string).replace(/^v/, "");
    const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;

    return {
      hasUpdate,
      latestVersion,
      currentVersion: APP_VERSION,
      releaseUrl: data.html_url ?? "",
      releaseNotes: data.body ?? "",
    };
  } catch {
    return null;
  }
}

export function useUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const checkForUpdate = useCallback(async () => {
    const info = await fetchLatestRelease();
    if (info?.hasUpdate) {
      // Skip if user dismissed this version
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === info.latestVersion) return;
      setUpdateInfo(info);
    }
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }, []);

  const dismissUpdate = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem(DISMISSED_KEY, updateInfo.latestVersion);
    }
    setUpdateInfo(null);
  }, [updateInfo]);

  useEffect(() => {
    // Check on mount if enough time has passed
    const lastCheck = Number(localStorage.getItem(STORAGE_KEY) || "0");
    const elapsed = Date.now() - lastCheck;
    if (elapsed >= UPDATE_CHECK_INTERVAL) {
      checkForUpdate();
    }

    // Periodic check
    const timer = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, [checkForUpdate]);

  return { updateInfo, checkForUpdate, dismissUpdate };
}
