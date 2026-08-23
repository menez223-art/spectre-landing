// قسم الطلب — العنوان والمزايا + نموذج الطلب الموحّد
import type { Product } from "@/app/lib/types";
import { formatDZD } from "@/app/data/delivery";
import { OrderForm } from "./OrderForm";
import { useLandingLang } from "./LandingLang";

const BENEFITS: { ar: string; en: string }[] = [
  { ar: "دفع آمن عند الاستلام", en: "Secure cash on delivery" },
  { ar: "توصيل سريع لباب منزلك", en: "Fast delivery to your door" },
  { ar: "منتج أصلي بضمان الجودة", en: "Original product, quality guaranteed" },
];

export function OrderSection({ product, preview = false }: { product: Product; preview?: boolean }) {
  const { t, lang } = useLandingLang();
  const benefits = BENEFITS.map((b) => (lang === "en" ? b.en : b.ar));
  return (
    <section id="order" className="bg-[var(--c-bg-alt)] py-20 sm:py-28">
      <div className="container-landing grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-xs font-bold tracking-wide text-[var(--c-accent)]">{t("orderCta")}</p>
          <h2 className="mt-5 max-w-md font-display text-3xl font-extrabold leading-snug text-[var(--c-text)] sm:text-4xl">
            {t("orderHeading", { name: product.name })}
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[var(--c-muted)]">
            {t("orderSub")}
          </p>
          <p className="mt-8 text-sm font-bold text-[var(--c-text)]">
            {product.name} · {formatDZD(product.price)} · {t("stickyDelivery")}
          </p>
          <div className="mt-10 grid gap-4 text-xs text-[var(--c-muted)]">
            {benefits.map((benefit) => (
              <span key={benefit} className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--c-primary)] text-[var(--c-primary-text)]">
                  ✓
                </span>
                {benefit}
              </span>
            ))}
          </div>
        </div>

        <OrderForm product={product} preview={preview} />
      </div>
    </section>
  );
}
