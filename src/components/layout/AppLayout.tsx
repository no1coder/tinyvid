import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";
import { ToastContainer } from "./ToastContainer";
import { Sidebar } from "./Sidebar";
import type { UpdateInfo } from "@/types";

interface AppLayoutProps {
  children: React.ReactNode;
  updateInfo?: UpdateInfo | null;
  onDismissUpdate?: () => void;
}

export function AppLayout({ children, updateInfo, onDismissUpdate }: AppLayoutProps) {
  const { t } = useTranslation();
  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag on left mouse button, not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea")) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  };

  return (
    <div className="flex h-screen overflow-hidden rounded-[14px]">
      <ToastContainer />
      <Sidebar updateInfo={updateInfo} onDismissUpdate={onDismissUpdate} />
      {/* mainContent — design: padding [32, 40], gap 32 */}
      <div className="relative flex flex-1 flex-col gap-8 overflow-hidden px-10 pt-8">
        {/* Drag region — covers header area for window dragging */}
        <div
          onMouseDown={handleDragStart}
          className="absolute inset-x-0 top-0 z-10 h-12"
        />

        {/* Header */}
        <header className="relative z-20 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TinyVid" className="h-10 w-10 rounded-lg" />
            <div className="flex flex-col gap-1">
              <h1
                className="text-[24px] font-bold leading-tight tracking-tight"
                style={{
                  background: "linear-gradient(135deg, #0a84ff 0%, #a855f7 50%, #f97316 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {t("app.title")}
              </h1>
              <span className="text-[14px] text-muted-foreground">
                {t("app.subtitle")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LanguageSwitch />
          </div>
        </header>

        {/* Main content — fills remaining space */}
        <main className="flex-1 overflow-hidden pb-8">{children}</main>
      </div>
    </div>
  );
}
