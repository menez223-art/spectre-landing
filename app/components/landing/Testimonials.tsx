// آراء الزبائن — يُخفى تلقائياً إذا لم توجد شهادات
import type { Product } from "@/app/lib/types";
import { useLandingLang } from "./LandingLang";

function Star() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-amber-300" aria-hidden="true">
      <path d="M10 1.5 12.6 7l6 .6-4.5 4.1 1.3 5.9L10 14.6l-5.4 3 1.3-5.9L1.4 7.6l6-.6L10 1.5Z" />
    </svg>
  );
}

export function Testimonials({ product }: { product: Product }) {
  const { t } = useLandingLang();
  const testimonials = product.testimonials ?? [];
  if (!testimonials.length) return null;

  return (
    <section id="testimonials" className="relative py-20 sm:py-28">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--c-border-strong)] to-transparent" />
      <div className="container-landing">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-wide text-[var(--c-accent)]">{t("secTestimonials")}</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-[var(--c-text)] sm:text-4xl">
              {t("testimonialsTitle")}
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-[var(--c-muted)]">
            {t("testimonialsSub")}
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="relative rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-7"
            >
              <div className="flex gap-1" aria-label="خمس نجوم">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} />
                ))}
              </div>
              <blockquote className="mt-5 text-base font-medium leading-relaxed text-[var(--c-text)]">
                «{testimonial.quote}»
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 text-xs text-[var(--c-muted)]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--c-primary)] font-display text-sm font-bold text-[var(--c-primary-text)] ring-1 ring-[var(--c-border)]">
                  {testimonial.name.charAt(0)}
                </span>
                <span className="font-bold text-[var(--c-text)]">{testimonial.name}</span> ·{" "}
                {testimonial.city}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
