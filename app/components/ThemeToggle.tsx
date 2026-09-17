"use client";

import { useTheme } from "./ThemeProvider";
import { useLocale } from "./LocaleProvider";

type ThemeLabels = { light: string; dark: string; toLight: string; toDark: string };

// زر تبديل الوضع الليلي — يستخدم موفّر الثيم.
// النصوص تتبع لغة الموقع افتراضياً، ويمكن تمرير تسميات بديلة (لوحة الأدمن
// لها لغتها المستقلة، فلا يصحّ أن يبقى الزر عربياً في واجهة إنجليزية).
export function ThemeToggle({ labels }: { labels?: ThemeLabels } = {}) {
  const { isDark, toggle } = useTheme();
  const { t } = useLocale();
  const L: ThemeLabels =
    labels ?? {
      light: t("themeLight"),
      dark: t("themeDark"),
      toLight: t("themeToLight"),
      toDark: t("themeToDark"),
    };
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? L.toLight : L.toDark}
      aria-label={isDark ? L.toLight : L.toDark}
      className="rounded-full border border-navy-900/15 bg-white px-3 py-1.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/10 dark:bg-[#161b22] dark:text-ivory-50 dark:hover:border-navy-400"
    >
      <span aria-hidden className="text-sm leading-none">
        {isDark ? "☀" : "☾"}
      </span>
      <span className="ms-1.5 hidden sm:inline">{isDark ? L.light : L.dark}</span>
    </button>
  );
}
