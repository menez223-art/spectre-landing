"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { translate, type I18nKey, type Lang } from "@/app/lib/i18n";

const LANG_KEY = "landing-studio-lang";

interface LocaleContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  lang: "en",
  dir: "ltr",
  setLang: () => {},
  t: (key) => key,
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

// مزوّد اللغة — يحفظ الاختيار في localStorage ويطبّق lang/dir على عنصر html
// الافتراضي للزائر الجديد: الإنجليزية (en). يمكنه التبديل للعربية في أي وقت.
// ملاحظة: «بسم الله» مكتوبة عربياً ثابتة في الترويسة (lang="ar" translate="no") ولا تتأثر باللغة.
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  // قراءة اللغة المحفوظة بعد التركيب
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {
      // تجاهل
    }
  }, []);

  // تطبيق الاتجاه واللغة + الحفظ
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      // تجاهل
    }
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang]
  );

  return (
    <LocaleContext.Provider value={{ lang, dir, setLang, t }}>{children}</LocaleContext.Provider>
  );
}
