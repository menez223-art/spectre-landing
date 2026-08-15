"use client";

import { useTheme } from "./ThemeProvider";

// زر تبديل الوضع الليلي — يستخدم موفّر الثيم.
export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
      aria-label={isDark ? "الوضع النهاري" : "الوضع الليلي"}
      className="rounded-full border border-navy-900/15 bg-white px-3 py-1.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/10 dark:bg-[#161b22] dark:text-ivory-50 dark:hover:border-navy-400"
    >
      <span aria-hidden className="text-sm leading-none">
        {isDark ? "☀" : "☾"}
      </span>
      <span className="ms-1.5 hidden sm:inline">{isDark ? "نهاري" : "ليلي"}</span>
    </button>
  );
}
