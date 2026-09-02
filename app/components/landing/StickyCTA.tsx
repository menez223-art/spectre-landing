// زر الطلب الثابت — يظهر فقط على الهواتف، ويغيب في المعاينة
import type { Product } from "@/app/lib/types";
import { formatDZD } from "@/app/data/delivery";
import { useLandingLang } from "./LandingLang";

export function StickyCTA({ product }: { product: Product }) {
  const { t } = useLandingLang();
  return (
    <div
      className="cta-rise fixed inset-x-0 bottom-0 z-50 border-t border-[var(--c-border)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      style={{ backgroundColor: "var(--c-sticky-bg)" }}
    >
      <div className="container-landing flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-[var(--c-muted)]">{product.name}</p>
          <p className="font-display text-lg font-extrabold text-[var(--c-text)]">
            {formatDZD(product.price)}
            <span className="ms-2 align-middle text-[10px] font-bold text-[var(--c-muted)]">
              {t("stickyDelivery")}
            </span>
          </p>
        </div>
        <a
          href="#order"
          className="shrink-0 rounded-full bg-gradient-to-l from-[var(--c-primary)] to-[var(--c-primary-strong)] px-7 py-3.5 text-sm font-bold text-[var(--c-primary-text)] shadow-lg shadow-[var(--c-glow)] transition active:scale-95"
        >
          {t("orderNow")} ←
        </a>
      </div>
    </div>
  );
}
