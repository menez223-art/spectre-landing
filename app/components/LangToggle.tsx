"use client";

import { useLocale } from "./LocaleProvider";

// حبة مبدّل اللغة — تُوضع في ترويسة الرئيسية والاستوديو
export function LangToggle() {
  const { lang, setLang } = useLocale();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="rounded-full border border-navy-900/15 px-3.5 py-1.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900"
      title={lang === "ar" ? "English" : "عربي"}
    >
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
