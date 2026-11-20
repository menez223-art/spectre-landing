"use client";

import { useLocale } from "./LocaleProvider";

// حبة مبدّل اللغة — تُوضع في ترويسة الرئيسية والاستوديو
export function LangToggle() {
  const { lang, setLang } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="neu-circle"
      title={lang === "ar" ? "English" : "عربي"}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {lang === "ar" ? "EN" : "AR"}
    </button>
  );
}
