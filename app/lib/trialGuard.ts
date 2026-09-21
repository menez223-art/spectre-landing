// حارس شروط التجربة المجانية — server only
//
// القاعدة الملزمة (المالك): لا رابط تجريبي إلا إذا كان **الإيميل جديداً**
// و**الجهاز جديداً** و**الرقم جديداً**. «جديد» تعني: لا ينتمي إلى مشترك
// حقيقي ولا استُعمل في تجربة سابقة. غياب طرف واحد ⇒ لا رابط.
//
// ⚠️ الثقب الذي أُغلق هنا (بلاغ المالك 2026-09-21):
//   مسار /api/trial/create كان يفحص الإيميل مقابل `subs/` فقط، ولا يفحص
//   **رقم الواتساب** ولا **الجهاز** مقابل بيانات المشتركين إطلاقاً. فزائر
//   بإيميل جديد وجهاز جديد و**رقم مشترك حقيقي** كان يحصل على الرابط التجريبي.
//
// ⚠️ الثقب الثاني (بلاغ المالك — نفس الجلسة): استثناء جلسة الأدمن كان يُسقط
//   الفحص كلياً من متصفح المالك (كوكي الجلسة يُرسَل تلقائياً)، فصدر رابط
//   تجريبي برقم مشترك (`213658123545`) رغم وجوده في 6 مصادر حارسة.
//   **أُزيل الاستثناء نهائياً** — القاعدة مطلقة بلا استثناء، والاختبار يكون
//   من متصفح جديد بهويات جديدة كأي زائر.
//
// مصادر «المشترك» المعتمدة (كلها تُقرأ ولا تُكتب):
//   • subs/<userId>.json                      — صف الاشتراك الكنسي
//   • studio-auth/profiles/*.json             — ملف الجهاز (بريد مربوط/جدول)
//   • studio-auth/marketing/<email>.json      — الرقم التسويقي الكنسي للبريد
//   • published/*.json + published-meta/*     — رقم المنتج المنشور (ما عدا صفحات التجربة)
//
// لا يلمس هذا الملف نظام الحظر/السماح ولا يكتب أي شيء في KV.

import { listKv } from "./kvStore";
import { type DeviceProfile } from "./profileStore";
import { pepperFingerprint } from "./utils/security";
import { normalizeWhatsapp } from "./trialStore";
import type { Subscription } from "./subsStore";
import type { Product } from "./types";
import type { PublishMeta } from "./publishStore";

if (typeof window !== "undefined") {
  throw new Error("trialGuard.ts is server-only");
}

export type SubscriberConflict = "email" | "whatsapp" | "device";

export interface TrialIdentity {
  email: string;
  whatsapp: string;
  deviceFp: string;
}

const SUB_PREFIX = "subs/";
const PROFILES_PREFIX = "studio-auth/profiles/";
const MARKETING_PREFIX = "studio-auth/marketing/";
const PUBLISHED_PREFIX = "published/";
const PUBLISHED_META_PREFIX = "published-meta/";

interface Snapshot {
  subs: Subscription[];
  profiles: DeviceProfile[];
  marketing: { email?: string; whatsapp?: string | null }[];
  products: { product: Product | null; meta: PublishMeta | null }[];
}

/**
 * قراءة لقطة واحدة من كل المصادر الخمسة بالتوازي.
 * ⚠️ **فشل صريح (fail-closed)**: خطأ التخزين لا يعني «لا مشترك» — نرمي ليُترجم
 * المسار إلى 502 «حاول بعد قليل». التساهل هنا يُعيد فتح الثقب بصمت عند أي
 * تعثّر عابر في القاعدة، وهو بالضبط ما جاء هذا الحارس لمنعه.
 */
async function readSnapshot(): Promise<Snapshot> {
  const [subRows, profileRows, marketingRows, productRows, metaRows] = await Promise.all([
    listKv(SUB_PREFIX),
    listKv(PROFILES_PREFIX),
    listKv(MARKETING_PREFIX),
    listKv(PUBLISHED_PREFIX),
    listKv(PUBLISHED_META_PREFIX),
  ]);
  const metaBySlug = new Map<string, PublishMeta>();
  for (const row of metaRows) {
    const meta = row.value as PublishMeta | null;
    const slug = row.key.slice(PUBLISHED_META_PREFIX.length).replace(/\.json$/, "");
    if (meta) metaBySlug.set(slug, meta);
  }
  return {
    subs: subRows.map((r) => r.value as Subscription).filter((s) => Boolean(s) && typeof s?.userId === "string"),
    profiles: profileRows.map((r) => r.value as DeviceProfile).filter((p) => Boolean(p) && typeof p?.fingerprint === "string"),
    marketing: marketingRows.map((r) => r.value as { email?: string; whatsapp?: string | null }).filter(Boolean),
    products: productRows.map((r) => {
      const slug = r.key.slice(PUBLISHED_PREFIX.length).replace(/\.json$/, "");
      return { product: (r.value as Product) ?? null, meta: metaBySlug.get(slug) ?? null };
    }),
  };
}

/**
 * هل هذا الإيميل مشترك/حساب استوديو فعلاً؟
 * ثلاثة مصادر مستقلة: صف الاشتراك · ملف تعريف مربوط بالبريد · مالك صفحة منشورة
 * (غير صفحة تجربة). الأول وحده كان لا يكفي: الإنتاج فيه ملفات تعريف مربوطة
 * ببريد بلا صف اشتراك مطابق.
 */
function emailConflicts(snap: Snapshot, email: string): boolean {
  const lower = email.toLowerCase();
  if (snap.subs.some((s) => s.userId.toLowerCase() === lower)) return true;
  if (snap.profiles.some((p) => p.email?.toLowerCase() === lower)) return true;
  return snap.products.some(
    (row) => !row.meta?.trialUntil && row.meta?.owner?.toLowerCase() === lower
  );
}

/**
 * هل هذا الرقم رقم مشترك؟ يُقارَن بعد التطبيع الكنسي حتى تلتقي الصيغ
 * المختلفة لنفس الرقم (`0658123545` = `213658123545`).
 */
function whatsappConflicts(snap: Snapshot, whatsapp: string): boolean {
  const wa = normalizeWhatsapp(whatsapp);
  if (!wa) return false;
  const same = (raw: unknown) => {
    const other = normalizeWhatsapp(String(raw ?? ""));
    return other !== "" && other === wa;
  };
  if (snap.marketing.some((m) => same(m.whatsapp))) return true;
  if (snap.profiles.some((p) => same(p.whatsapp))) return true;
  return snap.products.some(
    (row) => !row.meta?.trialUntil && same(row.product?.whatsapp)
  );
}

/**
 * هل هذا الجهاز جهاز مشترك؟ الجهاز يُعرَّف بالبصمة المُعدَّلة بالـ pepper.
 * العلامة الفاصلة: ملف تعريف له **حساب** (بريد مربوط أو جدول مُهيَّأ) أو صف
 * اشتراك بهوية الجهاز. مجرّد محاولة دخول للاستوديو (سجل studio-auth/devices)
 * لا تكفي — كي لا نحجب زائراً لم يكن مشتركاً قط.
 */
function deviceConflicts(snap: Snapshot, deviceFp: string): boolean {
  if (!deviceFp) return false;
  let peppered: string;
  try {
    peppered = pepperFingerprint(deviceFp);
  } catch {
    return false; // غياب DEVICE_PEPPER لا يُحجب عليه — الفشل هنا ليس دليل اشتراك
  }
  if (snap.profiles.some((p) => p.fingerprint === peppered && Boolean(p.email || p.sheetUrl))) return true;
  const deviceOwner = `device:${peppered.slice(0, 24)}`;
  return snap.subs.some((s) => s.userId === deviceOwner || s.userId === `device:${peppered}`);
}

/**
 * يفحص الأطراف الثلاثة ويعيد أول تعارض، أو null إن كانت الهوية جديدة تماماً.
 * ترتيب الفحص مقصود: الإيميل ← الرقم ← الجهاز (ترتيب الأسهل تصحيحاً للزائر).
 */
export async function findSubscriberConflict(id: TrialIdentity): Promise<SubscriberConflict | null> {
  const snap = await readSnapshot();
  if (emailConflicts(snap, id.email)) return "email";
  if (whatsappConflicts(snap, id.whatsapp)) return "whatsapp";
  if (deviceConflicts(snap, id.deviceFp)) return "device";
  return null;
}
