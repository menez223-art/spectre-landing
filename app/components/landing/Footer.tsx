// التذييل
import type { Product } from "@/app/lib/types";
import { useLandingLang } from "./LandingLang";

export function Footer({ product }: { product: Product }) {
  const { t } = useLandingLang();
  return (
    <footer className="container-landing flex flex-col justify-between gap-4 border-t border-[var(--c-border)] py-8 text-xs text-[var(--c-muted)] sm:flex-row">
      <p>© 2026 {product.brand ?? product.name}. {t("footerCustom", { name: product.name })}</p>
      <p>{t("footerDelivery")}</p>
    </footer>
  );
}
