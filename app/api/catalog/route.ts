import { NextResponse } from "next/server";
import { listKv } from "@/app/lib/kvStore";
import { getPublishedProduct, type PublishMeta } from "@/app/lib/publishStore";
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

// ⚡ تخزين ذاكرة قصير (60 ثانية — نفس عقد حداثة الإنتاج s-maxage=60 حرفياً):
// محلياً لا توجد حافة Vercel تمتص الثقل، فكان كل تنقل للرئيسية يدفع 8 ثوانٍ
// كاملة (نقل ~400KB صور base64 عبر رابط بطيء). أول زيارة تبني البطاقات،
// وتنقلات الدقيقة التالية تُخدَم فورياً من الذاكرة. البيانات والفلاتر نفسها
// تماماً، والحداثة القصوى 60 ثانية مطابقة للإنتاج. فحص الحظر في /p/[slug]
// منفصل وفوري ولا يمر من هنا إطلاقاً.
const CACHE_TTL_MS = 60_000;
let cacheAt = 0;
let cacheData: Array<Record<string, unknown>> | null = null;

async function buildCards(): Promise<Array<Record<string, unknown>>> {
  // ⚡ تحسين الأداء (بلا أي تغيير في السلوك/الفلاتر): كان البناء يجري
  // استعلاماً منفصلاً لكل منتج (N رحلة شبكة لجلب الميتا) ثم يفحص اشتراك
  // كل مالك **بالتسلسل** (انتظار كامل قبل التالي) — وهذا ما جعل الرئيسية
  // ثقيلة (ثوانٍ في كل زيارة بلا تخزين حدّي محلياً). الآن:
  //  1. استعلام واحد يجلب كل ملفات الميتا الخفيفة (< 0.2KB لكل متجر).
  //  2. فحص أهلية الملاك المميزين بشكل متوازٍ (نفس الدالة والنتائج تماماً).
  // مجموعة البطاقات الناتجة وترتيبها وقواعد الإدراج مطابقة للسابق حرفياً.
  const metaRows = await listKv(KV_PREFIXES.PUBLISHED_META);

  // المرحلة 1: تصفية بالميتا الخفيفة فقط (بلا تحميل أي منتج ثقيل)
  const candidates: Array<{ slug: string; owner: string }> = [];
  for (const row of metaRows) {
    const meta = row.value as PublishMeta | null;
    if (!meta || typeof meta.owner !== "string") continue; // بلا مالك صالح
    if (meta.listed !== true) continue; // غير مُدرَج (خاص)
    if (meta.banned) continue; // محروق بالحظر
    if (meta.hidden) continue; // مخفي إشرافياً من المتجر
    const slug = row.key.slice(KV_PREFIXES.PUBLISHED_META.length).replace(/\.json$/, "");
    if (!slug) continue;
    candidates.push({ slug, owner: meta.owner });
  }

  const ownerEligible = new Map<string, boolean>();
  const owners = Array.from(new Set(candidates.map((c) => c.owner)));
  const subs = await Promise.all(owners.map((o) => recomputeStatus(o)));
  for (let i = 0; i < owners.length; i++) {
    const sub = subs[i];
    ownerEligible.set(
      owners[i],
      Boolean(sub && sub.status === "active" && (sub.plan === "pro" || sub.plan === "gold"))
    );
  }
  const eligible = candidates
    .filter((c) => ownerEligible.get(c.owner))
    .map((c) => c.slug);

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
      category: product.category ?? null,
      ownerDisplayName: product.ownerDisplayName ?? null, // باذن صاحبه فقط
    });
  }
  return cards;
}

export async function GET() {
  try {
    let products = cacheData;
    if (!products || Date.now() - cacheAt > CACHE_TTL_MS) {
      products = await buildCards();
      cacheData = products;
      cacheAt = Date.now();
    }
    const res = NextResponse.json({ products });
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
