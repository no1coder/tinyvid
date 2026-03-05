import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { CodecSelector } from "./CodecSelector";
import { CrfSlider } from "./CrfSlider";
import { ResolutionSelector } from "./ResolutionSelector";
import { AudioBitrateSelector } from "./AudioBitrateSelector";
import { HardwareToggle } from "./HardwareToggle";
import { OutputDirSelector } from "./OutputDirSelector";
import { ConcurrencySelector } from "./ConcurrencySelector";

export function SettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          open
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
      >
        <Settings size={14} />
        {t("settings.title")}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("settings.title")}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover text-popover-foreground p-4 shadow-xl"
        >
          <div className="flex flex-col gap-4">
            <CodecSelector />
            <CrfSlider />
            <ResolutionSelector />
            <AudioBitrateSelector />
            <OutputDirSelector />
            <ConcurrencySelector />
            <HardwareToggle />
          </div>
        </div>
      )}
    </div>
  );
}
