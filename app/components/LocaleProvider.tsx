"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { translate, type I18nKey, type Lang } from "@/app/lib/i18n";
import { EMPTY_SITE_COPY, type SiteCopy } from "@/app/lib/siteCopyShared";

const LANG_KEY = "landing-studio-lang";

interface LocaleContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
}

// القيمة الافتراضية تُستعمل خارج أي مزوّد (لا ينبغي أن يحدث، لكنها أمان).
const FALLBACK: LocaleContextValue = {
  lang: "en",
  dir: "ltr",
  setLang: () => {},
  t: (key) => key,
};

// ⚠️ null افتراضياً كي نُميّز «لا مزوّد» عن «مزوّد جذري» — فيمكن لمزوّد متداخل
// أن يرث اللغة من الأعلى بدل أن ينشئ حالة لغة ثانية تتعارض معها.
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? FALLBACK;
}

// مزوّد اللغة — يحفظ الاختيار في localStorage ويطبّق lang/dir على عنصر html
// الافتراضي للزائر الجديد: الإنجليزية (en). يمكنه التبديل للعربية في أي وقت.
// ملاحظة: «بسم الله» مكتوبة عربياً ثابتة في الترويسة (lang="ar" translate="no") ولا تتأثر باللغة.
//
// `overrides` اختيارية: تجاوزات نصوص المالك (من «الإعدادات المتقدمة»).
// عند تمريرها يُنشأ **مزوّد متداخل** يورث اللغة من المزوّد الجذري ويضيف التجاوزات
// فقط — فلا حالتان للغة، ولا تكرار لتأثيرات المستند.
export function LocaleProvider({
  children,
  overrides,
}: {
  children: React.ReactNode;
  overrides?: SiteCopy;
}) {
  const outer = useContext(LocaleContext);
  const [ownLang, setOwnLang] = useState<Lang>("en");

  // متداخل ⇒ نورث اللغة من الأعلى؛ جذري ⇒ حالتنا الخاصة.
  const lang: Lang = outer ? outer.lang : ownLang;
  const setLang = useCallback(
    (l: Lang) => (outer ? outer.setLang(l) : setOwnLang(l)),
    [outer]
  );
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";

  // قراءة اللغة المحفوظة بعد التركيب — للمزوّد الجذري فقط.
  // حارس first-run: مع React StrictMode تُعاد تشغيل التأثيرات مرتين؛ لو أُعيد
  // هذا التأثير بعد أن غيّر المستخدم اللغة، كان الاستعادة تكتب فوق اختياره.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (outer || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "en" || saved === "ar") setOwnLang(saved);
    } catch {
      // تجاهل
    }
  }, [outer]);

  // تطبيق الاتجاه واللغة + الحفظ — للمزوّد الجذري فقط.
  useEffect(() => {
    if (outer) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      // تجاهل
    }
  }, [lang, dir, outer]);

  const ov = overrides ?? EMPTY_SITE_COPY;
  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) => {
      // التجاوز أولاً (إن كان نصاً غير فارغ)، وإلا القاموس المدمج.
      const custom = ov[lang]?.[key];
      if (custom && custom.trim()) return custom;
      return translate(lang, key, vars);
    },
    [lang, ov]
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
