"use client";

import { useState, CSSProperties } from "react";
import type { Product } from "@/app/lib/types";
import { buildCssVars } from "@/app/lib/theme";
import { LandingLangProvider, useLandingLang } from "./LandingLang";
import { Header, TopBar } from "./Header";
import { Showcase } from "./Showcase";
import { ExtrasSection, Features } from "./Features";
import { Testimonials } from "./Testimonials";
import { OrderSection } from "./OrderSection";
import { Footer } from "./Footer";
import { StickyCTA } from "./StickyCTA";

// يبني منتجاً «مشتقّاً» يعرض حقول العنصر النشط (الاسم/السعر/الصور/الألوان/...)
// فوق حقول الغلاف المشتركة (السمة/المميزات/الآراء/الإضافات). هذا يطابق تماماً
// ما يفعله محرّك generateHtml (display مقابل product).
function deriveDisplay(product: Product, active: Product): Product {
  return {
    ...product,
    name: active.name,
    price: active.price,
    image: active.image,
    images: active.images,
    nameEn: active.nameEn,
    oldPrice: active.oldPrice,
    colors: active.colors,
    eyebrow: active.eyebrow,
    badge: active.badge,
    tagline: active.tagline,
    description: active.description,
    stats: active.stats,
    tags: active.tags,
  };
}

// شريط اختيار المنتجات في وضع المتجر — يطابق .product-picker في HTML المولّد.
function ProductPicker({
  items,
  activeIndex,
  onSelect,
}: {
  items: Product[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="product-picker container-landing">
      {items.map((it, i) => {
        const selected = i === activeIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`product-card${selected ? " product-card--selected" : ""}`}
            aria-pressed={selected}
          >
            <span className="product-card__thumb">
              {it.image ? (
                <img src={it.image} alt={it.name} className="product-card__img" />
              ) : (
                <span className="product-card__ph">📦</span>
              )}
            </span>
            <span className="product-card__body">
              <span className="product-card__name">{it.name}</span>
              <span className="product-card__price">{it.price ? `${it.price} DA` : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// القالب المشترك — يركّب الأقسام بالترتيب الثابت المطلوب في CLAUDE.md:
// Header ← Showcase ← Features ← Testimonials ← Express Form
// يعرض أي منتج بتحويل Theme إلى CSS Variables على الحاوية.
function ProductLandingInner({ product, preview = false }: { product: Product; preview?: boolean }) {
  const { dir, lang } = useLandingLang();
  const vars = buildCssVars(product.theme) as CSSProperties;

  // وضع المتجر: أكثر من منتج → شريط اختيار وتبديل ديناميكي للعرض.
  const isStore = Array.isArray(product.products) && product.products.length > 0;
  const items: Product[] = isStore ? product.products! : [product];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[Math.min(activeIndex, items.length - 1)] ?? product;
  const display = isStore ? deriveDisplay(product, active) : product;

  return (
    <main
      className="min-h-screen overflow-hidden bg-[var(--c-bg)] text-[var(--c-text)]"
      style={{ colorScheme: product.theme.mode, ...vars }}
      dir={dir}
      lang={lang}
      id="top"
    >
      {!preview && <TopBar product={product} />}
      <Header product={product} />
      {isStore && (
        <ProductPicker items={items} activeIndex={activeIndex} onSelect={setActiveIndex} />
      )}
      <Showcase product={display} />
      <Features product={product} />
      {product.extras ? <ExtrasSection extras={product.extras} /> : null}
      <Testimonials product={product} />
      <OrderSection product={display} preview={preview} />
      <Footer product={product} />
      {!preview && <StickyCTA product={display} />}
    </main>
  );
}

export function ProductLanding({
  product,
  preview = false,
}: {
  product: Product;
  preview?: boolean;
}) {
  return (
    <LandingLangProvider>
      <ProductLandingInner product={product} preview={preview} />
    </LandingLangProvider>
  );
}
