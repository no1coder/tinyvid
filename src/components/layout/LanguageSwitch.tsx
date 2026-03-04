import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/appStore";
import type { Language } from "@/types";

const languages: { value: Language; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh-CN", label: "中文" },
];

export function LanguageSwitch() {
  const { language, setLanguage } = useAppStore();
  const { i18n } = useTranslation();

  const handleChange = (lang: Language) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      {languages.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            language === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
