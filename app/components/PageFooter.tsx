"use client";

import { useLocale } from "@/app/components/LocaleProvider";

/** PageFooter — سطرَين من تذييل الصفحة (footer1 / footer2 من i18n). */
export function PageFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-navy-900/10 dark:border-white/10">
      <div className="container-landing flex flex-col justify-between gap-3 py-8 text-xs text-navy-900/50 sm:flex-row dark:text-ivory-50/50">
        <p>{t("footer1")}</p>
        <p>{t("footer2")}</p>
      </div>
    </footer>
  );
}
