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
import { getSubscription } from "@/app/lib/subsStore";

export const dynamic = "force-dynamic";

// حد أقصى لحجم جسم الطلب — صور data:URL قد تجعل الصفحة كبيرة جدًا
const MAX_BODY_BYTES = 800_000;

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
  } catch {
    // تعذّر قراءة حالة الاشتراك — نرفض النشر احتياطياً (fail-closed).
    // هذا يمنع المحظور من إنتاج روابط جديدة حتى لو تعثّر التخزين.
    return NextResponse.json({ error: "banned" }, { status: 403 });
  }

  try {
    await setPublishedProduct(product);
    await setPublishedMeta(product.id, {
      owner,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[publish] فشل الحفظ في Blob:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/p/${product.id}`, slug: product.id });
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
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("[publish] فشل إلغاء النشر:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
