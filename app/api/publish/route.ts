import { NextResponse } from "next/server";
import type { Product } from "@/app/lib/types";
import {
  deletePublishedProduct,
  getPublishedProduct,
  hasPublishStore,
  listPublishedOwned,
  setPublishedMeta,
  setPublishedProduct,
  getPublishedOwner,
} from "@/app/lib/publishStore";
import { getDeviceOwner, isDeviceApprovedOnly, isDeviceBanned } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getSubscription, PLAN_QUOTAS, type Plan } from "@/app/lib/subsStore";
import { getKv, setKv, deleteKv } from "@/app/lib/kvStore";
import { deployHtmlToGithubPages, hasGithubPages } from "@/app/lib/githubPages";
import { generateLandingHtml } from "@/app/lib/generateHtml";
import { buildWebhook } from "@/app/lib/sheetResolver";
import {
  countPageImages,
  MAX_LANDING_PRODUCTS,
  MAX_LANDING_IMAGES,
} from "@/app/lib/types";

export const dynamic = "force-dynamic";

// حد أقصى لحجم جسم الطلب — صور data:URL قد تجعل الصفحة كبيرة جدًا
const MAX_BODY_BYTES = 1_200_000; // ≈ 1.2 ميغابايت

// مفتاح KV يربط كل مالك بسلاغه الثابت (رابط واحد لكل حساب).
const ownerSlugKey = (owner: string) => `owner-slug/${owner}`;

// يولّد سلاغاً جديداً غير مستخدم لصفحة هبوط (رابط ثابت للمالك).
async function generateSlug(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10)
        : Math.random().toString(36).slice(2, 12);
    const exists = await getPublishedProduct(candidate);
    if (!exists) return candidate;
  }
  return `p${Date.now().toString(36)}`;
}

// يثبّت للملاك رابطاً واحداً: إن وُجد سلاغه الثابت يُعاد استخدامه (تحديث في
// مكانه = رابط ثابت)، وإلا يولّد سلاغاً جديداً ويخزّنه. يُرجع السلاغ النهائي.
async function resolveOwnerSlug(owner: string): Promise<string> {
  const existing = await getKv<string>(ownerSlugKey(owner));
  if (typeof existing === "string" && existing.length > 0) return existing;
  const fresh = await generateSlug();
  await setKv(ownerSlugKey(owner), fresh);
  return fresh;
}

// يحرر منشور المالك المثبّت (الرابط القديم) نهائياً، ثم يولّد سلاغاً جديداً
// ويخزّنه — «رابط جديد» يحرق القديم تماماً (404 فوري) ويمهّد رابطاً جديداً.
async function rotateOwnerSlug(owner: string): Promise<string> {
  const old = await getKv<string>(ownerSlugKey(owner));
  if (typeof old === "string" && old.length > 0) {
    await deletePublishedProduct(old);
  }
  const fresh = await generateSlug();
  await setKv(ownerSlugKey(owner), fresh);
  return fresh;
}

function isValidProduct(p: unknown): p is Product {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    obj.id.length > 0 &&
    typeof obj.name === "string" &&
    typeof obj.price === "number" &&
    Number.isFinite(obj.price)
  );
}

function configResponse(): NextResponse {
  return NextResponse.json({ error: "config" }, { status: 503 });
}

// هوية المالك خادميًا: البريد المربوط إن وُجد، وإلا هوية الجهاز كسقوط.
// البريد ثابت عبر كل الأجهزة (نفس المستخدم على الحاسوب والهاتف)، فيبقى
// الوصول إلى كل المنشورات متاحاً من أي جهاز. عند ربط البريد لأول مرة نعيد
// إسناد منشورات الهوية القديمة (المملوكة للجهاز) إلى البريد الجديد، فلا
// تختفي بعد الربط. بلا بريد، يبقى المالك هوية الجهاز (سلوك التوافق القديم).
async function resolveOwner(fingerprint: string): Promise<string> {
  const email = await getProfileEmail(fingerprint);
  return email ?? getDeviceOwner(fingerprint);
}

// نشر منتج — يُخزَّن في Vercel Blob ويُعاد الرابط المباشر.
// الملكية تُقرأ خادميًا من ملف الجهاز (لا تُصدَّق من العميل) وتُخزَّن منفصلة عن المنتج.
export async function POST(request: Request) {
  if (!hasPublishStore()) return configResponse();

  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  try {
    const approved = await isDeviceApprovedOnly(fingerprint);
    if (!approved) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    // حماية دفاعية: جهاز محظور على مستوى صفّه المستقل → لا نشر (fail-closed).
    const banned = await isDeviceBanned(fingerprint);
    if (banned) return NextResponse.json({ error: "banned" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf-8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  let product: unknown;
  try {
    product = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isValidProduct(product)) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }

  // ── قيود تخفيف حمل الروابط (خادمية — غير قابلة للالتفاف من العميل) ──
  // عدد المنتجات في صفحة الهبوط الواحدة (وضع المتجر) محدود بـ MAX_LANDING_PRODUCTS،
  // ومجموع صور الصفحة (رئيسية + إضافية، موزّعة على كل المنتجات) محدود بـ
  // MAX_LANDING_IMAGES. هذه الحدود تخفّف حجم الصفحات واستهلاك السعة.
  const products = Array.isArray((product as Product).products)
    ? (product as Product).products!
    : [product as Product];
  if (products.length > MAX_LANDING_PRODUCTS) {
    return NextResponse.json(
      { error: "too_many_products", max: MAX_LANDING_PRODUCTS },
      { status: 413 }
    );
  }
  const imageCount = countPageImages(products);
  if (imageCount > MAX_LANDING_IMAGES) {
    return NextResponse.json(
      { error: "too_many_images", max: MAX_LANDING_IMAGES, count: imageCount },
      { status: 413 }
    );
  }

  const owner = await resolveOwner(fingerprint);

  // الحماية: لا يمكن نشر/إنتاج رابط جديد لمن لم يربط بريده بعد (حساب غير مكتمل).
  // البريد هو هوية المالك الثابتة — دونه لا نثبّت ملكية ولا نسمح بإنشاء روابط.
  // هذا يمنع التفاف تعطيل الأزرار من جهة العميل بطلب مباشر للخادم.
  const ownerEmail = await getProfileEmail(fingerprint);
  if (!ownerEmail) {
    return NextResponse.json({ error: "incomplete" }, { status: 403 });
  }

  // الحماية: يمنع نشر منتجات/روابط جديدة من مستخدم موقوف أو محظور.
  // الملكية تُقرأ خادميًا (بريد/هوية الجهاز) — لا تُصدَّق من العميل.
  // قاعدة fail-closed: أي خطأ في التحقق (تخزين متعثّر/غير مهيّأ) يُفضي إلى
  // رفض النشر لا إلى السماح به — فالسماح عند الشك يفتح باباً للمحظورين.
  try {
    const sub = await getSubscription(owner);
    if (sub && (sub.status === "suspended" || sub.status === "banned")) {
      return NextResponse.json(
        { error: sub.status === "banned" ? "banned" : "suspended" },
        { status: 403 }
      );
    }

    // ── فحص الحصص حسب الخطة (نموذج التسعير الجديد) ──
    // لا توجد خطة مجانية — يجب أن يكون هناك اشتراك (basic أو pro)
    if (!sub) {
      return NextResponse.json(
        { error: "quota_exceeded", reason: "يجب الاشتراك لنشر صفحات هبوط." },
        { status: 403 }
      );
    }

    // كل مالك له *صفحة واحدة* (سلاگ ثابت يُعاد استخدامه عند التحديث، وطلب
    // «رابط جديد» يحرق القديم قبل إنشاء غيره)، فالنشر يستبدل الصفحة في مكانها.
    // لذا تُقاس الحصة على الصفحة الجديدة نفسها: عدد منتجاتها وعدد صورها — لا
    // نراكمها فوق الصفحة القائمة. المراكمة (current + new) كانت تمنع *تحديث*
    // الصفحة: إعادة نشر نفس الصفحة تُحسب مرتين فيُحبَس المشترك الأساسي بعد أول
    // نشر. لا ثغرة هنا لأن المالك لا يملك أكثر من صفحة واحدة في أي لحظة.
    const newProductCount = products.length;
    if (newProductCount > sub.maxProducts) {
      return NextResponse.json(
        { error: "quota_exceeded", reason: `خطتك الحالية (${sub.plan}) تسمح بـ ${sub.maxProducts} منتج فقط. للمزيد رقِّ خطتك إلى Pro.` },
        { status: 403 }
      );
    }

    const newImages = countPageImages(products);
    if (newImages > sub.maxImages) {
      return NextResponse.json(
        { error: "quota_exceeded", reason: `خطتك الحالية (${sub.plan}) تسمح بـ ${sub.maxImages} صورة فقط. للمزيد رقِّ خطتك إلى Pro.` },
        { status: 403 }
      );
    }
  } catch {
    // تعذّر قراءة حالة الاشتراك — نرفض النشر احتياطياً (fail-closed).
    // هذا يمنع المحظور من إنتاج روابط جديدة حتى لو تعثّر التخزين.
    return NextResponse.json({ error: "banned" }, { status: 403 });
  }

  // ── الرابط الثابت لكل مالك ──
  // كل مالك (بريده) له سلاغ واحد ثابت: النشر يعيد الكتابة فوق نفس الرابط
  // (تحديث في المكان = رابط لا يتغيّر). طلب ?newLink=1 من الاستوديو يحرّق
  // الرابط القديم نهائياً ويولّد رابطاً جديداً للمالك.
  const wantNewLink = (searchParams.get("newLink") ?? "") === "1";
  let slug: string;
  try {
    slug = wantNewLink ? await rotateOwnerSlug(owner) : await resolveOwnerSlug(owner);
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
  // نثبّت السلاغ الخادمي على المنتج (نيتجهّل أي id أرسله العميل).
  (product as Product).id = slug;

  // توجيه الاحتياط: إن كان وضع الاحتياط مفعّلاً (اقتربنا من حد السعة) ننتج
  // صفحة HTML مستقلة ونرفعها على GitHub Pages بدل التخزين على Vercel — كي لا
  // نستهلك سعة/استدعاءات إضافية. الطلبات تشتغل لأننا نحقن webhook مباشراً.
  let fallbackMode = false;
  try {
    fallbackMode = Boolean(await getKv<boolean>("fallback_mode"));
  } catch {
    fallbackMode = false;
  }

  if (fallbackMode && hasGithubPages()) {
    try {
      const createdAt = new Date().toISOString();
      // حقن webhook مباشر نحو Apps Script كي تشتغل الطلبات على GitHub Pages.
      const webhook = await buildWebhook({
        sheetKey: (product as unknown as Record<string, unknown>).sheetKey as string | null,
        sheetEmail: (product as unknown as Record<string, unknown>).sheetEmail as string | null,
      });
      const html = await generateLandingHtml(
        product as Product,
        webhook ?? undefined,
        createdAt
      );
      const dep = await deployHtmlToGithubPages(slug, html);
      if (dep.ok && dep.url) {
        await setPublishedMeta(slug, {
          owner,
          createdAt,
          host: "github",
        });
        return NextResponse.json({ url: dep.url, slug, host: "github" });
      }
      // فشل الرفع على GitHub Pages → نسقط هادئاً إلى المسار العادي (Vercel/Supabase)
      console.error("[publish] فشل الرفع على GitHub Pages، السقوط لـ Vercel:", dep.error);
    } catch (err) {
      console.error("[publish] خطأ في مسار الاحتياط:", err);
    }
  }

  try {
    await setPublishedProduct(product as Product);
    await setPublishedMeta(slug, {
      owner,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[publish] فشل الحفظ في Blob:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/p/${slug}`, slug, host: "vercel" });
}

// منشور واحد عام (?slug=) أو قائمة خاصة للمالك (?fingerprint=).
// دون fingerprint: قائمة فارغة — لا تسريب.
export async function GET(request: Request) {
  if (!hasPublishStore()) return configResponse();

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();

  try {
    if (slug) {
      const product = await getPublishedProduct(slug);
      if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ product });
    }

    if (!fingerprint || fingerprint.length < 8) {
      return NextResponse.json({ products: [] });
    }

    const owner = await resolveOwner(fingerprint);
    const entries = await listPublishedOwned(owner);
    const origin = new URL(request.url).origin;
    return NextResponse.json({
      products: entries.map(({ slug: s, product }) => ({
        id: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        url: `${origin}/p/${s}`,
      })),
    });
  } catch (err) {
    console.error("[publish] فشل قراءة المنشورات:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// إلغاء نشر عبر ?slug= — لا يُحذف إلا إذا كان المتصل مالك الصفحة
export async function DELETE(request: Request) {
  if (!hasPublishStore()) return configResponse();

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  try {
    const owner = await resolveOwner(fingerprint);
    const publishedOwner = await getPublishedOwner(slug);
    if (!publishedOwner || publishedOwner !== owner) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const deleted = await deletePublishedProduct(slug);
    // حذف الرابط كلياً = تحرير ربط السلاغ الثابت للمالك، كي ينشئ رابطاً
    // جديداً عند نشره القادم (الرابط القديم يُحرق ولا يعود صالحاً).
    try {
      const bound = await getKv<string>(ownerSlugKey(owner));
      if (bound === slug) await deleteKv(ownerSlugKey(owner));
    } catch {
      // تجاهل فشل تحرير الربط — الحذف نفسه تم
    }
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("[publish] فشل إلغاء النشر:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
