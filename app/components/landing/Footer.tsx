// التذييل
import type { Product } from "@/app/lib/types";
import { useLandingLang } from "./LandingLang";

// رابط الموقع الرئيسي — يُحقن إجبارياً في كل صفحة هبوط منتجة.
const SITE_HOME_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://spectre-dz.vercel.app/";

export function Footer({ product }: { product: Product }) {
  const { t } = useLandingLang();
  return (
    <footer className="container-landing flex flex-col justify-between gap-4 border-t border-[var(--c-border)] py-8 text-xs text-[var(--c-muted)] sm:flex-row">
      <p>© 2026 {product.brand ?? product.name}. {t("footerCustom", { name: product.name })}</p>
      <p>{t("footerDelivery")}</p>
      <p>
        <a href={SITE_HOME_URL} target="_blank" rel="noopener" className="font-bold text-[var(--c-accent)] hover:underline">
          Studio Store Gen
        </a>
      </p>
    </footer>
  );
}
