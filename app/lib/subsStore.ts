// تخزين الاشتراكات في Supabase Postgres — server only
// يدير حالة اشتراك كل مستخدم: الخطة، الحالة (نشط/موقوف/محظور/منتهٍ)، وتاريخ الانتهاء.
// كل الحسابات تُحسب خادميًا — لا تُصدَّق من العميل أبدًا.

import { deleteKv, getKv, listKv, setKv } from "./kvStore";
import { KV_PREFIXES } from "./utils/constants";
import { nowISO } from "./utils/date";

if (typeof window !== "undefined") {
  throw new Error("subsStore.ts is server-only");
}

const SUB_PREFIX = KV_PREFIXES.SUBSCRIPTIONS;

export type Plan = "basic" | "pro" | "gold";
export type SubStatus = "active" | "suspended" | "banned" | "expired";
export type ValidityUnit = "day" | "always" | null;

// حدود كل خطة (نموذج التسعير الجديد 2026-08-17)
export const PLAN_QUOTAS: Record<Plan, { maxProducts: number; maxImages: number }> = {
  basic: { maxProducts: 1, maxImages: 2 },          // 2000 د.ج — منتج واحد، صورتان
  pro: { maxProducts: 5, maxImages: 5 },            // 4000 د.ج — 5 منتجات، 5 صور إجمالاً
  gold: { maxProducts: 10, maxImages: 10 },         // 6000 د.ج — 10 منتجات، 10 صور إجمالاً
};

export interface Subscription {
  userId: string; // البريد المربوط أو "device:<hash>"
  plan: Plan;
  status: SubStatus;
  startsAt: string;
  expiresAt: string | null; // null = غير منتهٍ
  reason: string | null; // سبب الحظر/التوقيف
  updatedAt: string;
  // مدة الصلاحية — يديرها الأدمن (تمديد/تثبيت دائم/انتهاء تلقائي)
  validityUnit: ValidityUnit; // "day" | "always" | null
  validityDays: number | null; // عدد الأيام (للوحدة day)
  validityStartsAt: string | null; // بداية نافذة الصلاحية الحالية
  validityExpiresAt: string | null; // تاريخ انتهاء الصلاحية المطلق (يُحسب عند التحديد)
  // إشعار للعميل من الأدمن (مثلاً «حدّث رابطك») — يُعرض كلفتة داخل
  // الاستوديو. هذا حقل بيانات إضافي لا علاقة له بنظام الحظر/السماح.
  notice?: string | null;
  // حدود النشر حسب الخطة
  maxProducts: number;
  maxImages: number;
}

function subKey(userId: string): string {
  return `${SUB_PREFIX}${userId}.json`;
}

export function hasSubsStore(): boolean {
  return true;
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  try {
    const sub = await getKv<Subscription>(subKey(userId));
    if (!sub || typeof sub.userId !== "string") return null;
    // إعادة حساب "منتهٍ" تلقائيًا عند القراءة إن وُجد تاريخ انتهاء ماضٍ
    if (sub.status === "active" && sub.expiresAt && new Date(sub.expiresAt).getTime() < Date.now()) {
      const expired: Subscription = { ...sub, status: "expired", updatedAt: new Date().toISOString() };
      await setKv(subKey(userId), expired);
      return expired;
    }
    return sub;
  } catch {
    return null;
  }
}

// إنشاء/تحديث اشتراك — يُستخدم من لوحة المشرف فقط (مصرّح الخادم).
export async function setSubscription(sub: Subscription): Promise<void> {
  // ضمان وجود حقول الحصص بناءً على الخطة إن لم تكن مضبوطة
  const quota = PLAN_QUOTAS[sub.plan] ?? PLAN_QUOTAS.basic;
  const withQuota: Subscription = {
    ...sub,
    maxProducts: sub.maxProducts ?? quota.maxProducts,
    maxImages: sub.maxImages ?? quota.maxImages,
    updatedAt: nowISO(),
  };
  await setKv(subKey(sub.userId), withQuota);
}

export async function deleteSubscription(userId: string): Promise<void> {
  await deleteKv(subKey(userId));
}

// يضمن وجود صف اشتراك للمستخدم — إن لم يوجد أنشأ صفًا أساسياً نشطاً (لكي يظهر في لوحة الأدمن).
// لا خطة مجانية — الخطة الأساسية (basic) هي الافتراضية.
export async function ensureSubscription(userId: string): Promise<Subscription> {
  const existing = await getSubscription(userId);
  if (existing) return existing;
  const now = nowISO();
  const basicQuota = PLAN_QUOTAS.basic;
  const sub: Subscription = {
    userId,
    plan: "basic",
    status: "active",
    startsAt: now,
    expiresAt: null,
    reason: null,
    updatedAt: now,
    validityUnit: null,
    validityDays: null,
    validityStartsAt: null,
    validityExpiresAt: null,
    notice: null,
    maxProducts: basicQuota.maxProducts,
    maxImages: basicQuota.maxImages,
  };
  await setSubscription(sub);
  return sub;
}

// يوحّد هوية اشتراك المستخدم: إن وُجد البريد المربوط نجعله المفتاح الكنسي
// وننقل أي صف موجود تحت هوية الجهاز (device:…) إليه، كي يقرأ المستخدم والزائر
// والأدمن نفس صف الاشتراك تماماً — دون تفاوت بين مفتاحي الجهاز والبريد.
// هذا هو الحل الجذري لتطابق الحظر وعدّاد الأيام بين الأدمن والعميل.
export async function reconcileSubscription(
  email: string | null,
  deviceOwner: string
): Promise<void> {
  const canonical = email || deviceOwner;
  const other = email ? deviceOwner : null;
  if (!other) {
    // لا بريد → نضمن وجود صف تحت هوية الجهاز
    await ensureSubscription(canonical);
    return;
  }
  const otherSub = await getSubscription(other);
  const canonSub = await getSubscription(canonical);
  if (otherSub && !canonSub) {
    // نقل صف الجهاز إلى البريد الكنسي
    await migrateSubscription(other, canonical);
  } else if (otherSub && canonSub) {
    // وجود مزدوج → نحتفظ بالبريد ونمسح مكرّر الجهاز
    await deleteSubscription(other);
  } else if (!otherSub && !canonSub) {
    await ensureSubscription(canonical);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// يعيد حساب "منتهٍ" و"موقوف تلقائياً بسبب انتهاء الصلاحية" عند القراءة.
// - إن كانت الصلاحية (day) قد انتهت تاريخها وتجاوزنا window نعيد status=suspended
//   (توقيف مؤقت دون حذف) مع reason يوضّح انتهاء الصلاحية. الحالة الأصلية تُحفظ
//   في originalStatus كي يعود الأدمن يفعّلها عند التجديد.
// - إن كانت الصلاحية "always" فلا تنتهي أبداً.
export async function recomputeStatus(userId: string): Promise<Subscription | null> {
  const sub = await getSubscription(userId);
  if (!sub) return null;

  // الحظر/الحذف يدويان يبقيان كما هما (لا تداخل مع منطق الصلاحية)
  if (sub.status === "banned") return sub;

  // اشتراك منتهٍ (expired) عبر الحقل القديم expiresAt أو عبر انتهاء الصلاحية:
  // نوحّده إلى suspended كي تُحبَس روابطه فوراً في /p/[slug] (الذي يمنع
  // suspended وليس expired). هذا يسدّ فجوة كانت تبقي الروابط شغّالة
  // بعد انتهاء الاشتراك — كما طلب المستخدم (توقّف تلقائي + حبس الروابط).
  if (sub.status === "expired") {
    const suspended: Subscription = {
      ...sub,
      status: "suspended",
      reason: (sub.reason ?? "") || "انتهت صلاحية الاشتراك — توقيف تلقائي.",
      updatedAt: new Date().toISOString(),
    };
    await setKv(subKey(userId), suspended);
    return suspended;
  }

  const now = Date.now();
  const ve = sub.validityExpiresAt ? new Date(sub.validityExpiresAt).getTime() : null;

  // لا صلاحية محددة (null) أو دائمة → نشط
  if (sub.validityUnit == null || sub.validityUnit === "always" || ve == null) {
    if (sub.status === "active") return sub;
    return sub; // الحالات الأخرى (suspended يدوي) تبقى كما هي
  }

  const expiredByValidity = ve < now;
  if (expiredByValidity) {
    if (sub.status !== "suspended") {
      const suspended: Subscription = {
        ...sub,
        status: "suspended",
        reason: "انتهت صلاحية الاشتراك — توقيف تلقائي.",
        updatedAt: new Date().toISOString(),
      };
      await setKv(subKey(userId), suspended);
      return suspended;
    }
    return sub;
  }

  return sub;
}

// يحسب المدة المتبقية بالأيام (تقريب لأعلى) أو null إن لا صلاحية/دائمة.
// نستخدم التقريب لأعلى كي يقرأ المستخدم "1 يوم" طوال اليوم الأول
// (لا يهبط إلى 0 بمجرد انقضاء جزء من اليوم).
export function remainingDays(sub: Subscription): number | null {
  if (sub.validityUnit == null || sub.validityUnit === "always") return null;
  const ve = sub.validityExpiresAt ? new Date(sub.validityExpiresAt).getTime() : null;
  if (ve == null) return null;
  const diff = ve - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

// يضبط الصلاحية: unit="day" مع days>0 يحدّد نافذة من startsAt (الآن افتراضياً)،
// unit="always" يثبّت دائماً، unit=null يلغي الصلاحية. يُعيد صف الاشتراك المحدّث.
export async function setValidity(
  userId: string,
  unit: ValidityUnit,
  days: number | null,
  startsAt: string | null = null
): Promise<Subscription | null> {
  const sub = await getSubscription(userId);
  if (!sub) return null;

  const now = new Date().toISOString();
  const base = startsAt ?? now;

  let validityStartsAt: string | null = null;
  let validityExpiresAt: string | null = null;
  let validityDays: number | null = null;

  if (unit === "day" && days && days > 0) {
    validityStartsAt = base;
    validityDays = days;
    validityExpiresAt = new Date(new Date(base).getTime() + days * DAY_MS).toISOString();
  } else if (unit === "always") {
    validityStartsAt = base;
    validityDays = null;
    validityExpiresAt = null;
  } else {
    validityStartsAt = null;
    validityDays = null;
    validityExpiresAt = null;
  }

  const updated: Subscription = {
    ...sub,
    validityUnit: unit,
    validityDays,
    validityStartsAt,
    validityExpiresAt,
    updatedAt: now,
  };

  // إن كانت الصلاحية انتهت سابقاً وأعدنا ضبطها بنافذة صالحة → نفعّلها تلقائياً.
  if (unit === "always" || (unit === "day" && validityExpiresAt && new Date(validityExpiresAt).getTime() > Date.now())) {
    if (sub.status === "suspended" && (sub.reason ?? "").includes("انتهت صلاحية")) {
      updated.status = "active";
      updated.reason = null;
    }
  }

  await setKv(subKey(userId), updated);
  return updated;
}

// ينقل صف اشتراك من هوية الجهاز إلى البريد المربوط عند ربط البريد،
// كي لا يظهر المستخدم مرتين (مرّة بـ device:… ومرّة بالبريد).
export async function migrateSubscription(fromUserId: string, toUserId: string): Promise<void> {
  const from = await getSubscription(fromUserId);
  if (!from) return;
  const to = await getSubscription(toUserId);
  if (to) {
    await deleteSubscription(fromUserId); // البريد له صف أصلاً — احذف المكرّر
    return;
  }
  // الحفاظ على حقول الحصص عند الهجرة
  const quota = PLAN_QUOTAS[from.plan] ?? PLAN_QUOTAS.basic;
  const migrated: Subscription = {
    ...from,
    userId: toUserId,
    maxProducts: from.maxProducts ?? quota.maxProducts,
    maxImages: from.maxImages ?? quota.maxImages,
    updatedAt: new Date().toISOString(),
  };
  await setSubscription(migrated);
  await deleteSubscription(fromUserId);
}

// قائمة كل الاشتراكات (للوحة المشرف)
export async function listSubscriptions(): Promise<Subscription[]> {
  try {
    const rows = await listKv(SUB_PREFIX);
    return rows
      .map((row) => row.value as Subscription | null)
      .filter((s): s is Subscription => Boolean(s) && typeof s?.userId === "string");
  } catch {
    return [];
  }
}

// يحذف كل اشتراكات البريد (userId) — يُستخدم عند إلغاء حساب بمبادرة المستخدم.
// الجهاز لا يُحظر — فقط يحذف صفوف الاشتراك.
export async function deleteSubscriptionAllForEmail(email: string): Promise<number> {
  if (!email) return 0;
  const lower = email.toLowerCase();
  let count = 0;
  try {
    const rows = await listKv(SUB_PREFIX);
    for (const row of rows) {
      const sub = row.value as Subscription | null;
      if (!sub) continue;
      if (sub.userId === email || sub.userId.toLowerCase() === lower) {
        await deleteKv(row.key);
        count++;
      }
    }
  } catch {
    // best-effort: نُرجع العدد قبل الفشل
  }
  return count;
}
