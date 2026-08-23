"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Product, Theme } from "@/app/lib/types";
import { defaultTheme, normalizeTheme } from "@/app/lib/theme";
import {
  PaletteCorsError,
  compressImage,
  extractPaletteFromDataUrl,
  extractPaletteFromUrl,
} from "@/app/lib/palette";
import { ensureContrast } from "@/app/lib/color";
import { CATEGORIES, generateAutoContent, type Category } from "@/app/lib/autoContent";
import { DELIVERY_PRICES, WILAYAS } from "@/app/data/delivery";
import { ProductLanding } from "@/app/components/landing/ProductLanding";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { LangToggle } from "@/app/components/LangToggle";
import { useLocale } from "@/app/components/LocaleProvider";

// مسودة المنتج في "وضع الكيست" — مطابقة 100% لمسودة الستوديو.
// لا حفظ ولا ربط: كل العمليات (تحميل/نشر/حفظ) معطّلة وتُعرض رسالة توجيهية فقط.
interface DemoDraft {
  id?: string;
  name: string;
  nameEn: string;
  brand: string;
  price: string;
  oldPrice: string;
  deliveryHome: string;
  deliveryOffice: string;
  deliveryMode: "fixed" | "wilaya";
  wilayaPrices: Record<number, { home: number; office: number }>;
  colors: { name: string; hex: string }[];
  image: string;
  images: string[];
  eyebrow: string;
  badge: string;
  description: string;
  tagline: string;
  tags: string;
  category: Category;
  features: { title: string; copy: string }[];
  testimonials: { quote: string; name: string; city: string }[];
  stats: { value: string; label: string }[];
  theme: Theme;
  swatches: string[];
  extracted: boolean;
}

function emptyDemo(): DemoDraft {
  return {
    name: "",
    nameEn: "",
    brand: "",
    price: "",
    oldPrice: "",
    deliveryHome: String(DELIVERY_PRICES.home),
    deliveryOffice: String(DELIVERY_PRICES.office),
    deliveryMode: "fixed",
    wilayaPrices: {},
    colors: [],
    image: "",
    images: [],
    eyebrow: "",
    badge: "",
    description: "",
    tagline: "",
    tags: "",
    category: "عام",
    features: [],
    testimonials: [],
    stats: [],
    theme: defaultTheme("light"),
    swatches: [],
    extracted: false,
  };
}

// يضبط كود اللون ليكون بصيغة #rrggbb صغيرة
function normalizeHex(value: string): string {
  const v = (value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : "";
}

function toWilayaPricesRecord(
  src: Record<number, { home: number; office: number }>
): Record<number, { home: number; office: number }> {
  const out: Record<number, { home: number; office: number }> = {};
  for (const [code, price] of Object.entries(src)) {
    const home = Math.max(0, Number(price?.home) || 0);
    const office = Math.max(0, Number(price?.office) || 0);
    if (home > 0 || office > 0) out[Number(code)] = { home, office };
  }
  return out;
}

// يحوّل المسودة إلى منتج حقيقي للعرض المباشر (بلا sheetWebhook/sheetEmail/sheetKey → لا حفظ).
function demoToProduct(d: DemoDraft): Product {
  const name = d.name.trim() || "منتج تجريبي";
  const price = Math.max(0, Number(d.price) || 0);
  const brand = d.brand.trim() || undefined;
  const features = d.features
    .filter((f) => f.title.trim() && f.copy.trim())
    .map((f) => ({ title: f.title.trim(), copy: f.copy.trim() }));
  const testimonials = d.testimonials
    .filter((t) => t.quote.trim())
    .map((t) => ({ quote: t.quote.trim(), name: t.name.trim() || "زبون", city: t.city.trim() }));
  const stats = d.stats
    .filter((s) => s.value.trim() && s.label.trim())
    .map((s) => ({ value: s.value.trim(), label: s.label.trim() }));
  const tags = d.tags
    .split(/[,،\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const images = d.images.map((s) => s.trim()).filter(Boolean);

  const product: Product = {
    id: "guest-preview",
    name,
    price,
    image: d.image,
    ...(brand ? { brand } : {}),
    ...(d.nameEn.trim() ? { nameEn: d.nameEn.trim() } : {}),
    ...(images.length ? { images } : {}),
    ...(d.eyebrow.trim() ? { eyebrow: d.eyebrow.trim() } : {}),
    ...(d.badge.trim() ? { badge: d.badge.trim() } : {}),
    ...(d.description.trim() ? { description: d.description.trim() } : {}),
    ...(d.tagline.trim() ? { tagline: d.tagline.trim() } : {}),
    ...(features.length ? { features } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(stats.length ? { stats } : {}),
    ...(tags.length ? { tags } : {}),
    theme: normalizeTheme(d.theme),
    delivery: {
      home: Number.isFinite(Number(d.deliveryHome)) ? Math.max(0, Number(d.deliveryHome)) : DELIVERY_PRICES.home,
      office: Number.isFinite(Number(d.deliveryOffice)) ? Math.max(0, Number(d.deliveryOffice)) : DELIVERY_PRICES.office,
    },
    ...(d.deliveryMode === "wilaya"
      ? {
          deliveryMode: "wilaya" as const,
          wilayaPrices: toWilayaPricesRecord(d.wilayaPrices),
        }
      : {}),
    ...(d.colors.length
      ? {
          colors: d.colors
            .map((c) => ({ name: c.name.trim(), hex: normalizeHex(c.hex) }))
            .filter((c) => c.name && /^#[0-9a-fA-F]{6}$/.test(c.hex)),
        }
      : {}),
  };
  return product;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-navy-700 dark:text-ivory-50/70">
      <span>{label}</span>
      {children}
      {hint && <span className="text-[10px] font-normal text-navy-900/45 dark:text-ivory-50/45">{hint}</span>}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-navy-700 dark:text-ivory-50/70">
      <span>{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-navy-900/15 bg-white p-1.5 dark:border-white/15 dark:bg-[#0d1117]">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs text-navy-900 outline-none dark:text-ivory-50"
        />
      </div>
    </label>
  );
}

// نافذة "وضع الكيست" — نموذج منتج مطابق 100% للستوديو، معاينة حيّة حقيقية،
// وأزرار التحميل/الحفظ/النشر معطّلة (تفتح رسالة توجيهية لفتح الستوديو).
export function GuestStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<DemoDraft>(emptyDemo);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [paletteWarning, setPaletteWarning] = useState("");
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const urlRef = useRef<HTMLInputElement | null>(null);

  // إعادة الضبط عند كل فتح
  useEffect(() => {
    if (open) {
      setDraft(emptyDemo());
      setImageUrlInput("");
      setPaletteWarning("");
      setError("");
      setAdvancedOpen(false);
      setShowNotice(false);
    }
  }, [open]);

  // إغلاق بمفتاح Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // منع تمرير الخلفية أثناء فتح النافذة
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const previewProduct = useMemo(() => demoToProduct(draft), [draft]);

  function setThemeField(key: keyof Theme, value: string) {
    setDraft((d) => ({ ...d, theme: { ...d.theme, [key]: value } }));
  }

  function switchMode(mode: "dark" | "light") {
    setDraft((d) => {
      const theme: Theme = { ...d.theme, mode };
      return {
        ...d,
        theme: {
          ...theme,
          text: ensureContrast(theme.text, theme.bg, 4.5),
          accent: ensureContrast(theme.accent, theme.bg, 3),
        },
      };
    });
  }

  async function handleMainImage(file: File) {
    if (!file) return;
    const dataUrl = await compressImage(file);
    setDraft((d) => ({ ...d, image: dataUrl }));
    try {
      const result = await extractPaletteFromDataUrl(dataUrl);
      setDraft((d) => ({ ...d, theme: result.theme, swatches: result.swatches, extracted: true }));
    } catch (error) {
      console.error("تعذر استخراج الألوان:", error);
    }
  }

  async function handleAddImage(file: File) {
    if (!file) return;
    const dataUrl = await compressImage(file, 800);
    setDraft((d) => ({ ...d, images: [...d.images, dataUrl] }));
  }

  async function handleExtract() {
    if (!draft.image) return;
    try {
      const result = draft.image.startsWith("data:")
        ? await extractPaletteFromDataUrl(draft.image)
        : await extractPaletteFromUrl(draft.image);
      setDraft((d) => ({ ...d, theme: result.theme, swatches: result.swatches, extracted: true }));
      setPaletteWarning("");
    } catch (err) {
      setPaletteWarning(
        err instanceof PaletteCorsError ? t("errPaletteCors") : t("errPalette")
      );
      if (!(err instanceof PaletteCorsError)) console.error(err);
    }
  }

  // تحميل صورة عبر رابط مباشر
  function probeImage(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  async function handleUseUrl() {
    const url = imageUrlInput.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setError(t("errUrl"));
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      setError(t("errUrlProtocol"));
      return;
    }
    if (!(await probeImage(url))) {
      setError(t("errUrlNotImage"));
      return;
    }
    setError("");
    setDraft((d) => ({ ...d, image: url }));
    setPaletteWarning("");
    try {
      const result = await extractPaletteFromUrl(url);
      setDraft((d) => ({ ...d, theme: result.theme, swatches: result.swatches, extracted: true }));
    } catch (err) {
      setPaletteWarning(
        err instanceof PaletteCorsError ? t("errPaletteCors") : t("errPalette")
      );
      if (!(err instanceof PaletteCorsError)) console.error(err);
    }
  }

  // توليد المحتوى تلقائياً — مثل الستوديو تماماً
  function handleGenerate() {
    if (!draft.name.trim()) {
      setError(t("errName"));
      return;
    }
    setError("");
    const content = generateAutoContent({
      name: draft.name.trim(),
      nameEn: draft.nameEn.trim() || undefined,
      price: Math.max(0, Number(draft.price) || 0),
      brand: draft.brand.trim() || undefined,
      category: draft.category,
    });
    setDraft((d) => ({
      ...d,
      eyebrow: content.eyebrow,
      tagline: content.tagline,
      badge: content.badge,
      description: content.description,
      features: content.features,
      testimonials: content.testimonials,
      stats: content.stats,
      tags: content.tags.join("، "),
    }));
    setAdvancedOpen(true);
  }

  // العمليات المحظورة في "وضع الكيست" — تُعرض الرسالة التوجيهية فقط (بدون حفظ/نشر/تحميل).
  function blockedAction() {
    setShowNotice(true);
  }

  if (!open) return null;

  const inputCls =
    "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50 dark:placeholder:text-ivory-50/35";
  const ghostBtn =
    "rounded-full border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-navy-950/60 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("demoTitle")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50 sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:shadow-2xl sm:shadow-navy-950/40">
        {/* الترويسة */}
        <div className="flex items-center justify-between gap-2 border-b border-navy-900/10 bg-navy-900 px-4 py-3 text-ivory-50 sm:px-6 dark:border-white/10">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-navy-400/30 text-sm">✨</span>
            <div>
              <p className="font-display text-base font-extrabold">{t("demoTitle")}</p>
              <p className="text-[10px] text-ivory-50/70">{t("tryDemoSub")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangToggle />
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-ivory-50/20 text-lg font-bold text-ivory-50 transition hover:border-ivory-50/50"
              aria-label={t("demoClose")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* المحتوى: نموذج + معاينة */}
        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          {/* النموذج */}
          <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-300/40 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-400/30 dark:bg-sky-900/30 dark:text-sky-100">
              <p className="text-[11px] font-medium leading-5">
                {t("demoNoticeBody")}
              </p>
            </div>

            {error && (
              <p className="whitespace-pre-line rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
                {error}
              </p>
            )}

            {/* المعلومات الأساسية */}
            <section className="grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
              <h2 className="font-display text-base font-bold">{t("productInfo")}</h2>
              <Field label={t("productName")}>
                <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("productNamePh")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("nameEn")} hint={t("nameEnHint")}>
                  <input className={inputCls} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="Pro Wireless Earbuds" />
                </Field>
                <Field label={t("brandField")}>
                  <input className={inputCls} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="ProSound" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("price")}>
                  <input className={inputCls} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="4500" inputMode="numeric" />
                </Field>
                <Field label={t("oldPrice")} hint={t("oldPriceHint")}>
                  <input className={inputCls} value={draft.oldPrice} onChange={(e) => setDraft({ ...draft, oldPrice: e.target.value })} placeholder="5000" inputMode="numeric" />
                </Field>
                <Field label={t("badge")}>
                  <input className={inputCls} value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="جديد / سريع" />
                </Field>
                <Field label={t("category")} hint={t("categoryHint")}>
                  <select
                    className={inputCls}
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("deliveryHome")} hint={t("deliveryHomeHint")}>
                  <input
                    className={inputCls}
                    value={draft.deliveryHome}
                    onChange={(e) => setDraft({ ...draft, deliveryHome: e.target.value })}
                    placeholder="700"
                    inputMode="numeric"
                    disabled={draft.deliveryMode === "wilaya"}
                  />
                </Field>
                <Field label={t("deliveryOffice")} hint={t("deliveryOfficeHint")}>
                  <input
                    className={inputCls}
                    value={draft.deliveryOffice}
                    onChange={(e) => setDraft({ ...draft, deliveryOffice: e.target.value })}
                    placeholder="500"
                    inputMode="numeric"
                    disabled={draft.deliveryMode === "wilaya"}
                  />
                </Field>
              </div>

              {/* مبدّل وضع التوصيل */}
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-navy-700 dark:text-ivory-50/70">{t("deliveryMode")}</span>
                <div className="flex rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold dark:border-white/15 dark:bg-[#161b22]">
                  {(["fixed", "wilaya"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDraft({ ...draft, deliveryMode: mode })}
                      className={`flex-1 rounded-full px-4 py-1.5 transition ${
                        draft.deliveryMode === mode ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900 dark:text-ivory-50/70"
                      }`}
                    >
                      {mode === "fixed" ? t("deliveryModeFixed") : t("deliveryModeWilaya")}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-normal text-navy-900/45 dark:text-ivory-50/45">{t("deliveryModeHint")}</span>
              </div>

              {/* محرر أسعار الولايات */}
              {draft.deliveryMode === "wilaya" && (
                <div className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 dark:border-white/10 dark:bg-[#161b22]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-navy-700 dark:text-ivory-50/70">{t("wilayaPricesTitle")}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          wilayaPrices: Object.fromEntries(
                            WILAYAS.map((w) => [
                              w.code,
                              {
                                home: Number(d.wilayaPrices[w.code]?.home) || 0,
                                office: Number(d.wilayaPrices[w.code]?.office) || 0,
                              },
                            ])
                          ),
                        }))
                      }
                      className={ghostBtn}
                    >
                      {t("wilayaPricesFill")}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-navy-900/55 dark:text-ivory-50/55">
                    <span className="flex-1">{t("wilayaColumnHome")}</span>
                    <span className="flex-1">{t("wilayaColumnOffice")}</span>
                  </div>
                  <p className="text-[10px] font-normal text-navy-900/45 dark:text-ivory-50/45">{t("wilayaPricesHint")}</p>
                  <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {WILAYAS.map((w) => (
                      <div key={w.code} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-[11px] font-medium text-navy-700 dark:text-ivory-50/70">
                          {w.code} · {w.name}
                        </span>
                        <input
                          className="w-full rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none transition focus:border-navy-500 dark:border-white/15 dark:bg-[#0d1117] dark:text-ivory-50"
                          value={draft.wilayaPrices[w.code]?.home ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              wilayaPrices: {
                                ...d.wilayaPrices,
                                [w.code]: {
                                  home: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                                  office: Number(d.wilayaPrices[w.code]?.office) || 0,
                                },
                              },
                            }))
                          }
                          placeholder={String(DELIVERY_PRICES.home)}
                          inputMode="numeric"
                        />
                        <input
                          className="w-full rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none transition focus:border-navy-500 dark:border-white/15 dark:bg-[#0d1117] dark:text-ivory-50"
                          value={draft.wilayaPrices[w.code]?.office ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              wilayaPrices: {
                                ...d.wilayaPrices,
                                [w.code]: {
                                  home: Number(d.wilayaPrices[w.code]?.home) || 0,
                                  office: e.target.value === "" ? 0 : Number(e.target.value) || 0,
                                },
                              },
                            }))
                          }
                          placeholder={String(DELIVERY_PRICES.office)}
                          inputMode="numeric"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Field label={t("tagline")} hint={t("taglineHint")}>
                <input className={inputCls} value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="صوت نقي يدوم طويلاً" />
              </Field>
              <Field label={t("eyebrow")}>
                <input className={inputCls} value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} placeholder="USB-C · شحن سريع" />
              </Field>
              <Field label={t("description")}>
                <textarea className={`${inputCls} min-h-24 resize-y`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="وصف قصير واحترافي للمنتج" />
              </Field>
              <Field label={t("tags")} hint={t("tagsHint")}>
                <input className={inputCls} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="بلوتوث 5.4, إلغاء ضوضاء, بطارية 36 ساعة" />
              </Field>

              {/* محرر ألوان المنتج */}
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-navy-700 dark:text-ivory-50/70">{t("colorsTitle")}</span>
                <span className="text-[10px] font-normal text-navy-900/45 dark:text-ivory-50/45">{t("colorsHint")}</span>
                <div className="grid gap-2">
                  {draft.colors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#3b82f6"}
                        onChange={(e) => {
                          const colors = [...draft.colors];
                          colors[i] = { ...colors[i], hex: e.target.value };
                          setDraft({ ...draft, colors });
                        }}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-navy-900/15 bg-transparent p-0 dark:border-white/15"
                      />
                      <input
                        className={inputCls}
                        value={c.name}
                        onChange={(e) => {
                          const colors = [...draft.colors];
                          colors[i] = { ...colors[i], name: e.target.value };
                          setDraft({ ...draft, colors });
                        }}
                        placeholder="الأسود"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, colors: draft.colors.filter((_, j) => j !== i) })}
                        className={ghostBtn}
                        aria-label={t("remove")}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, colors: [...draft.colors, { name: "", hex: "#3b82f6" }] })}
                  className={ghostBtn}
                >
                  + {t("addColor")}
                </button>
              </div>
            </section>

            {/* الصورة */}
            <section className="grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold">{t("productImage")}</h2>
                {draft.image && (
                  <button onClick={handleExtract} className={ghostBtn}>
                    {t("extractColors")}
                  </button>
                )}
              </div>

              <div className="flex rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold dark:border-white/15 dark:bg-[#161b22]">
                {(["upload", "url"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setImageTab(mode)}
                    className={`flex-1 rounded-full px-4 py-1.5 transition ${
                      imageTab === mode ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900 dark:text-ivory-50/70"
                    }`}
                  >
                    {mode === "upload" ? t("uploadImage") : t("urlImage")}
                  </button>
                ))}
              </div>

              {paletteWarning && (
                <p className="rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-2.5 text-xs font-medium leading-5 text-amber-800">
                  {paletteWarning}
                </p>
              )}

              {imageTab === "url" ? (
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <input
                      ref={urlRef}
                      dir="ltr"
                      className={inputCls}
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/product.jpg"
                    />
                    <button
                      onClick={handleUseUrl}
                      className="shrink-0 rounded-xl bg-navy-900 px-4 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
                    >
                      {t("useUrl")}
                    </button>
                  </div>
                  <p className="text-[11px] leading-5 text-navy-900/45 dark:text-ivory-50/45">{t("demoImageHint")}</p>
                  {draft.image && (
                    <div className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-2.5 dark:border-white/10 dark:bg-[#161b22]">
                      <img src={draft.image} alt={t("currentImage")} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                      <span className="flex-1 truncate text-[11px] text-navy-900/50 dark:text-ivory-50/50">{t("currentImage")}</span>
                      <button
                        onClick={() => {
                          setDraft({ ...draft, image: "" });
                          setPaletteWarning("");
                        }}
                        className="shrink-0 text-xs font-bold text-red-600"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {draft.image ? (
                    <div className="flex items-center gap-4">
                      <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory-100 ring-1 ring-navy-900/10">
                        <img src={draft.image} alt={t("productImage")} className="h-full w-full object-cover" />
                      </div>
                      <div className="grid gap-2">
                        <label className={`${ghostBtn} cursor-pointer text-center`}>
                          {t("replaceImage")}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMainImage(e.target.files[0])} />
                        </label>
                        <button onClick={() => setDraft({ ...draft, image: "" })} className={ghostBtn}>
                          {t("remove")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-navy-900/15 bg-ivory-50 px-4 py-10 text-center transition hover:border-navy-500/40 dark:border-white/15 dark:bg-[#161b22]">
                      <span className="text-2xl">🖼️</span>
                      <span className="text-sm font-bold text-navy-700 dark:text-ivory-50/70">{t("uploadImagePh")}</span>
                      <span className="text-xs text-navy-900/45 dark:text-ivory-50/45">{t("uploadImageHint")}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMainImage(e.target.files[0])} />
                    </label>
                  )}
                </>
              )}

              {/* صور إضافية */}
              <div className="grid gap-3">
                {draft.images.map((img, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-2 dark:border-white/10 dark:bg-[#161b22]">
                    <img src={img} alt={t("extraImage", { n: i + 1 })} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                    <span className="flex-1 text-xs text-navy-900/50 dark:text-ivory-50/50">{t("extraImage", { n: i + 1 })}</span>
                    <button onClick={() => setDraft({ ...draft, images: draft.images.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">
                      {t("deleteItem")}
                    </button>
                  </div>
                ))}
                {draft.images.length < 4 && (
                  <label className={`${ghostBtn} cursor-pointer text-center`}>
                    {t("addImage")}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAddImage(e.target.files[0])} />
                  </label>
                )}
              </div>
            </section>

            {/* خيارات متقدمة */}
            <section className="rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-start"
              >
                <span className="flex items-center gap-2 font-display text-base font-bold">
                  {t("advanced")}
                  <span className="rounded-full bg-ivory-100 px-2 py-0.5 text-[10px] font-bold text-navy-900/50 dark:bg-[#161b22] dark:text-ivory-50/50">
                    {t("elements", { n: draft.features.length + draft.stats.length + draft.testimonials.length })}
                  </span>
                </span>
                <span className="text-xs text-navy-900/50 dark:text-ivory-50/50">{advancedOpen ? t("hide") : t("show")}</span>
              </button>
              {advancedOpen && (
                <div className="mt-5 grid gap-5">
                  {/* الألوان */}
                  <section className="grid gap-4 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 dark:border-white/10 dark:bg-[#161b22]">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold">{t("colorPalette")}</h2>
                      <div className="flex gap-1 rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold dark:border-white/15 dark:bg-[#0d1117]">
                        {(["dark", "light"] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`rounded-full px-3 py-1 transition ${
                              draft.theme.mode === m ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900 dark:text-ivory-50/70"
                            }`}
                          >
                            {m === "dark" ? t("dark") : t("light")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorField label={t("colorPrimary")} value={draft.theme.primary} onChange={(v) => setThemeField("primary", v)} />
                      <ColorField label={t("colorAccent")} value={draft.theme.accent} onChange={(v) => setThemeField("accent", v)} />
                      <ColorField label={t("colorBg")} value={draft.theme.bg} onChange={(v) => { setThemeField("bg", v); setThemeField("text", ensureContrast(draft.theme.text, v)); }} />
                      <ColorField label={t("colorText")} value={draft.theme.text} onChange={(v) => setThemeField("text", v)} />
                    </div>
                    {draft.swatches.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold text-navy-900/50 dark:text-ivory-50/50">{t("extractedColors")}</span>
                        {draft.swatches.map((sw) => (
                          <button
                            key={sw}
                            onClick={() => setThemeField("primary", sw)}
                            className="h-8 w-8 rounded-full ring-1 ring-navy-900/15 transition hover:scale-110"
                            style={{ background: sw }}
                            aria-label={`${t("colorPrimary")} ${sw}`}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* المميز (features) */}
                  <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 dark:border-white/10 dark:bg-[#161b22]">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold">{t("features")}</h2>
                      <button onClick={() => setDraft({ ...draft, features: [...draft.features, { title: "", copy: "" }] })} className={ghostBtn}>
                        {t("add")}
                      </button>
                    </div>
                    {draft.features.map((f, i) => (
                      <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-white p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center dark:border-white/10 dark:bg-[#0d1117]">
                        <input className={inputCls} value={f.title} placeholder={t("featureTitle")} onChange={(e) => { const features = [...draft.features]; features[i] = { ...f, title: e.target.value }; setDraft({ ...draft, features }); }} />
                        <input className={inputCls} value={f.copy} placeholder={t("featureCopy")} onChange={(e) => { const features = [...draft.features]; features[i] = { ...f, copy: e.target.value }; setDraft({ ...draft, features }); }} />
                        <button onClick={() => setDraft({ ...draft, features: draft.features.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">{t("deleteItem")}</button>
                      </div>
                    ))}
                    {draft.features.length === 0 && <p className="text-xs text-navy-900/45 dark:text-ivory-50/45">{t("noFeatures")}</p>}
                  </section>

                  {/* الإحصائيات */}
                  <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 dark:border-white/10 dark:bg-[#161b22]">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold">{t("stats")}</h2>
                      <button onClick={() => setDraft({ ...draft, stats: [...draft.stats, { value: "", label: "" }] })} className={ghostBtn}>{t("add")}</button>
                    </div>
                    {draft.stats.map((s, i) => (
                      <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-white p-3 sm:grid-cols-[0.8fr_1.4fr_auto] sm:items-center dark:border-white/10 dark:bg-[#0d1117]">
                        <input className={inputCls} value={s.value} placeholder="20W" onChange={(e) => { const stats = [...draft.stats]; stats[i] = { ...s, value: e.target.value }; setDraft({ ...draft, stats }); }} />
                        <input className={inputCls} value={s.label} placeholder="قوة الشحن" onChange={(e) => { const stats = [...draft.stats]; stats[i] = { ...s, label: e.target.value }; setDraft({ ...draft, stats }); }} />
                        <button onClick={() => setDraft({ ...draft, stats: draft.stats.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">{t("deleteItem")}</button>
                      </div>
                    ))}
                  </section>

                  {/* الآراء */}
                  <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 p-5 dark:border-white/10 dark:bg-[#161b22]">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold">{t("testimonials")}</h2>
                      <button onClick={() => setDraft({ ...draft, testimonials: [...draft.testimonials, { quote: "", name: "", city: "" }] })} className={ghostBtn}>{t("add")}</button>
                    </div>
                    {draft.testimonials.map((tm, i) => (
                      <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-white p-3 dark:border-white/10 dark:bg-[#0d1117]">
                        <textarea className={`${inputCls} min-h-20 resize-y`} value={tm.quote} placeholder={t("testimonialQuote")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, quote: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input className={inputCls} value={tm.name} placeholder={t("nameField")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, name: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                          <div className="flex gap-2">
                            <input className={inputCls} value={tm.city} placeholder={t("city")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, city: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                            <button onClick={() => htmlDelete(draft.testimonials, i, setDraft)} className="shrink-0 text-xs font-bold text-red-600">{t("deleteItem")}</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                </div>
              )}
            </section>

            {/* أزرار العمليات — المحظورة تُعرض الرسالة التوجيهية */}
            <div className="grid gap-2">
              <button onClick={handleGenerate} className="rounded-full bg-navy-500 px-4 py-3 text-xs font-bold text-white transition hover:bg-navy-400">
                {t("demoGenerate")}
              </button>
              <div className="flex flex-wrap gap-2">
                <button onClick={blockedAction} className={ghostBtn} title={t("downloadHtml")}>
                  {t("downloadHtml")}
                </button>
                <button onClick={blockedAction} className={ghostBtn} title={t("generatePage")}>
                  {t("generatePage")}
                </button>
                <button onClick={blockedAction} className={ghostBtn}>
                  {t("publishDirect")}
                </button>
              </div>
              <Link
                href="/studio"
                prefetch
                className="rounded-full bg-navy-900 px-4 py-3 text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
              >
                {t("demoOpenStudio")} ←
              </Link>
            </div>
          </div>

          {/* المعاينة المباشرة */}
          <div className="flex min-h-0 flex-col border-t border-navy-900/10 dark:border-white/10 lg:border-s-t-0 lg:border-s lg:border-navy-900/10">
            <div className="flex items-center justify-between border-b border-navy-900/10 px-5 py-2.5 text-xs font-bold text-navy-700 dark:border-white/10 dark:text-ivory-50">
              <span>{t("demoLivePreview")}</span>
              <span className="text-navy-900/45 dark:text-ivory-50/45">{previewProduct.name || "—"}</span>
            </div>
            <div className="max-h-[60vh] flex-1 overflow-y-auto bg-slate-100 lg:max-h-none dark:bg-[#0a0d12]">
              <div className="mx-auto max-w-3xl">
                <ProductLanding product={previewProduct} preview />
              </div>
            </div>
          </div>
        </div>

        {/* الرسالة التوجيهية عند محاولة التحميل/الحفظ/النشر */}
        {showNotice && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-navy-950/70 p-4" role="alertdialog" aria-modal="true">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/40 bg-white shadow-2xl dark:bg-[#161b22]">
              <div className="bg-amber-500 px-5 py-4 text-center text-white">
                <p className="font-display text-lg font-extrabold">{t("demoNoticeTitle")}</p>
              </div>
              <div className="grid gap-4 p-6">
                <p className="text-sm leading-7 text-navy-800 dark:text-ivory-50/80">{t("demoNoticeBody")}</p>
                <Link
                  href="/studio"
                  prefetch
                  className="rounded-full bg-navy-900 px-5 py-3 text-sm font-bold text-ivory-50 transition hover:bg-navy-700"
                >
                  {t("demoOpenStudio")} ←
                </Link>
                <button onClick={() => setShowNotice(false)} className={ghostBtn}>
                  {t("demoClose")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// دالة مساعدة لحذف عنصر من قائمة الآراء (تجنّب تكرار الإغلاق عند النقر على زر الحذف)
function htmlDelete(
  list: { quote: string; name: string; city: string }[],
  i: number,
  setDraft: React.Dispatch<React.SetStateAction<DemoDraft>>
) {
  setDraft((d) => ({ ...d, testimonials: list.filter((_, j) => j !== i) }));
}
