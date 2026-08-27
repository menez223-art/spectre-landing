import { NextResponse } from "next/server";
import { listKvKeys } from "@/app/lib/kvStore";
import { getPublishedProduct, getPublishedMeta } from "@/app/lib/publishStore";
import { recomputeStatus } from "@/app/lib/subsStore";
import { KV_PREFIXES } from "@/app/lib/utils/constants";

// المتجر العام على الرئيسية — GET عام (لا مصادقة).
// يعيد فقط الصفحات التي:
//  - فعّل مالكها الإدراج (meta.listed === true)، و
//  - ليست محروقة بالحظر (meta.banned)، و
//  - ليست مخفاة إشرافياً من المتجر (meta.hidden)، و
//  - اشتراك مالكها نشط ضمن خطة مدفوعة (pro/gold).
// أي تخفيض للخطة أو انتهاء صلاحية أو حظر يُسقط المنتج تلقائياً من المتجر.
//
// ⚡ نمط التوسّع (حرج لبيع الاشتراكات على الخطط المجانية): كانت النسخة السابقة
// تسحب من Supabase محتوى كل المتاجر المنشورة جميعاً — بالصور base64 الثقيلة —
// في كل زيارة للرئيسية حتى غير المُدرجة منها! الآن: نقرأ المفاتيح فقط،
// نصفّي بالميتا الخفيفة (< 0.2KB لكل متجر)، ثم نجلب المنتجات المُدرَجة المؤهلة
// حصراً. كلفة الرئيسية صارت تتناسب مع عدد المُدرَج لا مع حجم المنصة كلها.
//
// التخزين الحدّي: المسار ديناميكي (استعلامات no-store)، لكن نطلب من حافة
// Vercel تخزين الاستجابة 60 ثانية مع stale-while-revalidate — كل زوار
// الدقيقة الواحدة يشاركون استجابة واحدة، فتنهار كلفة الاستدعاءات والخروج
// تقريباً إلى الصفر مهما بلغ ضغط الزيارات. حداثة 60 ثانية مقبولة لواجهة عرض.
export const dynamic = "force-dynamic";

async function buildCards(): Promise<Array<Record<string, unknown>>> {
  const keys = await listKvKeys(KV_PREFIXES.PUBLISHED);
  const slugs = keys
    .map((k) => k.slice(KV_PREFIXES.PUBLISHED.length).replace(/\.json$/, ""))
    .filter(Boolean);

  // المرحلة 1: تصفية بالميتا الخفيفة فقط (بلا تحميل أي منتج ثقيل)
  const metas = await Promise.all(slugs.map((s) => getPublishedMeta(s)));
  const ownerEligible = new Map<string, boolean>();
  const eligible: string[] = [];
  for (let i = 0; i < slugs.length; i++) {
    const meta = metas[i];
    if (!meta) continue;
    if (meta.listed !== true) continue; // غير مُدرَج (خاص)
    if (meta.banned) continue; // محروق بالحظر
    if (meta.hidden) continue; // مخفي إشرافياً من المتجر

    const owner = meta.owner;
    let isEligible = ownerEligible.get(owner);
    if (isEligible === undefined) {
      const sub = await recomputeStatus(owner);
      isEligible = Boolean(
        sub && sub.status === "active" && (sub.plan === "pro" || sub.plan === "gold")
      );
      ownerEligible.set(owner, isEligible);
    }
    if (isEligible) eligible.push(slugs[i]);
  }

  // المرحلة 2: جلب المنتجات المُدرَجة المؤهلة حصراً
  const products = await Promise.all(eligible.map((s) => getPublishedProduct(s)));

  const cards: Array<Record<string, unknown>> = [];
  for (const product of products) {
    if (!product) continue;
    // حقول بطاقة عامة فقط — لا تسريب لأي بيانات ملكية/اشتراك.
    cards.push({
      id: product.id,
      name: product.name,
      image: product.image ?? null,
      price: product.price,
      oldPrice: product.oldPrice ?? null,
      badge: product.badge ?? null,
      eyebrow: product.eyebrow ?? null,
      ownerDisplayName: product.ownerDisplayName ?? null, // باذن صاحبه فقط
    });
  }
  return cards;
}

export async function GET() {
  try {
    const res = NextResponse.json({ products: await buildCards() });
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    return res;
  } catch (err) {
    console.error("[catalog] فشل بناء المتجر العام:", err);
    return NextResponse.json({ products: [] });
  }
}
