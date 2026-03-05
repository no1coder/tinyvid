import { useTranslation } from "react-i18next";
import { Film, ListTodo, Settings, ArrowUpCircle, X } from "lucide-react";
import { useAppStore, type PageId } from "@/stores/appStore";
import { APP_VERSION } from "@/lib/constants";
import type { UpdateInfo } from "@/types";

const NAV_ITEMS: { id: PageId; icon: typeof Film; labelKey: string }[] = [
  { id: "compressor", icon: Film, labelKey: "nav.compressor" },
  { id: "tasks", icon: ListTodo, labelKey: "nav.tasks" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

interface SidebarProps {
  updateInfo?: UpdateInfo | null;
  onDismissUpdate?: () => void;
}

export function Sidebar({ updateInfo, onDismissUpdate }: SidebarProps) {
  const { t } = useTranslation();
  const { page, setPage } = useAppStore();

  return (
    <aside className="glass-sidebar flex w-[220px] shrink-0 flex-col px-4 py-5">
      {/* macOS traffic lights spacer */}
      <div className="h-5 shrink-0" />

      <nav className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => {
          const isActive = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-all ${
                isActive
                  ? "glass-active text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {t(labelKey)}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Update banner */}
      {updateInfo?.hasUpdate && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg bg-primary/10 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ArrowUpCircle size={14} className="text-primary" />
              <span className="text-[12px] font-medium text-primary">
                {t("version.updateAvailable", { version: updateInfo.latestVersion })}
              </span>
            </div>
            {onDismissUpdate && (
              <button
                onClick={onDismissUpdate}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            {t("version.download")}
          </a>
        </div>
      )}

      {/* Version */}
      <div className="px-2 text-[11px] text-muted-foreground/60">
        {t("version.current", { version: APP_VERSION })}
      </div>
    </aside>
  );
}
