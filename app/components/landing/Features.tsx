// قسم المميزات — layout "grid" (بطاقات) أو "list" (جدول مواصفات مثل Bestrio)
import type { ExtraSection, Product } from "@/app/lib/types";
import { ProductImage } from "./ProductImage";
import { useLandingLang } from "./LandingLang";

export function Features({ product }: { product: Product }) {
  const { t } = useLandingLang();
  const features = product.features ?? [];
  if (!features.length) return null;

  if (product.theme.featuresLayout === "list") {
    return (
      <section id="features" className="bg-[var(--c-band-bg)] py-20 text-[var(--c-band-text)] sm:py-28">
        <div className="container-landing">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-xs font-bold text-[var(--c-accent)]">{t("secSpecs")}</p>
              <h2 className="mt-5 max-w-sm font-display text-3xl font-bold leading-snug sm:text-4xl">
                {t("specsTitle", { name: product.name })}
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-6 text-[var(--c-band-muted)]">
                {product.description ?? t("specsDefault")}
              </p>
            </div>
            <div className="grid border-t border-[var(--c-band-border)]">
              {features.map((feature, i) => (
                <article
                  key={feature.title}
                  className={`grid gap-2 border-b border-[var(--c-band-border)] py-6 sm:grid-cols-[70px_0.8fr_1.2fr] sm:items-center ${
                    i === features.length - 1 ? "border-b-0" : ""
                  }`}
                >
                  <span className="text-xs text-[var(--c-band-muted)]">0{i + 1}</span>
                  <h3 className="font-display text-lg font-bold">{feature.title}</h3>
                  <p className="text-sm leading-6 text-[var(--c-band-muted)]">{feature.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--c-border-strong)] to-transparent" />
      <div className="container-landing">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold tracking-wide text-[var(--c-accent)]">{t("whyTitle", { name: product.name })}</p>
          <h2 className="mt-4 font-display text-3xl font-extrabold leading-snug text-[var(--c-text)] sm:text-4xl">
            {t("featuresTitle")}
          </h2>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="group relative rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 transition hover:border-[var(--c-border-strong)] hover:shadow-lg hover:shadow-[var(--c-glow)]"
            >
              <span className="font-display text-xs font-bold text-[var(--c-muted)] transition group-hover:text-[var(--c-accent)]">
                0{index + 1}
              </span>
              <h3 className="mt-5 font-display text-lg font-bold leading-snug text-[var(--c-text)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--c-muted)]">{feature.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// قسم إضافي (مثال: Open Wearable Stereo في Bestrio)
export function ExtrasSection({ extras }: { extras: ExtraSection }) {
  const { t } = useLandingLang();
  return (
    <section id={extras.id} className="container-landing py-20 sm:py-28">
      <div className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <p className="text-xs font-bold text-[var(--c-accent)]">{extras.eyebrow}</p>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-[var(--c-text)] sm:text-4xl">
            {extras.heading}
          </h2>
          <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--c-muted)]">
            {extras.copy.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          {extras.chips?.length ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {extras.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-2 text-xs font-semibold text-[var(--c-muted)]"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {extras.image ? (
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative aspect-[0.86] overflow-hidden rounded-[1.5rem_1.5rem_10rem_10rem] bg-[var(--c-surface-2)] shadow-2xl ring-1 ring-[var(--c-border)]">
              <ProductImage src={extras.image} alt={extras.heading} sizes="(max-width: 1024px) 90vw, 50vw" />
            </div>
            {extras.imageCaption && (
              <p className="mt-4 text-center text-[10px] text-[var(--c-muted)]">{extras.imageCaption}</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
