"use client";

import { Fragment, useState } from "react";
import type { Product } from "@/app/lib/types";
import { formatDZD } from "@/app/data/delivery";
import { ProductImage } from "./ProductImage";
import { useLandingLang } from "./LandingLang";

// عرض المنتج — النص، السعر، الزر، والشارات على اليمين؛ الصورة والمعرض على اليسار
export function Showcase({ product }: { product: Product }) {
  const { t } = useLandingLang();
  const images = [product.image, ...(product.images ?? [])].filter(Boolean);
  const [active, setActive] = useState(0);
  const safeActive = images.length ? Math.min(active, images.length - 1) : 0;
  const hasDiscount =
    typeof product.oldPrice === "number" && product.oldPrice > product.price;

  return (
    <section
      className="container-landing relative grid items-center gap-14 pb-20 pt-6 lg:grid-cols-[1fr_0.95fr] lg:gap-20 lg:pb-28 lg:pt-12"
    >
      {/* النص */}
      <div className="relative z-10">
        {(product.eyebrow || product.badge) && (
          <p className="mb-6 inline-flex items-center gap-3 rounded-full border border-[var(--c-border-strong)] bg-[var(--c-primary-soft)] px-4 py-1.5 text-xs font-bold text-[var(--c-accent)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-accent)]" />
            {product.eyebrow ?? product.badge}
          </p>
        )}
        {product.nameEn && (
          <p className="l-text-gradient mb-2 font-display text-xl font-bold">{product.nameEn}</p>
        )}
        <h1 className="max-w-xl font-display text-4xl font-extrabold leading-[1.12] text-[var(--c-text)] sm:text-5xl lg:text-[3.4rem]">
          {product.tagline ?? product.name}
        </h1>
        {product.description && (
          <p className="mt-6 max-w-md text-base leading-7 text-[var(--c-muted)]">
            {product.description}
          </p>
        )}

        <div className="mt-9 flex flex-wrap items-center gap-5">
          <a
            href="#order"
            className="rounded-full bg-gradient-to-l from-[var(--c-primary)] to-[var(--c-primary-strong)] px-7 py-4 text-sm font-bold text-[var(--c-primary-text)] shadow-lg shadow-[var(--c-glow)] transition hover:-translate-y-0.5"
          >
            {t("orderNow")} <span className="ms-3">←</span>
          </a>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-2xl font-extrabold text-[var(--c-text)]">
              {formatDZD(product.price)}
            </span>
            {hasDiscount && product.oldPrice ? (
              <>
                <span className="text-sm font-bold text-[var(--c-muted)] line-through">
                  {formatDZD(product.oldPrice)}
                </span>
                <span className="rounded-full bg-[var(--c-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--c-accent)]">
                  -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                </span>
              </>
            ) : null}
          </div>
        </div>

        {product.tags?.length ? (
          <div className="mt-7 flex flex-wrap items-center gap-3 text-xs font-semibold text-[var(--c-muted)]">
            {product.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-2">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {product.stats?.length ? (
          <div className="mt-12 flex flex-wrap items-center gap-7 border-t border-[var(--c-border)] pt-6 text-xs text-[var(--c-muted)]">
            {product.stats.map((stat, i) => (
              <Fragment key={stat.label}>
                {i > 0 && <span className="hidden h-8 w-px bg-[var(--c-border)] sm:block" />}
                <span>
                  <strong className="block text-lg text-[var(--c-text)]">{stat.value}</strong> {stat.label}
                </span>
              </Fragment>
            ))}
          </div>
        ) : null}
      </div>

      {/* الصورة */}
      <div className="relative mx-auto w-full max-w-md lg:max-w-none">
        <div className="glow-halo" />
        <div className="absolute -inset-4 rounded-[3.5rem] border border-dashed border-[var(--c-border-strong)]" />
        <div className="animate-float-slow relative aspect-[0.88] overflow-hidden rounded-3xl ring-1 ring-[var(--c-border)]">
          {images.length > 0 ? (
            <ProductImage
              src={images[safeActive]}
              alt={product.name}
              priority
              sizes="(max-width: 1024px) 90vw, 45vw"
            />
          ) : (
            <div className="grid h-full w-full place-items-center p-8 text-center">
              <span className="text-sm font-semibold leading-6 text-[var(--c-muted)]">
                {t("noImage1")}
                <br />
                {t("noImage2")}
              </span>
            </div>
          )}
          <div className="img-overlay" />
          {product.badge && (
            <span className="absolute end-4 top-4 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">
              {product.badge}
            </span>
          )}
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white">
            <div>
              {product.nameEn && <p className="text-[10px] text-white/75">{product.nameEn}</p>}
              <p className="mt-1 font-display text-xl font-bold">{product.name}</p>
            </div>
          </div>
        </div>

        {images.length > 1 && (
          <div
            className="mt-4 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(images.length, 4)}, minmax(0, 1fr))` }}
          >
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${t("shot")} ${i + 1}`}
                className={`relative aspect-square overflow-hidden rounded-2xl ring-1 transition ${
                  i === safeActive ? "ring-[var(--c-primary)]" : "ring-[var(--c-border)]"
                }`}
              >
                <ProductImage src={src} alt={`${t("shot")} ${i + 1}`} sizes="25vw" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
