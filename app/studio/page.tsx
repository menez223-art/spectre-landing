"use client";

import { useEffect, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Product, Theme } from "@/app/lib/types";
import { MAX_LANDING_PRODUCTS, MAX_LANDING_IMAGES } from "@/app/lib/types";
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
// المعاينة الحية ثقيلة (تستخرج اللوحة/ترسم المنتج) — نحمّلها ديناميكياً
// لتقليل JS الأولي لصفحة الاستوديو، مع هيكل بديل أثناء التحميل.
const ProductLanding = dynamic(
  () => import("@/app/components/landing/ProductLanding").then((m) => m.ProductLanding),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto h-64 w-full max-w-md animate-pulse rounded-2xl bg-navy-900/10 dark:bg-white/10" />
    ),
  }
);
import { AuthGate, useAuth } from "@/app/components/auth/AuthGate";
import { apiCanProduce } from "@/app/lib/auth";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";
import { ProductItemsEditor, type ProductItemDraft } from "@/app/components/studio/ProductItemsEditor";

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

// مسودة صفحة هبوط = «متجر» يحوي عنصراً واحداً على الأقل.
// المنتج المفرد = items بعنصر واحد (توافق عكسي كامل مع المنشورات القديمة).
// المتجر (منتجات متعددة) = items بعدة عناصر، والحقول الجذرية (brand/theme/
// delivery/features...) هي إعدادات «الغلاف» المشتركة لكل الصفحة.
interface Draft {
  id?: string;
  name: string; // اسم الصفحة/المتجر (لقب الغلاف)
  brand: string;
  deliveryHome: string;
  deliveryOffice: string;
  deliveryMode: "fixed" | "wilaya";
  wilayaPrices: Record<number, { home: number; office: number }>;
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
  items: ProductItemDraft[]; // عنصر واحد على الأقل (المنتج المفرد = [واحد])
}

function emptyItem(): ProductItemDraft {
  return { name: "", nameEn: "", price: "", oldPrice: "", image: "", images: [], colors: [] };
}

function emptyDraft(): Draft {
  return {
    name: "",
    brand: "",
    deliveryHome: String(DELIVERY_PRICES.home),
    deliveryOffice: String(DELIVERY_PRICES.office),
    deliveryMode: "fixed",
    wilayaPrices: {},
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
    items: [emptyItem()],
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

// يحوّل عنصر مسودة واحداً إلى Product جزئي (باسمه وسعره وصوره وألوانه).
function itemToProduct(item: ProductItemDraft): Product {
  const name = item.name.trim();
  const price = Math.max(0, Number(item.price) || 0);
  const oldPriceRaw = Number(item.oldPrice) || 0;
  const images = item.images.map((s) => s.trim()).filter(Boolean);
  return {
    id: slugify(item.nameEn || name) || `item-${rand4()}`,
    name,
    price,
    image: item.image,
    theme: defaultTheme("light"),
    ...(item.nameEn.trim() ? { nameEn: item.nameEn.trim() } : {}),
    ...(images.length ? { images } : {}),
    ...(oldPriceRaw > price ? { oldPrice: oldPriceRaw } : {}),
    ...(item.colors.length
      ? {
          colors: item.colors
            .map((c) => ({ name: c.name.trim(), hex: normalizeHex(c.hex) }))
            .filter((c) => c.name && /^#[0-9a-fA-F]{6}$/.test(c.hex)),
        }
      : {}),
  };
}

function draftToProduct(d: Draft, preview: boolean): Product {
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

  const id = preview
    ? d.id ?? "preview"
    : slugify(d.brand || d.name) || `shop-${rand4()}`;

  // العناصر الفعلية — نضمن وجود واحد على الأقل (المنتج المفرد).
  const items = (d.items.length ? d.items : [emptyItem()]).map(itemToProduct);

  const base: Product = {
    id,
    name: d.name.trim() || items[0].name || "متجر",
    price: items[0].price,
    image: items[0].image,
    ...(brand ? { brand } : {}),
    ...(tags.length ? { tags } : {}),
    ...(d.eyebrow.trim() ? { eyebrow: d.eyebrow.trim() } : {}),
    ...(d.badge.trim() ? { badge: d.badge.trim() } : {}),
    ...(d.description.trim() ? { description: d.description.trim() } : {}),
    ...(d.tagline.trim() ? { tagline: d.tagline.trim() } : {}),
    ...(features.length ? { features } : {}),
    ...(testimonials.length ? { testimonials } : {}),
    ...(stats.length ? { stats } : {}),
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
  };

  // ── الترويسة الرئيسية للصفحة ──
  // منتج واحد: اسم المنتج هو الترويسة (نتجاهل «عنوان المتجر» لتفادي التكرار).
  // منتجات متعددة: «عنوان المتجر» d.name هو الترويسة؛ وإلا اسم أول منتج احتياطاً.
  const heading = items.length > 1 ? d.name.trim() || items[0].name : items[0].name;

  // الحماية: كل منتج يجب أن له اسم — في النشر الفعلي نرفض البناء إن وُجد
  // عنصر بلا اسم (كان سابقاً يسقط إلى "منتج جديد" المضلِل). في المعاينة
  // (preview) لا نرمي كي لا ينهار العرض — نكتفي بترويسة احتياطية.
  if (!preview) {
    const missingName = items.find((it) => !it.name.trim());
    if (missingName) {
      throw new Error("product_name_required");
    }
  }

  if (items.length > 1) {
    return { ...base, name: heading, products: items };
  }
  const solo = items[0];
  // منتج واحد: اسم المنتج هو الترويسة (نتجاهل عنوان المتجر لتفادي التكرار).
  return {
    ...base,
    name: solo.name,
    price: solo.price,
    image: solo.image,
    ...(solo.nameEn ? { nameEn: solo.nameEn } : {}),
    ...(solo.images?.length ? { images: solo.images } : {}),
    ...(typeof solo.oldPrice === "number" ? { oldPrice: solo.oldPrice } : {}),
    ...(solo.colors?.length ? { colors: solo.colors } : {}),
  };
}

function productToDraft(p: Product): Draft {
  // استخراج العناصر: إن وُجدت products[] نكون في وضع المتجر، وإلا نبني عنصراً
  // واحداً من حقول الجذر (المنتج المفرد — توافق عكسي مع المنشورات القديمة).
  const items: ProductItemDraft[] = Array.isArray(p.products) && p.products.length > 0
    ? p.products.map((it) => ({
        name: it.name,
        nameEn: it.nameEn ?? "",
        price: String(it.price),
        oldPrice: it.oldPrice ? String(it.oldPrice) : "",
        image: it.image,
        images: it.images ?? [],
        colors: (it.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
      }))
    : [
        {
          name: p.name,
          nameEn: p.nameEn ?? "",
          price: String(p.price),
          oldPrice: p.oldPrice ? String(p.oldPrice) : "",
          image: p.image,
          images: p.images ?? [],
          colors: (p.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
        },
      ];
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? "",
    deliveryHome: p.delivery ? String(p.delivery.home) : String(DELIVERY_PRICES.home),
    deliveryOffice: p.delivery ? String(p.delivery.office) : String(DELIVERY_PRICES.office),
    deliveryMode: p.deliveryMode ?? "fixed",
    wilayaPrices: Object.fromEntries(
      (Object.entries(p.wilayaPrices ?? {}) as [string, WilayaPrice | number][]).map(
        ([code, entry]) => [Number(code), normalizeWilayaEntry(entry, DELIVERY_PRICES.office)]
      )
    ) as Record<number, { home: number; office: number }>,
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
    items,
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

// تحديث العنصر النشط (activeItem) داخل draft.items بشكل آمن.
function updateItem(
  items: ProductItemDraft[],
  index: number,
  patch: Partial<ProductItemDraft>
): ProductItemDraft[] {
  const next = items.slice();
  next[index] = { ...next[index], ...patch };
  return next;
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
  const { t, lang, dir } = useLocale();
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
  // العنصر النشط الذي تُحرَّر صوره وألوانه حالياً في اللوحة الجانبية.
  const [activeItem, setActiveItem] = useState(0);

  // مجموع صور كل عناصر الصفحة — للتحقق من الحد الأقصى (5) في الواجهة.
  const totalImages = useMemo(
    () =>
      draft.items.reduce(
        (sum, it) => sum + (it.image ? 1 : 0) + it.images.filter(Boolean).length,
        0
      ),
    [draft.items]
  );
  const remainingImages = Math.max(0, MAX_LANDING_IMAGES - totalImages);

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

  // نؤجّل بناء المعاينة الحية عن المسودة الفورية كي لا يُعاد توليد
  // ProductLanding عند كل ضربة مفتاح (يخفّف إعادة الرسم ويجعل الكتابة سلسة).
  const deferredDraft = useDeferredValue(draft);
  const previewProduct = useMemo(() => draftToProduct(deferredDraft, true), [deferredDraft]);

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

  // الصور والألوان تُحرَّر لـ activeItem (العنصر النشط في محرّر المنتجات).
  async function handleMainImage(file: File) {
    if (!file) return;
    const dataUrl = await compressImage(file);
    setDraft((d) => {
      const items = d.items.slice();
      items[activeItem] = { ...items[activeItem], image: dataUrl };
      return { ...d, items };
    });
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
    setDraft((d) => {
      const items = d.items.slice();
      const it = items[activeItem];
      // حماية الواجهة: لا تتجاوز الحد الأقصى للصور (باقي رصيد الصفحة).
      if (it.images.length >= remainingImages) return d;
      items[activeItem] = { ...it, images: [...it.images, dataUrl] };
      return { ...d, items };
    });
  }

  async function handleExtract() {
    const current = draft.items[activeItem];
    if (!current.image) return;
    try {
      const result = current.image.startsWith("data:")
        ? await extractPaletteFromDataUrl(current.image)
        : await extractPaletteFromUrl(current.image);
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
    // اسم المنتج يُقرأ من بطاقته (وليس «عنوان المتجر» الذي يظهر فقط في متعدد).
    const hasEmptyName = draft.items.some((it) => !it.name.trim());
    if (hasEmptyName) {
      setError(t("productNameRequired"));
      return;
    }
    if (!draft.items[activeItem]?.image?.trim()) {
      setError(t("errImage"));
      return;
    }
    setError("");
    let product: Product;
    try {
      product = draftToProduct(draft, false);
    } catch {
      setError(t("productNameRequired"));
      return;
    }
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
    // الاسم المرجعي لتوليد المحتوى: اسم المنتج النشط (منتج واحد) أو عنوان
    // المتجر (متعدد). في منتج واحد نعتمد اسم البطاقة لا «عنوان المتجر».
    const refName = draft.items.length > 1
      ? draft.name.trim()
      : (draft.items[activeItem]?.name.trim() || "");
    if (!refName) {
      setError(t("productNameRequired"));
      return;
    }
    setError("");
    const active = draft.items[activeItem];
    const content = generateAutoContent({
      name: refName,
      nameEn: (active?.nameEn || "").trim() || undefined,
      price: Math.max(0, Number(active?.price) || 0),
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
    const hasEmptyName = draft.items.some((it) => !it.name.trim());
    if (hasEmptyName) {
      setError(t("productNameRequired"));
      return;
    }
    if (!draft.items[activeItem]?.image?.trim()) {
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
    let product: Product;
    try {
      product = withSheetWebhook(draftToProduct(draft, false));
    } catch {
      setError(t("productNameRequired"));
      return;
    }
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
    setDraft((d) => {
      const items = d.items.slice();
      items[activeItem] = { ...items[activeItem], image: url };
      return { ...d, items };
    });
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

  async function handlePublish(opts?: { newLink?: boolean }) {
    if (locked) return;
    // اسم المنتج يُقرأ من بطاقته (وليس «عنوان المتجر» المخفي في منتج واحد).
    const hasEmptyName = draft.items.some((it) => !it.name.trim());
    if (hasEmptyName) {
      setError(t("productNameRequired"));
      return;
    }
    if (!draft.items[activeItem]?.image?.trim()) {
      setError(t("errImage"));
      return;
    }
    // قيد العميل الاحترازي: لا يتجاوز الحد الأقصى للصور/المنتجات (الخادم يفرضه أيضاً).
    if (draft.items.length > MAX_LANDING_PRODUCTS) {
      setError(t("errTooManyProducts"));
      return;
    }
    if (totalImages > MAX_LANDING_IMAGES) {
      setError(t("errTooManyImages"));
      return;
    }
    setError("");
    if (!fingerprint) {
      setError(t("errSession"));
      return;
    }
    let product: Product;
    try {
      product = draftToProduct(draft, false);
    } catch {
      setError(t("productNameRequired"));
      return;
    }
    if (!editingId && slugExists(product.id)) {
      product = { ...product, id: `${product.id}-${rand4()}` };
    }
    product = withSheetWebhook(product);
    saveProduct(product);
    setPublishing(true);
    try {
      const qs = new URLSearchParams({ fingerprint });
      if (opts?.newLink) qs.set("newLink", "1");
      const res = await fetch(`/api/publish?${qs.toString()}`, {
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

          {/* اليسار: الإجراءات مرتّبة — أدوات ثم نشر.
              مجموعتان منفصلتان (أيقونات | إجراءات) بفاصل واضح لتفادي الازدحام. */}
          <div className="flex flex-wrap items-center gap-2">
            {/* مجموعة الأيقونات: ثيم / لغة / إعدادات / خروج */}
            <div className="flex items-center gap-1.5">
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
            </div>
            <div className="mx-0.5 hidden h-6 w-px bg-navy-900/10 sm:block" />
            {/* مجموعة الإجراءات: توليد المحتوى · تحميل HTML · توليد الصفحة · نشر · رابط جديد */}
            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => handlePublish()}
                disabled={locked || publishing}
                title={locked ? t("lockedHint") : t("publishReplace")}
                className={`rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-60 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {publishing ? t("publishing") : t("publishReplace")}
              </button>
              <button
                onClick={() => handlePublish({ newLink: true })}
                disabled={locked || publishing}
                title={t("newLinkHint")}
                className={`rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-500/10 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                ♻ {t("newLink")}
              </button>
            </div>
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
            {/* عنوان المتجر: يظهر فقط في وضع المتجر (منتجات متعددة).
                في منتج واحد نعتمد اسم المنتج كترويسة تلقائياً لتفادي التكرار. */}
            {draft.items.length > 1 && (
              <Field label={t("storeTitle")} hint={t("storeTitleHint")}>
                <input className={stInput} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="متجر الأحذية برو" />
              </Field>
            )}
            <Field label={t("brandField")}>
              <input className={stInput} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="ProSound" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
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
          </section>

          {/* لوحة المنتجات الموحّدة: البطاقات + الحقول + الصورة + الألوان */}
          <section className="grid gap-5 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
          <ProductItemsEditor
            bare
            items={draft.items}
            activeIndex={activeItem}
            remainingImages={remainingImages}
            maxProducts={MAX_LANDING_PRODUCTS}
            lang={lang}
            dir={dir}
            onSelect={(i) => setActiveItem(i)}
            onChange={(items) => setDraft((d) => ({ ...d, items }))}
            onAdd={() => {
              setDraft((d) => {
                if (d.items.length >= MAX_LANDING_PRODUCTS) return d;
                return { ...d, items: [...d.items, emptyItem()] };
              });
              setActiveItem(draft.items.length);
            }}
            onRemove={(i) => {
              setDraft((d) => {
                if (d.items.length <= 1) return d;
                const items = d.items.filter((_, j) => j !== i);
                return { ...d, items };
              });
              setActiveItem((v) => Math.max(0, Math.min(v, draft.items.length - 2)));
            }}
          />

          {/* صورة وألوان العنصر النشط (مدمجة داخل لوحة المنتجات) */}
          <div className="mt-2 grid gap-4 border-t border-navy-900/10 pt-5 dark:border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">
                {t("productImage")}
                {draft.items.length > 1 ? ` · ${draft.items[activeItem]?.name || `#${activeItem + 1}`}` : ""}
              </h2>
              {draft.items[activeItem]?.image && (
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
                {draft.items[activeItem]?.image && (
                  <div className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-2.5">
                    <img src={draft.items[activeItem].image} alt={t("currentImage")} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                    <span className="flex-1 truncate text-[11px] text-navy-900/50">{t("currentImage")}</span>
                    <button
                      onClick={() => {
                        setDraft((d) => ({ ...d, items: updateItem(d.items, activeItem, { image: "" }) }));
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
                {draft.items[activeItem]?.image ? (
                  <div className="flex items-center gap-4">
                    <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory-100 ring-1 ring-navy-900/10">
                      <img src={draft.items[activeItem].image} alt={t("productImage")} className="h-full w-full object-cover" />
                    </div>
                    <div className="grid gap-2">
                      <label className={`${stBtnGhost} cursor-pointer text-center`}>
                        {t("replaceImage")}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMainImage(e.target.files[0])} />
                      </label>
                      <button onClick={() => setDraft((d) => ({ ...d, items: updateItem(d.items, activeItem, { image: "" }) }))} className={stBtnGhost}>
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

            {/* صور إضافية للعنصر النشط */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-navy-700">
                <span>{t("galleryTitle")}</span>
                <span className="text-navy-900/45">{t("imagesRemaining", { n: remainingImages })}</span>
              </div>
              {draft.items[activeItem]?.images.map((img, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-[#161b22] p-2">
                  <img src={img} alt={t("extraImage", { n: i + 1 })} className="h-14 w-14 rounded-xl object-cover ring-1 ring-navy-900/10" />
                  <span className="flex-1 text-xs text-navy-900/50">{t("extraImage", { n: i + 1 })}</span>
                  <button
                    onClick={() =>
                      setDraft((d) => {
                        const it = d.items[activeItem];
                        return { ...d, items: updateItem(d.items, activeItem, { images: it.images.filter((_, j) => j !== i) }) };
                      })
                    }
                    className="text-xs font-bold text-red-600"
                  >
                    {t("deleteItem")}
                  </button>
                </div>
              ))}
              {remainingImages > 0 && (
                <label className={`${stBtnGhost} cursor-pointer text-center`}>
                  {t("addImage")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleAddImage(e.target.files[0])} />
                </label>
              )}

              {/* ألوان العنصر النشط — يختارها الزبون للعرض فقط */}
              <div className="mt-2 grid gap-1.5 border-t border-navy-900/10 pt-3 dark:border-white/10">
                <span className="text-xs font-semibold text-navy-700">{t("colorsTitle")}</span>
                <span className="text-[10px] font-normal text-navy-900/45">{t("colorsHint")}</span>
                <div className="grid gap-2">
                  {(draft.items[activeItem]?.colors ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#3b82f6"}
                        onChange={(e) => {
                          setDraft((d) => {
                            const it = d.items[activeItem];
                            const colors = it.colors.slice();
                            colors[i] = { ...colors[i], hex: e.target.value };
                            return { ...d, items: updateItem(d.items, activeItem, { colors }) };
                          });
                        }}
                        className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-navy-900/15 bg-transparent p-0"
                      />
                      <input
                        className={stInput}
                        value={c.name}
                        onChange={(e) => {
                          setDraft((d) => {
                            const it = d.items[activeItem];
                            const colors = it.colors.slice();
                            colors[i] = { ...colors[i], name: e.target.value };
                            return { ...d, items: updateItem(d.items, activeItem, { colors }) };
                          });
                        }}
                        placeholder="الأسود"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => {
                            const it = d.items[activeItem];
                            return { ...d, items: updateItem(d.items, activeItem, { colors: it.colors.filter((_, j) => j !== i) }) };
                          })
                        }
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
                  onClick={() =>
                    setDraft((d) => {
                      const it = d.items[activeItem];
                      return { ...d, items: updateItem(d.items, activeItem, { colors: [...it.colors, { name: "", hex: "#3b82f6" }] }) };
                    })
                  }
                  className={stBtnGhost}
                >
                  + {t("addColor")}
                </button>
              </div>
            </div>
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
                onClick={() => handlePublish()}
                disabled={locked || publishing}
                title={locked ? t("lockedHint") : t("publishBtn")}
                className={`rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-60 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {publishing ? t("publishingBtn") : t("publishBtn")}
              </button>
              <button
                onClick={() => handlePublish({ newLink: true })}
                disabled={locked || publishing}
                title={t("newLinkHint")}
                className={`rounded-full border border-red-500/40 px-4 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-500/10 ${locked ? "cursor-not-allowed opacity-50" : ""}`}
              >
                ♻ {t("newLink")}
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
              <span dir="ltr" className="text-navy-900/45">/p/{previewProduct.id}</span>
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
