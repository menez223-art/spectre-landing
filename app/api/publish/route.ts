import { NextResponse } from "next/server";
import type { Product } from "@/app/lib/types";
import {
  deletePublishedProduct,
  getPublishedProduct,
  getPublishedMeta,
  hasPublishStore,
  listPublishedOwned,
  setPublishedMeta,
  setPublishedProduct,
  getPublishedOwner,
  type PublishMeta,
} from "@/app/lib/publishStore";
import { getDeviceOwner, isDeviceApprovedOnly, isDeviceBanned } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getSubscription, PLAN_QUOTAS, type Plan } from "@/app/lib/subsStore";
import { getKv, setKv } from "@/app/lib/kvStore";
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
const MAX_BODY_BYTES = 3_800_000; // ≈ 3.8 ميغابايت — يتّسع لصفحة Gold بـ 10 صور مضغوطة دون سقف Vercel (~4.5MB)

// يولّد سلاغاً جديداً فريداً (10 أحرف base36) لصفحة هبوط.
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

// عدّ الصفحات الفعّالة للمالك (المحروقة لا تُحسب — ليست متاحة للزوار).
async function countOwnedPages(owner: string): Promise<number> {
  try {
    const entries = await listPublishedOwned(owner);
    let count = 0;
    for (const _ of entries) count++;
    return count;
  } catch {
    return 0;
  }
}

// فحص ملكية السلاغ: هل ينتمي فعلاً لهذا المالك؟
// ملاحظة حرجة: resolveOwner يُعيد البريد المربوط بعد ربطه، لكن المنشور القديم
// قد يحوي `meta.owner = device:<hash>` (نُشر قبل ربط البريد). لتفادي خسارة
// صفحات المستخدم بسبب الربط، نقبل التحديث في هذه الحالة — owner الحالي سيُعاد
// إسناده عبر `reassignOwner` تلقائياً في حساب الاستوديو، فلا حاجة لفرضه هنا.
async function isOwnedBy(slug: string, owner: string): Promise<boolean> {
  try {
    const publishedOwner = await getPublishedOwner(slug);
    if (!publishedOwner) return false;
    if (publishedOwner === owner) return true;
    // منشور قديماً بهوية جهاز، والمالك الآن بريد: نقبل التحديث ونعتمد إعادة
    // الإسناد التلقائي في account/route عند فتح الاستوديو.
    if (!owner.startsWith("device:") && publishedOwner.startsWith("device:")) return true;
    return false;
  } catch {
    return false;
  }
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

  // اختيار العميل لإدراج صفحته في المتجر العام (Pro/Gold فقط — يُفرض خادمياً أدناه).
  const wantListPublic = (searchParams.get("listPublic") ?? "") === "1";
  let listed = false;
  // سلاغ الصفحة المُحدَّد لاحقاً (إما editingId أو سلاغ جديد).
  let slug = "";

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

    // إدراج المتجر العام حصري لـ Pro/Gold — basic يُجبَر على «خاص» مهما طلب.
    listed = (sub.plan === "pro" || sub.plan === "gold") && wantListPublic;

    // كل صفحة = سلاغ مستقل. النشر = إنشاء صفحة جديدة (ما عدا التحديث على نفس السلاغ).
    // التحديث على نفس الرابط (editingId يملكه المالك) مجاني ولا يستهلك الحصة.
    // إنشاء صفحة جديدة يستلزم التحقق من maxPages.
    const editingId = (searchParams.get("editingId") ?? "").trim();
    let isUpdate = false;
    if (editingId && (await isOwnedBy(editingId, owner))) {
      // تحديث على نفس الرابط — مجاني ولا يستهلك الحصة.
      slug = editingId;
      isUpdate = true;
    } else {
      // إنشاء صفحة جديدة — يجب ألّا يتجاوز المستخدم maxPages.
      const currentPages = await countOwnedPages(owner);
      const maxPages = sub.maxPages ?? 1;
      if (currentPages >= maxPages) {
        return NextResponse.json(
          {
            error: "max_pages_reached",
            field: "pages",
            current: currentPages,
            max: maxPages,
            reason: `لقد وصلت للحد الأقصى من الصفحات (${maxPages}). احذف صفحة قديمة أو رقِّ خطتك إلى Pro/Gold.`,
          },
          { status: 403 }
        );
      }
      const fresh = await generateSlug();
      // ضمان أن السلاغ المُولَّد لا يصطدم بسلاغ يملكه شخص آخر (احتمال ضئيل).
      const collision = await getPublishedProduct(fresh);
      if (collision) {
        return NextResponse.json({ error: "storage" }, { status: 502 });
      }
      slug = fresh;
    }

    // فحص عدد المنتجات في الصفحة (per-page).
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

  // نثبّت السلاغ الخادمي على المنتج (نتجاهل أي id أرسله العميل).
  (product as Product).id = slug;

  // ── دمج الميتا القائمة قبل الكتابة (حماية إشرافية) ──
  // إعادة النشر كانت تمسح الميتا من الصفر فتُسقط علمَي hidden (الإخفاء
  // الإشرافي للمتجر) وbanned (الحرق المباشر) — فيعود المخفي ظاهراً
  // بمجرد ضغطة «تحديث الرابط». الدمج يحفظ الحقلين، مع فرض الحقول
  // المشروعة للمالك (owner/createdAt/listed/host) فوقها.
  let prevMeta: Awaited<ReturnType<typeof getPublishedMeta>> = null;
  try {
    prevMeta = await getPublishedMeta(slug);
  } catch {
    prevMeta = null;
  }
  const mergedBase: PublishMeta = {
    ...(prevMeta ?? {}),
    owner,
    createdAt: new Date().toISOString(),
    listed,
  };

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
        sheetKey: product.sheetKey ?? null,
        sheetEmail: product.sheetEmail ?? null,
      });
      const html = await generateLandingHtml(
        product as Product,
        webhook ?? undefined,
        createdAt
      );
      const dep = await deployHtmlToGithubPages(slug, html);
      if (dep.ok && dep.url && dep.served) {
        await setPublishedMeta(slug, {
          ...mergedBase,
          host: "github",
        });
        return NextResponse.json({ url: dep.url, slug, host: "github" });
      }
      // فشل الرفع، أو رُفع الملف لكن Pages لم يجهز بعد (served=false) → لا نحوّل
      // الزائر إلى صفحة قد تردّ 404 أثناء بناء Pages؛ نسقط هادئاً إلى المسار
      // العادي (Vercel/Supabase) فتعمل الصفحة فوراً، وتُلتقط لاحقاً عند تشغيلة
      // جاهزة (نشر لاحق أو فحص المراقبة) بعد اكتمال البناء.
      console.error("[publish] لم يُؤكَّد نشر GitHub Pages (ok=%s served=%s)، السقوط لـ Vercel:", dep.ok, dep.served, dep.error ?? "");
    } catch (err) {
      console.error("[publish] خطأ في مسار الاحتياط:", err);
    }
  }

  try {
    await setPublishedProduct(product as Product);
    await setPublishedMeta(slug, {
      ...mergedBase,
      host: "vercel",
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
      // المنشور المحروق (banned) لا يُخدَم عبر الـAPI — الصفحة تحجبه للزوار
      // والباب الخام هنا كان يكشف محتواه كاملاً. رفض 404 نفسه كي لا يؤكد
      // وجوده أصلاً.
      try {
        const meta = await getPublishedMeta(slug);
        if (meta?.banned) return NextResponse.json({ error: "not_found" }, { status: 404 });
        // تجربة Agent منتهية وغير محوَّلة → الرابط ميت هنا أيضاً (404)
        if (meta?.trialUntil && Date.now() > new Date(meta.trialUntil).getTime()) {
          return NextResponse.json({ error: "not_found" }, { status: 404 });
        }
      } catch {
        // فشل قراءة الميتا لا يجب أن يحجب مالكاً شرعياً عن محرّره
      }
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
    // في نموذج متعدد الصفحات، حذف صفحة واحدة لا يحرر شيئاً إضافياً —
    // المالك يحتفظ بباقي صفحاته في KV ويمكنه نشر صفحة جديدة لتحلّ محلّها.
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("[publish] فشل إلغاء النشر:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
