// شريط العروض + الترويسة — يُبنى تلقائياً حسب الأقسام الموجودة في المنتج
import type { Product } from "@/app/lib/types";
import { useLandingLang, LangToggle } from "./LandingLang";

// رابط الموقع الرئيسي — يُحقن إجبارياً في كل صفحة هبوط منتجة.
// قابل للتهيئة عبر NEXT_PUBLIC_SITE_URL كي يبقى صحيحاً عند نقل الملكية.
const SITE_HOME_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://spectre-dz.vercel.app/";

export function TopBar({ product }: { product: Product }) {
  const { t } = useLandingLang();
  return (
    <div
      style={{ background: "var(--c-promo-bg)" }}
      className="py-2.5 text-center text-xs font-semibold text-[var(--c-promo-text)]"
    >
      {product.name} · {t("promoDelivery")}
    </div>
  );
}

export function Header({ product }: { product: Product }) {
  const { t } = useLandingLang();
  const brand = product.brand ?? product.name.trim().split(/\s+/)[0];

  const navItems: { label: string; href: string }[] = [];
  navItems.push({ label: t("navProduct"), href: "#top" });
  if (product.features?.length) {
    navItems.push({
      label: product.theme.featuresLayout === "list" ? t("navSpecs") : t("navFeatures"),
      href: "#features",
    });
  }
  if (product.testimonials?.length) {
    navItems.push({ label: t("navTestimonials"), href: "#testimonials" });
  }
  if (product.extras) {
    navItems.push({ label: product.extras.eyebrow, href: `#${product.extras.id}` });
  }
  navItems.push({ label: t("navOrder"), href: "#order" });

  return (
    <header className="container-landing flex items-center justify-between py-4 sm:py-7">
      <a href="#top" className="font-display text-2xl font-extrabold tracking-tight text-[var(--c-text)]">
        {brand}
        <span className="text-[var(--c-accent)]">.</span>
      </a>
      <nav className="hidden items-center gap-8 text-sm text-[var(--c-muted)] md:flex" aria-label={t("navProduct")}>
        {navItems.map((item) => (
          <a key={item.href} href={item.href} className="transition-colors hover:text-[var(--c-accent)]">
            {item.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <LangToggle />
        <a
          href="#order"
          className="rounded-full border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-5 py-2.5 text-xs font-bold text-[var(--c-text)] backdrop-blur transition hover:bg-[var(--c-primary)] hover:text-[var(--c-primary-text)]"
        >
          {t("orderNow")}
        </a>
        <a
          href={SITE_HOME_URL}
          target="_blank"
          rel="noopener"
          className="hidden rounded-full border border-[var(--c-border)] px-3.5 py-2.5 text-xs font-bold text-[var(--c-muted)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] sm:inline-flex"
        >
          Studio Store Gen
        </a>
      </div>
    </header>
  );
}
