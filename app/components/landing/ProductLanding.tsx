"use client";

import type { CSSProperties } from "react";
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

// القالب المشترك — يركّب الأقسام بالترتيب الثابت المطلوب في CLAUDE.md:
// Header ← Showcase ← Features ← Testimonials ← Express Form
// يعرض أي منتج بتحويل Theme إلى CSS Variables على الحاوية.
function ProductLandingInner({ product, preview = false }: { product: Product; preview?: boolean }) {
  const { dir, lang } = useLandingLang();
  const vars = buildCssVars(product.theme) as CSSProperties;
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
      <Showcase product={product} />
      <Features product={product} />
      {product.extras ? <ExtrasSection extras={product.extras} /> : null}
      <Testimonials product={product} />
      <OrderSection product={product} preview={preview} />
      <Footer product={product} />
      {!preview && <StickyCTA product={product} />}
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
