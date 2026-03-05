import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import type { Language } from "@/types";

export function LanguageSwitch() {
  const { language, setLanguage } = useAppStore();
  const { i18n } = useTranslation();

  const toggle = () => {
    const next: Language = language === "en" ? "zh-CN" : "en";
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="glass-btn flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold transition-all"
    >
      <Globe size={16} />
      {language === "en" ? "EN" : "中"}
    </button>
  );
}
