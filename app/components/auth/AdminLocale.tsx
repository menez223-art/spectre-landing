"use client";

// لغة **لوحة الأدمن** — مستقلة تماماً عن لغة الموقع (قرار المالك).
//
// لماذا مستقلة؟
//   لغة الموقع محفوظة في `landing-studio-lang` ويختارها **الزائر**. لو استعملت
//   لوحة الأدمن نفس المفتاح، لانقلبت واجهتك الإدارية كلما بدّلت لغة العرض.
//   ⇒ مفتاح منفصل `admin-panel-lang` + قاموسه من نفس `i18n.ts` (بلا تكرار).
//
// الافتراضي **العربية** — كما كانت اللوحة دائماً، فلا يتغيّر شيء على المالك.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { translate, type I18nKey, type Lang } from "@/app/lib/i18n";

const ADMIN_LANG_KEY = "admin-panel-lang";

interface AdminLocaleValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

const AdminLocaleContext = createContext<AdminLocaleValue>({
  lang: "ar",
  dir: "rtl",
  setLang: () => {},
  t: (key) => translate("ar", key),
});

export function useAdminLocale(): AdminLocaleValue {
  return useContext(AdminLocaleContext);
}

export function AdminLangProvider({ children }: { children: React.ReactNode }) {
  // يبدأ "ar" على الخادم والعميل معاً ⇒ لا خطأ ترطيب.
  const [lang, setLangState] = useState<Lang>("ar");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ADMIN_LANG_KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {
      // تجاهل
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(ADMIN_LANG_KEY, l);
    } catch {
      // تجاهل
    }
  }, []);

  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  return (
    <AdminLocaleContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </AdminLocaleContext.Provider>
  );
}

// مفتاح تبديل اللغة — يُوضع في ترويسة الأدمن.
export function AdminLangToggle() {
  const { lang, setLang } = useAdminLocale();
  const next: Lang = lang === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      title={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
      className="rounded-full border border-navy-900/15 px-3 py-1.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 sm:px-4 sm:py-2 sm:text-[11px] dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400 min-h-[44px] touch-manipulation sm:min-h-0"
    >
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
