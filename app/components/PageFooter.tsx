"use client";

import { useLocale } from "@/app/components/LocaleProvider";

/** PageFooter — سطرَين من تذييل الصفحة (footer1 / footer2 من i18n). */
export function PageFooter() {
  const { t } = useLocale();
  return (
    <footer className="neu-footer">
      <hr className="neu-divider" />
      <div className="neu-wrap flex flex-col justify-between gap-3 py-8 text-xs t-muted sm:flex-row">
        <p>{t("footer1")}</p>
        <p>{t("footer2")}</p>
      </div>
    </footer>
  );
}
