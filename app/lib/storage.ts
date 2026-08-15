// تخزين المنتجات المولّدة في المتصفح (localStorage) — client only

import type { Product } from "./types";
import { PRODUCTS } from "@/app/data/products";

const STORAGE_KEY = "generated-landing-products";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function readRaw(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(products: Product[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch (error) {
    console.error("تعذر الحفظ في localStorage (حجم الصور كبير؟):", error);
  }
}

// كل المنتجات المولّدة محلياً
export function getGeneratedProducts(): Product[] {
  return readRaw() as Product[];
}

// دمج المنتجات المولّدة مع الثابتة — المولّدة تتفوّق عند تطابق id
export function getAllProducts(): Product[] {
  const generated = getGeneratedProducts();
  const staticIds = new Set(PRODUCTS.map((p) => p.id));
  const generatedExtra = generated.filter((p) => !staticIds.has(p.id));
  const overrides = generated.filter((p) => staticIds.has(p.id));
  return [
    ...generatedExtra,
    ...PRODUCTS.map((p) => overrides.find((o) => o.id === p.id) ?? p),
  ];
}

export function getProduct(id: string): Product | undefined {
  const found = getGeneratedProducts().find((p) => p.id === id) ?? PRODUCTS.find((p) => p.id === id);
  return found ? found : undefined;
}

export function saveProduct(product: Product): void {
  const all = getGeneratedProducts();
  const idx = all.findIndex((p) => p.id === product.id);
  if (idx >= 0) all[idx] = product;
  else all.push(product);
  writeAll(all);
}

export function deleteProduct(id: string): void {
  writeAll(getGeneratedProducts().filter((p) => p.id !== id));
}

// إزالة بقايا المنتجات التجريبية القديمة (Anker / Bestrio / الحذاء) من localStorage
const LEGACY_SAMPLE_IDS = new Set(["anker-20w-charger", "bestrio-earbuds", "midnight-loafer"]);
const LEGACY_IMAGE_PATTERNS = [/^\/products\//, /^\/shoe\.jpg$/];

export function purgeLegacySamples(): void {
  const all = getGeneratedProducts();
  const kept = all.filter(
    (p) => !LEGACY_SAMPLE_IDS.has(p.id) && !LEGACY_IMAGE_PATTERNS.some((re) => re.test(p.image))
  );
  if (kept.length !== all.length) writeAll(kept);
}

export function slugExists(id: string): boolean {
  return getAllProducts().some((p) => p.id === id);
}
