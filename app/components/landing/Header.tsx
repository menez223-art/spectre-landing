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
      <div className="flex items-center gap-2 sm:gap-3">
        <LangToggle />
        <a
          href="#order"
          className="rounded-full border border-[var(--c-border-strong)] bg-[var(--c-surface)] px-4 py-2 text-[11px] font-bold text-[var(--c-text)] backdrop-blur transition hover:bg-[var(--c-primary)] hover:text-[var(--c-primary-text)] sm:px-5 sm:py-2.5 sm:text-xs"
        >
          {t("orderNow")}
        </a>
        {/* زر "Studio Store Gen" — يظهر في كل صفحة هبوط (جوال وديسكتوب).
            يأخذ المستخدم إلى الصفحة الرئيسية لـ spectre-dz في نفس التبويب
            (ملكية الصفحة المنشأة تذهب للزائر بعد الآن). */}
        <a
          href={SITE_HOME_URL}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--c-muted)] backdrop-blur transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-xs"
          aria-label="Studio Store Gen"
        >
          <span aria-hidden>✨</span>
          <span>Studio Store Gen</span>
        </a>
      </div>
    </header>
  );
}
