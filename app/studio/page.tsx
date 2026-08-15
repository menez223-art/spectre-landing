"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product, Theme } from "@/app/lib/types";
import { defaultTheme, normalizeTheme } from "@/app/lib/theme";
import {
  PaletteCorsError,
  compressImage,
  extractPaletteFromDataUrl,
  extractPaletteFromUrl,
} from "@/app/lib/palette";
import { ensureContrast } from "@/app/lib/color";
import { getProduct, saveProduct, slugExists, slugify } from "@/app/lib/storage";
import { CATEGORIES, generateAutoContent, type Category } from "@/app/lib/autoContent";
import { DELIVERY_PRICES, WILAYAS, normalizeWilayaEntry } from "@/app/data/delivery";
import type { WilayaPrice } from "@/app/lib/types";
import { generateLandingHtml } from "@/app/lib/generateHtml";
import { ProductLanding } from "@/app/components/landing/ProductLanding";
import { AuthGate, useAuth } from "@/app/components/auth/AuthGate";
import { apiCanProduce } from "@/app/lib/auth";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";

export interface PublishedItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  url: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

// ينسّق مدة الصلاحية للعرض في الستوديو (عربية RTL).
const stInput =
  "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50 dark:placeholder:text-ivory-50/35";
const stBtnGhost =
  "rounded-full border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400";
const stBtnIcon =
  "grid h-9 w-9 place-items-center rounded-full border border-navy-900/15 text-sm font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400";

interface Draft {
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

function emptyDraft(): Draft {
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

function rand4(): string {
  return Math.random().toString(36).slice(2, 6);
}

// يضبط كود اللون ليكون بصيغة #rrggbb صغيرة، أو "" إن كان غير صالح
function normalizeHex(value: string): string {
  const v = (value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : "";
}

// يحوّل خريطة أسعار الولايات في المسودة إلى السجل النهائي (تصفير القيم السالبة/الفارغة)
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

function draftToProduct(d: Draft, preview: boolean): Product {
  const name = d.name.trim() || "منتج جديد";
  const price = Math.max(0, Number(d.price) || 0);
  const oldPriceRaw = Number(d.oldPrice) || 0;
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

  const id = preview
    ? d.id ?? "preview"
    : slugify(d.nameEn || d.brand || name) || `product-${rand4()}`;

  const product: Product = {
    id,
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

function productToDraft(p: Product): Draft {
  return {
    id: p.id,
    name: p.name,
    nameEn: p.nameEn ?? "",
    brand: p.brand ?? "",
    price: String(p.price),
    oldPrice: p.oldPrice ? String(p.oldPrice) : "",
    deliveryHome: p.delivery ? String(p.delivery.home) : String(DELIVERY_PRICES.home),
    deliveryOffice: p.delivery ? String(p.delivery.office) : String(DELIVERY_PRICES.office),
    deliveryMode: p.deliveryMode ?? "fixed",
    wilayaPrices: Object.fromEntries(
      (Object.entries(p.wilayaPrices ?? {}) as [string, WilayaPrice | number][]).map(
        ([code, entry]) => [Number(code), normalizeWilayaEntry(entry, DELIVERY_PRICES.office)]
      )
    ) as Record<number, { home: number; office: number }>,
    colors: (p.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
    image: p.image,
    images: p.images ?? [],
    eyebrow: p.eyebrow ?? "",
    badge: p.badge ?? "",
    description: p.description ?? "",
    tagline: p.tagline ?? "",
    tags: (p.tags ?? []).join("، "),
    category: "عام",
    features: (p.features ?? []).map((f) => ({ title: f.title, copy: f.copy })),
    testimonials: (p.testimonials ?? []).map((t) => ({ quote: t.quote, name: t.name, city: t.city })),
    stats: (p.stats ?? []).map((s) => ({ value: s.value, label: s.label })),
    theme: normalizeTheme(p.theme),
    swatches: [p.theme.primary],
    extracted: true,
  };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
      <span>{label}</span>
      {children}
      {hint && <span className="text-[10px] font-normal text-navy-900/45">{hint}</span>}
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
    <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
      <span>{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-navy-900/15 bg-white p-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#3b82f6"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-xs text-navy-900 outline-none" />
      </div>
    </label>
  );
}

export default function StudioPage() {
  return (
    <AuthGate>
      <StudioInner />
    </AuthGate>
  );
}

function StudioInner() {
  const router = useRouter();
  const { user, account, fingerprint, logout, openSettings, subscription } = useAuth();
  const { t } = useLocale();
  // قفل التنزيل/التوليد/النشر: يُعطَّلان تماماً لمن لم يربط إيميله بعد،
  // أو لمن حظره الأدمن. هذا يمنع إنتاج روابط جديدة أو تحميل HTML قبل اكتمال
  // ربط الهوية (أو عند المنع). الحارس الحقيقي يبقى خادمياً في /api/publish.
  const locked = !account?.email || subscription?.status === "banned";
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedInfo, setPublishedInfo] = useState<{ url: string; slug: string } | null>(null);
  const [publishedList, setPublishedList] = useState<PublishedItem[]>([]);
  const [copiedPublished, setCopiedPublished] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [paletteWarning, setPaletteWarning] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const product = getProduct(id);
    if (product) {
      const loaded = productToDraft(product);
      setDraft(loaded);
      setEditingId(id);
      // افتح «خيارات متقدمة» إن كانت الأقسام ممتلئة
      if (
        loaded.features.length ||
        loaded.testimonials.length ||
        loaded.stats.length ||
        loaded.extracted
      ) {
        setAdvancedOpen(true);
      }
    }
  }, []);

  // جلب الصفحات المنشورة عند فتح الاستوديو — فقط بعد تحميل بصمة الجهاز
  useEffect(() => {
    if (!fingerprint) return;
    loadPublishedList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const previewProduct = useMemo(() => draftToProduct(draft, true), [draft]);

  // حقن هوية الجدول الثابتة (البريد + المفتاح) في المنتج عند التوليد/النشر،
  // مع إبقاء رابط الجدول الحالي كاحتياط مخبّأ. الحلّ الديناميكي للرابط الحيّ
  // يتم خادمياً عبر sheetResolver (ينشر/يخدُم) أو وقت التحميل (HTML ثابت).
  function withSheetWebhook(product: Product): Product {
    const next: Product = { ...product };
    if (account?.sheetUrl) next.sheetWebhook = account.sheetUrl;
    if (account?.email) next.sheetEmail = account.email;
    if (account?.sheetKey) next.sheetKey = account.sheetKey;
    return next;
  }

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
      setDraft((d) => ({
        ...d,
        theme: result.theme,
        swatches: result.swatches,
        extracted: true,
      }));
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
        err instanceof PaletteCorsError
          ? t("errPaletteCors")
          : t("errPalette")
      );
      if (!(err instanceof PaletteCorsError)) console.error(err);
    }
  }

  function handleGenerate() {
    if (locked) return;
    if (!draft.name.trim()) {
      setError(t("errName"));
      return;
    }
    if (!draft.image.trim()) {
      setError(t("errImage"));
      return;
    }
    setError("");
    let product = draftToProduct(draft, false);
    if (!editingId && slugExists(product.id)) {
      product = { ...product, id: `${product.id}-${rand4()}` };
    }
    product = withSheetWebhook(product);
    saveProduct(product);
    router.push(`/p/${product.id}`);
  }

  // توليد المحتوى تلقائياً — يملأ الحقول التسويقية من الاسم والسعر والتصنيف
  function handleAutoGenerate() {
    if (locked) return;
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

  // تحميل صفحة الهبوط كملف HTML مستقل
  async function handleDownloadHtml() {
    if (locked) return;
    if (!draft.name.trim()) {
      setError(t("errName"));
      return;
    }
    if (!draft.image.trim()) {
      setError(t("errImage"));
      return;
    }
    if (!fingerprint) {
      setError(t("errSession"));
      return;
    }
    setError("");
    // بوابة خادمية قطعية: نتحقق من الحظر/الاكتمال خادمياً قبل التوليد،
    // كي لا يمكن لمستخدم محظور إنتاج ملف HTML عبر التفاف حارس العميل.
    try {
      const check = await apiCanProduce(fingerprint);
      if (!check.allowed) {
        setError(t("errPublishLocked"));
        return;
      }
    } catch {
      setError(t("errPublishNetwork"));
      return;
    }
    const product = withSheetWebhook(draftToProduct(draft, false));
    try {
      const html = await generateLandingHtml(product);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${product.id}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("تعذر توليد ملف HTML:", err);
      setError(t("errHtml"));
    }
  }

  // —— رابط صورة مباشر ————————————————————————————————
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
        err instanceof PaletteCorsError
          ? t("errPaletteCors")
          : t("errPalette")
      );
      if (!(err instanceof PaletteCorsError)) console.error(err);
    }
  }

  // —— النشر المباشر —————————————————————————————————
  async function loadPublishedList() {
    if (!fingerprint) return;
    try {
      const res = await fetch(`/api/publish?fingerprint=${encodeURIComponent(fingerprint)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { products?: PublishedItem[] };
      setPublishedList(data.products ?? []);
    } catch {
      // القائمة اختيارية — لا نعرض خطأً عند تعذّرها
    }
  }

  async function handlePublish() {
    if (locked) return;
    if (!draft.name.trim()) {
      setError(t("errName"));
      return;
    }
    if (!draft.image.trim()) {
      setError(t("errImage"));
      return;
    }
    setError("");
    if (!fingerprint) {
      setError(t("errSession"));
      return;
    }
    let product = draftToProduct(draft, false);
    if (!editingId && slugExists(product.id)) {
      product = { ...product, id: `${product.id}-${rand4()}` };
    }
    product = withSheetWebhook(product);
    saveProduct(product);
    setPublishing(true);
    try {
      const res = await fetch(`/api/publish?fingerprint=${encodeURIComponent(fingerprint)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; slug?: string; error?: string };
      if (res.status === 403 && (data.error === "incomplete" || data.error === "banned" || data.error === "suspended")) {
        setError(t("errPublishLocked"));
      } else if (res.status === 503 && data.error === "config") {
        setError(t("errPublishConfig"));
      } else if (res.status === 413) {
        setError(t("errPublishLarge"));
      } else if (!res.ok || !data.url) {
        setError(t("errPublish"));
      } else {
        setPublishedInfo({ url: data.url, slug: data.slug ?? "" });
        loadPublishedList();
      }
    } catch {
      setError(t("errPublishNetwork"));
    } finally {
      setPublishing(false);
    }
  }

  async function copyPublishedUrl() {
    if (!publishedInfo) return;
    try {
      await navigator.clipboard.writeText(publishedInfo.url);
      setCopiedPublished(true);
      setTimeout(() => setCopiedPublished(false), 2000);
    } catch {
      setError(t("errCopyUrl"));
    }
  }

  async function handleUnpublish() {
    if (!publishedInfo) return;
    if (!fingerprint) return;
    try {
      const res = await fetch(
        `/api/publish?slug=${encodeURIComponent(publishedInfo.slug)}&fingerprint=${encodeURIComponent(fingerprint)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setPublishedInfo(null);
        loadPublishedList();
      } else {
        setError(t("errUnpublish"));
      }
    } catch {
      setError(t("errUnpublishNetwork"));
    }
  }

  // حذف منتج نهائي مع نافذة تحذير: «الرابط يحترق ولن يعمل» + تحرير المساحة.
  // يُحرق الرابط فوراً (يُحذف المنشور وملف الملكية من التخزين) فيتوقف عن
  // العمل لأي زائر وتتحرر مساحة التخزين تلقائياً لاستخدامها في مشاريع أخرى.
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteProduct() {
    if (!deleteTarget || !fingerprint) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/publish?slug=${encodeURIComponent(deleteTarget.slug)}&fingerprint=${encodeURIComponent(fingerprint)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        if (publishedInfo?.slug === deleteTarget.slug) setPublishedInfo(null);
        loadPublishedList();
        setDeleteTarget(null);
      } else {
        setError(t("errUnpublish"));
        setDeleteTarget(null);
      }
    } catch {
      setError(t("errUnpublishNetwork"));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* شريط علوي للحظر — يظهر فوراً في أعلى الصفحة عند حظر الأدمن للحساب */}
      {subscription?.status === "banned" && (
        <div
          role="alert"
          className="sticky top-0 z-50 w-full bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-red-900/30"
        >
          🚫 {t("subBanned")}
          {subscription.reason ? (
            <span className="ms-2 font-bold opacity-90">({subscription.reason})</span>
          ) : null}
        </div>
      )}
      {/* شريط قفل: يظهر عندما لم يربط المستخدم إيميله بعد — يمنع تنزيل/توليد/نشر
          روابط جديدة حتى يكمل ربط هويته من زر الإعدادات (⚙). */}
      {!account?.email && subscription?.status !== "banned" && (
        <div
          role="alert"
          className="sticky top-0 z-50 w-full bg-amber-500 px-4 py-2.5 text-center text-[13px] font-bold text-navy-950 shadow-lg shadow-amber-900/20"
        >
          🔒 {t("lockNoEmail")}
        </div>
      )}
      {/* نافذة تأكيد حذف المنتج — «الرابط يحترق ولن يعمل» */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red-300/40 bg-white p-6 shadow-2xl dark:border-red-500/30 dark:bg-[#161b22]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-xl dark:bg-red-900/40">🔥</span>
              <h2 className="text-lg font-extrabold text-navy-900 dark:text-ivory-50">{t("deleteProductTitle")}</h2>
            </div>
            <p className="text-sm leading-6 text-navy-900/75 dark:text-ivory-50/75">
              {t("deleteProductWarn")}
            </p>
            {deleteTarget.name && (
              <p className="mt-2 truncate rounded-xl bg-navy-900/5 px-3 py-2 text-xs font-bold text-navy-900 dark:bg-white/5 dark:text-ivory-50" dir="auto">
                {deleteTarget.name}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full border border-navy-900/15 px-5 py-2.5 text-sm font-bold text-navy-700 transition hover:bg-navy-900/5 disabled:opacity-50 dark:border-white/15 dark:text-ivory-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deleting}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? t("deleting") : t("confirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* شريط علوي */}
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex flex-wrap items-center justify-between gap-3 py-3">
          {/* اليمين: رجوع + العلامة + عنوان الصفحة */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-full border border-navy-900/15 px-3.5 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900"
              title={t("backToDashboard")}
            >
              <span aria-hidden className="text-sm leading-none">→</span>
              {t("backToDashboard")}
            </Link>
            <Link href="/" className="hidden font-display text-xl font-extrabold text-navy-900 sm:block">
              {t("brandField")}
            </Link>
            <span className="hidden max-w-[12rem] truncate text-xs text-navy-900/50 md:block">
              {editingId ? t("editing", { id: editingId }) : t("studioTitle")}
            </span>
          </div>

          {/* اليسار: الإجراءات مرتّبة — أدوات ثم نشر */}
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <LangToggle />
            {user && (
              <button onClick={openSettings} className={stBtnIcon} title={t("settings")} aria-label={t("settings")}>
                ⚙
              </button>
            )}
            {user && (
              <button onClick={logout} className={stBtnIcon} title={`${t("logout")} · ${user}`} aria-label={t("logout")}>
                ⎋
              </button>
            )}
            <div className="mx-0.5 hidden h-6 w-px bg-navy-900/10 sm:block" />
            <button
              onClick={handleAutoGenerate}
              disabled={locked}
              title={locked ? t("lockedHint") : t("generateContent")}
              className={`rounded-full bg-navy-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-navy-400 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {t("generateContent")}
            </button>
            <button
              onClick={handleDownloadHtml}
              disabled={locked}
              title={locked ? t("lockedHint") : t("downloadHtml")}
              className={`${stBtnGhost} ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {t("downloadHtml")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={locked}
              title={locked ? t("lockedHint") : t("generatePage")}
              className={`${stBtnGhost} ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {t("generatePage")}
            </button>
            <button
              onClick={handlePublish}
              disabled={locked || publishing}
              title={locked ? t("lockedHint") : t("publishDirect")}
              className={`rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-60 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {publishing ? t("publishing") : t("publishDirect")}
            </button>
          </div>
        </div>
      </header>

      <div className="container-landing grid gap-8 py-8 lg:grid-cols-2">
        {/* النموذج */}
        <div className="space-y-6 pb-10">
          {!account?.sheetUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm">
              <p className="text-amber-900">
                {t("warningNoSheet")}
              </p>
              <button onClick={openSettings} className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600">
                {t("linkSheetNow")}
              </button>
            </div>
          )}
          {error && (
            <p className="whitespace-pre-line rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700">
              {error}
            </p>
          )}

          {/* المعلومات الأساسية */}
          <section className="grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
            <h2 className="font-display text-base font-bold">{t("productInfo")}</h2>
            <Field label={t("productName")}>
              <input className={stInput} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("productNamePh")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("nameEn")} hint={t("nameEnHint")}>
                <input className={stInput} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} placeholder="Pro Wireless Earbuds" />
              </Field>
              <Field label={t("brandField")}>
                <input className={stInput} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="ProSound" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("price")}>
                <input className={stInput} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="4500" inputMode="numeric" />
              </Field>
              <Field label={t("oldPrice")} hint={t("oldPriceHint")}>
                <input className={stInput} value={draft.oldPrice} onChange={(e) => setDraft({ ...draft, oldPrice: e.target.value })} placeholder="5000" inputMode="numeric" />
              </Field>
              <Field label={t("badge")}>
                <input className={stInput} value={draft.badge} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="جديد / سريع" />
              </Field>
              <Field label={t("category")} hint={t("categoryHint")}>
                <select
                  className={stInput}
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
                  className={stInput}
                  value={draft.deliveryHome}
                  onChange={(e) => setDraft({ ...draft, deliveryHome: e.target.value })}
                  placeholder="700"
                  inputMode="numeric"
                  disabled={draft.deliveryMode === "wilaya"}
                />
              </Field>
              <Field label={t("deliveryOffice")} hint={t("deliveryOfficeHint")}>
                <input
                  className={stInput}
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
              <span className="text-xs font-semibold text-navy-700">{t("deliveryMode")}</span>
              <div className="flex rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold">
                {(["fixed", "wilaya"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft({ ...draft, deliveryMode: mode })}
                    className={`flex-1 rounded-full px-4 py-1.5 transition ${
                      draft.deliveryMode === mode ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900"
                    }`}
                  >
                    {mode === "fixed" ? t("deliveryModeFixed") : t("deliveryModeWilaya")}
                  </button>
                ))}
              </div>
              <span className="text-[10px] font-normal text-navy-900/45">{t("deliveryModeHint")}</span>
            </div>

            {/* محرر أسعار الولايات — سعران لكل ولاية (للمنزل + للمكتب) */}
            {draft.deliveryMode === "wilaya" && (
              <div className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-navy-700">{t("wilayaPricesTitle")}</span>
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
                    className={stBtnGhost}
                  >
                    {t("wilayaPricesFill")}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-navy-900/55">
                  <span className="flex-1">{t("wilayaColumnHome")}</span>
                  <span className="flex-1">{t("wilayaColumnOffice")}</span>
                </div>
                <p className="text-[10px] font-normal text-navy-900/45">{t("wilayaPricesHint")}</p>
                <div className="grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {WILAYAS.map((w) => (
                    <div key={w.code} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[11px] font-medium text-navy-700">
                        {w.code} · {w.name}
                      </span>
                      <input
                        className="w-full rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none transition focus:border-navy-500"
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
                        className="w-full rounded-lg border border-navy-900/15 bg-white px-2 py-1.5 text-xs text-navy-900 outline-none transition focus:border-navy-500"
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
              <input className={stInput} value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="صوت نقي يدوم طويلاً" />
            </Field>
            <Field label={t("eyebrow")}>
              <input className={stInput} value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} placeholder="USB-C · شحن سريع" />
            </Field>
            <Field label={t("description")}>
              <textarea className={`${stInput} min-h-24 resize-y`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="وصف قصير واحترافي للمنتج" />
            </Field>
            <Field label={t("tags")} hint={t("tagsHint")}>
              <input className={stInput} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} placeholder="بلوتوث 5.4, إلغاء ضوضاء, بطارية 36 ساعة" />
            </Field>

            {/* محرر ألوان المنتج — يختارها الزبون للعرض فقط */}
            <div className="grid gap-1.5">
              <span className="text-xs font-semibold text-navy-700">{t("colorsTitle")}</span>
              <span className="text-[10px] font-normal text-navy-900/45">{t("colorsHint")}</span>
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
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-navy-900/15 bg-transparent p-0"
                    />
                    <input
                      className={stInput}
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
                      className={stBtnGhost}
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
                className={stBtnGhost}
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
                <button onClick={handleExtract} className={stBtnGhost}>
                  {t("extractColors")}
                </button>
              )}
            </div>

            {/* مبدّل طريقة الإدخال: رفع / رابط */}
            <div className="flex rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold">
              {(["upload", "url"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setImageTab(mode)}
                  className={`flex-1 rounded-full px-4 py-1.5 transition ${
                    imageTab === mode ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900"
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
                    dir="ltr"
                    className={stInput}
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
                <p className="text-[11px] leading-5 text-navy-900/45">
                  رابط مباشر لصورة المنتج — يُستخدم كما هو على الصفحة، مع محاولة استخراج الألوان منه.
                </p>
                {draft.image && (
                  <div className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-2.5">
                    <img src={draft.image} alt={t("currentImage")} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                    <span className="flex-1 truncate text-[11px] text-navy-900/50">{t("currentImage")}</span>
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
                      <label className={`${stBtnGhost} cursor-pointer text-center`}>
                        {t("replaceImage")}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMainImage(e.target.files[0])} />
                      </label>
                      <button onClick={() => setDraft({ ...draft, image: "" })} className={stBtnGhost}>
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-navy-900/15 bg-ivory-50 px-4 py-10 text-center transition hover:border-navy-500/40">
                    <span className="text-2xl">🖼️</span>
                    <span className="text-sm font-bold text-navy-700">{t("uploadImagePh")}</span>
                    <span className="text-xs text-navy-900/45">{t("uploadImageHint")}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMainImage(e.target.files[0])} />
                  </label>
                )}
              </>
            )}

            {/* صور إضافية */}
            <div className="grid gap-3">
              {draft.images.map((img, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-2">
                  <img src={img} alt={t("extraImage", { n: i + 1 })} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                  <span className="flex-1 text-xs text-navy-900/50">{t("extraImage", { n: i + 1 })}</span>
                  <button onClick={() => setDraft({ ...draft, images: draft.images.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">
                    {t("deleteItem")}
                  </button>
                </div>
              ))}
              {draft.images.length < 4 && (
                <label className={`${stBtnGhost} cursor-pointer text-center`}>
                  {t("addImage")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAddImage(e.target.files[0])} />
                </label>
              )}
            </div>
          </section>

          {/* خيارات متقدمة — الألوان / المميزات / الإحصائيات / الآراء */}
          <section className="rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-start"
            >
              <span className="flex items-center gap-2 font-display text-base font-bold">
                {t("advanced")}
                <span className="rounded-full bg-ivory-100 px-2 py-0.5 text-[10px] font-bold text-navy-900/50">
                  {t("elements", { n: draft.features.length + draft.stats.length + draft.testimonials.length })}
                </span>
              </span>
              <span className="text-xs text-navy-900/50">{advancedOpen ? t("hide") : t("show")}</span>
            </button>
            {advancedOpen && (
              <div className="mt-5 grid gap-5">
                {/* الألوان */}
                <section className="grid gap-4 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{t("colorPalette")}</h2>
              <div className="flex gap-1 rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold">
                {(["dark", "light"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`rounded-full px-3 py-1 transition ${
                      draft.theme.mode === m ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900"
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
                <span className="text-[10px] font-semibold text-navy-900/50">{t("extractedColors")}</span>
                {draft.swatches.map((sw) => (
                  <button
                    key={sw}
                    onClick={() => setThemeField("primary", sw)}
                    className="h-8 w-8 rounded-full ring-1 ring-navy-900/15 transition hover:scale-110"
                    style={{ background: sw }}
                    aria-label={`اختيار اللون ${sw}`}
                  />
                ))}
              </div>
            )}
          </section>

                {/* المميزات */}
                <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{t("features")}</h2>
              <button onClick={() => setDraft({ ...draft, features: [...draft.features, { title: "", copy: "" }] })} className={stBtnGhost}>
                {t("add")}
              </button>
            </div>
            {draft.features.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
                <input className={stInput} value={f.title} placeholder={t("featureTitle")} onChange={(e) => { const features = [...draft.features]; features[i] = { ...f, title: e.target.value }; setDraft({ ...draft, features }); }} />
                <input className={stInput} value={f.copy} placeholder={t("featureCopy")} onChange={(e) => { const features = [...draft.features]; features[i] = { ...f, copy: e.target.value }; setDraft({ ...draft, features }); }} />
                <button onClick={() => setDraft({ ...draft, features: draft.features.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">{t("deleteItem")}</button>
              </div>
            ))}
            {draft.features.length === 0 && <p className="text-xs text-navy-900/45">{t("noFeatures")}</p>}
          </section>

                {/* الإحصائيات */}
                <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{t("stats")}</h2>
              <button onClick={() => setDraft({ ...draft, stats: [...draft.stats, { value: "", label: "" }] })} className={stBtnGhost}>{t("add")}</button>
            </div>
            {draft.stats.map((s, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-3 sm:grid-cols-[0.8fr_1.4fr_auto] sm:items-center">
                <input className={stInput} value={s.value} placeholder="20W" onChange={(e) => { const stats = [...draft.stats]; stats[i] = { ...s, value: e.target.value }; setDraft({ ...draft, stats }); }} />
                <input className={stInput} value={s.label} placeholder="قوة الشحن" onChange={(e) => { const stats = [...draft.stats]; stats[i] = { ...s, label: e.target.value }; setDraft({ ...draft, stats }); }} />
                <button onClick={() => setDraft({ ...draft, stats: draft.stats.filter((_, j) => j !== i) })} className="text-xs font-bold text-red-600">حذف</button>
              </div>
            ))}
          </section>

                {/* الآراء */}
                <section className="grid gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{t("testimonials")}</h2>
              <button onClick={() => setDraft({ ...draft, testimonials: [...draft.testimonials, { quote: "", name: "", city: "" }] })} className={stBtnGhost}>{t("add")}</button>
            </div>
            {draft.testimonials.map((tm, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-3">
                <textarea className={`${stInput} min-h-20 resize-y`} value={tm.quote} placeholder={t("testimonialQuote")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, quote: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={stInput} value={tm.name} placeholder={t("nameField")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, name: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                  <div className="flex gap-2">
                    <input className={stInput} value={tm.city} placeholder={t("city")} onChange={(e) => { const testimonials = [...draft.testimonials]; testimonials[i] = { ...tm, city: e.target.value }; setDraft({ ...draft, testimonials }); }} />
                    <button onClick={() => setDraft({ ...draft, testimonials: draft.testimonials.filter((_, j) => j !== i) })} className="shrink-0 text-xs font-bold text-red-600">{t("deleteItem")}</button>
                  </div>
                </div>
              </div>
            ))}
                </section>
              </div>
            )}
          </section>

          {/* النشر المباشر */}
          <section className="grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold">{t("publishSection")}</h2>
              <button
                onClick={handlePublish}
                disabled={locked || publishing}
                title={locked ? t("lockedHint") : t("publishBtn")}
                className={`rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-60 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {publishing ? t("publishingBtn") : t("publishBtn")}
              </button>
            </div>

            {publishedInfo ? (
              <div className="grid gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-800">{t("publishedOk")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    dir="ltr"
                    className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-navy-900 ring-1 ring-emerald-200 dark:bg-[#161b22] dark:text-ivory-50"
                  >
                    {publishedInfo.url}
                  </code>
                  <button onClick={copyPublishedUrl} className={stBtnGhost}>
                    {copiedPublished ? t("copied") : t("copy")}
                  </button>
                  <a href={publishedInfo.url} target="_blank" rel="noopener noreferrer" className={stBtnGhost}>
                    {t("open")}
                  </a>
                </div>
                <p className="text-[11px] leading-5 text-emerald-800/80">
                  {t("publishNote")}
                </p>
                <div>
                  <button onClick={handleUnpublish} className="text-xs font-bold text-red-600 hover:underline">
                    {t("unpublish")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-5 text-navy-900/55">
                {t("publishSub")}
              </p>
            )}

            {/* مدير المنشورات */}
            {publishedList.length > 0 && (
              <div className="grid gap-2">
                <p className="text-[11px] font-bold text-navy-900/50">{t("publishedPages", { n: publishedList.length })}</p>
                {publishedList.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-2.5">
                    {p.image && (
                      <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-navy-900/10" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-navy-900">{p.name}</p>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="block truncate text-[10px] text-navy-500 hover:underline"
                      >
                        {p.url}
                      </a>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ slug: p.id, name: p.name })}
                      className="shrink-0 text-[11px] font-bold text-red-600 hover:underline"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="rounded-2xl border border-navy-900/10 bg-white px-4 py-3 text-[11px] leading-5 text-navy-900/55 dark:border-white/10 dark:bg-[#11161d] dark:text-ivory-50/55">
            {t("fourWays")}
          </p>
        </div>

        {/* المعاينة المباشرة */}
        <div className="self-start lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-3xl border border-navy-900/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#11161d]">
            <div className="flex items-center justify-between border-b border-navy-900/10 px-5 py-3 text-xs font-bold text-navy-700 dark:border-white/10 dark:text-ivory-50">
              <span>{t("preview")}</span>
              <span dir="ltr" className="text-navy-900/45">/p/{draftToProduct(draft, false).id}</span>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-slate-100">
              <div className="mx-auto max-w-3xl">
                <ProductLanding product={previewProduct} preview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
