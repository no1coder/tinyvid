import { useTranslation } from "react-i18next";
import { Video } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSwitch } from "./LanguageSwitch";
import { useAppStore } from "@/stores/appStore";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { ffmpegReady, ffmpegVersion } = useAppStore();

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Video size={20} className="text-primary" />
          <h1 className="text-sm font-semibold">{t("app.title")}</h1>
          <span className="text-xs text-muted-foreground">
            {t("app.subtitle")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {ffmpegReady && ffmpegVersion && (
            <span className="text-xs text-muted-foreground">
              {ffmpegVersion.split(" ").slice(0, 3).join(" ")}
            </span>
          )}
          {!ffmpegReady && (
            <span className="text-xs text-destructive">
              {t("error.ffmpegNotFound")}
            </span>
          )}
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
