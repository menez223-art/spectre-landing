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
      className="neu-circle"
    >
      <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"}`} aria-hidden="true" />
    </button>
  );
}
