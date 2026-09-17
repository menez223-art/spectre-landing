"use client";

import { useState, useEffect, useRef, CSSProperties } from "react";
import type { Product } from "@/app/lib/types";
import { buildCssVars } from "@/app/lib/theme";
import { dzdToUsd } from "@/app/lib/utils/constants";
import { LandingLangProvider, useLandingLang } from "./LandingLang";
import { Header, TopBar } from "./Header";
import { Showcase } from "./Showcase";
import { ExtrasSection, Features } from "./Features";
import { Testimonials } from "./Testimonials";
import { OrderSection } from "./OrderSection";
import { Footer } from "./Footer";
import { StickyCTA } from "./StickyCTA";
import { TrialBanner } from "./TrialBanner";

// يبني منتجاً «مشتقّاً» يعرض حقول العنصر النشط (الاسم/السعر/الصور/الألوان/...)
// فوق حقول الغلاف المشتركة (السمة/المميزات/الآراء/الإضافات). هذا يطابق تماماً
// ما يفعله محرّك generateHtml (display مقابل product).
// ⚠️ id يجب أن يُستبدل هو الآخر: OrderForm يستعمل product.id في content_ids
// و _productId للـCAPI — لو بقي معرّف الغلاف لَنُسبت كل عمليات شراء المتجر
// إلى منتج واحد (generateHtml يُحدّث PRODUCT_ID عند كل تبديل).
function deriveDisplay(product: Product, active: Product): Product {
  return {
    ...product,
    id: active.id,
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
                /* eslint-disable-next-line @next/next/no-img-element -- صورة منتج data:URL محلية */
                <img src={it.image} alt={it.name} className="product-card__img" loading="lazy" decoding="async" />
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
function ProductLandingInner({
  product,
  preview = false,
  trialUntil = null,
}: {
  product: Product;
  preview?: boolean;
  trialUntil?: string | null;
}) {
  const { dir, lang } = useLandingLang();
  const vars = buildCssVars(product.theme) as CSSProperties;

  // وضع المتجر: أكثر من منتج → شريط اختيار وتبديل ديناميكي للعرض.
  const isStore = Array.isArray(product.products) && product.products.length > 0;
  const items: Product[] = isStore ? product.products! : [product];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[Math.min(activeIndex, items.length - 1)] ?? product;
  const display = isStore ? deriveDisplay(product, active) : product;

  // === META PIXEL + TIKTOK PIXEL: ViewContent ===
  // في وضع المتجر: عند تبديل المنتج نُسجّل اختيار الزبون (مشاهدة) بالتوازي.
  // في المنتج المفرد: نُسجّل مرة واحدة عند التحميل لقياس PageView كـ ViewContent.
  // حارس تكرار: React Strict Mode (وضع التطوير) يُشغّل الأثر مرّتين، فيُسجَّل
  // ViewContent مزدوجاً. نحفظ آخر «هوية» أُرسلت ولا نُعيد إرسال نفس المنتج
  // إلا إذا تغيّر فعلاً (تبديل منتج في وضع المتجر).
  const lastViewRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewKey = `${active.id}:${active.price}`;
    if (lastViewRef.current === viewKey) return;
    lastViewRef.current = viewKey;
    // Meta Pixel
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") {
      try {
        // ⚠️ Meta Pixel لا يدعم DZD — نُحوّل إلى USD كما في OrderForm/CAPI تماماً،
        // وإلا رُفضت القيمة أو قُيّست خطأً في تحسين الحملات.
        fbq("track", "ViewContent", {
          content_type: "product",
          content_ids: [active.id],
          content_name: active.name,
          value: dzdToUsd(active.price),
          currency: "USD",
        });
      } catch { /* تتبّع اختياري */ }
    }
    // TikTok Pixel — يُطلق بالتوازي مع فيسبوك.
    const ttq = (window as unknown as { ttq?: { track?: (...a: unknown[]) => void } }).ttq;
    if (ttq && typeof ttq.track === "function") {
      try {
        ttq.track("ViewContent", {
          content_type: "product",
          content_id: active.id,
          content_name: active.name,
          value: active.price,
          currency: "DZD",
        });
      } catch { /* تتبّع اختياري */ }
    }
  }, [active.id, active.name, active.price]);

  return (
    <main
      className={`min-h-screen overflow-hidden bg-[var(--c-bg)] text-[var(--c-text)] ${!preview ? "pb-20 lg:pb-0" : ""}`}
      style={{ colorScheme: product.theme.mode, ...vars }}
      dir={dir}
      lang={lang}
      id="top"
    >
      {!preview && <TopBar product={product} />}
      <Header product={product} />
      {/* لافتة تجربة الڤيست — تُعرض للزائر فقط إن كانت الصفحة تجربة */}
      {!preview && trialUntil ? <TrialBanner expiresAt={trialUntil} /> : null}
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
  trialUntil = null,
}: {
  product: Product;
  preview?: boolean;
  /** تاريخ انتهاء تجربة الڤيست — إن وُجد تُعرض اللافتة والعدّاد. */
  trialUntil?: string | null;
}) {
  return (
    <LandingLangProvider>
      <ProductLandingInner product={product} preview={preview} trialUntil={trialUntil} />
    </LandingLangProvider>
  );
}
