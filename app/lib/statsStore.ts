// تتبّع استهلاك السعة (Bandwidth) على Vercel — server only
// نعدّ البايتات المحمّلة فعلياً لكل زيارة لرابط منشور، على عدّادين:
//  1) تراكمي مدى الحياة (للعرض التاريخي في لوحة الأدمن).
//  2) نافذة شهرية (تُصفَّر تلقائياً مع بداية كل شهر) — هي أساس القرار، لأن
//     السقف الحاكم فعلياً على الخطط المجانية هو خروج Supabase الشهري (~5GB)
//     لا نقل فيرصل؛ فالتبديل الاستباقي لوضع الاحتياط عند 3GB شهرياً يُبقي
//     تجربة الزوار سلسة قبل ملامسة الجدار.

import { getKv, setKv, incrementKvNumber } from "./kvStore";
import { KV_KEYS, BANDWIDTH_LIMITS } from "./utils/constants";

const BANDWIDTH_KEY = KV_KEYS.BANDWIDTH;
// النافذة الشهرية الجديدة: مفتاحان منفصلان كي يصبح عدّاد البايتات ذرّياً.
const MONTH_YM_KEY = "stats/bandwidth-month-ym";
const MONTH_BYTES_KEY = "stats/bandwidth-month-bytes";
const BANDWIDTH_MONTH_LEGACY_KEY = "stats/bandwidth-month"; // القديم {ym, bytes} — قراءة/ترحيل فقط
const WARNING_KEY = KV_KEYS.FALLBACK_WARNING;

// حد الإنذار التراكمي: 90GB · الشهري الاستباقي: 3GB.
export const BANDWIDTH_WARN_BYTES = BANDWIDTH_LIMITS.WARN_BYTES;
export const BANDWIDTH_MONTHLY_WARN_BYTES = BANDWIDTH_LIMITS.MONTHLY_WARN_BYTES;

export async function getBandwidthBytes(): Promise<number> {
  try {
    const v = await getKv<number>(BANDWIDTH_KEY);
    return typeof v === "number" && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

// النافذة الشهرية — مفتاح واحد بقيمة {ym, bytes}: عند تبدّل الشهر تعود صفراً
// تلقائياً دون أي مهمة مجدولة (التصفير يحدث ضمن أول bump للشهر الجديد).
interface MonthBucket {
  ym: string;
  bytes: number;
}

function currentYm(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getMonthBucket(): Promise<MonthBucket> {
  const ym = currentYm();
  try {
    const curYm = await getKv<string>(MONTH_YM_KEY);
    if (curYm === ym) {
      const b = await getKv<number>(MONTH_BYTES_KEY);
      if (typeof b === "number" && b >= 0) return { ym, bytes: b };
    }
    // ترحيل شفاف من الدلو القديم إن كان لنفس الشهر
    const legacy = await getKv<MonthBucket>(BANDWIDTH_MONTH_LEGACY_KEY);
    if (legacy && legacy.ym === ym && typeof legacy.bytes === "number" && legacy.bytes >= 0) {
      await setKv(MONTH_YM_KEY, ym);
      await setKv(MONTH_BYTES_KEY, legacy.bytes);
      return { ym, bytes: legacy.bytes };
    }
  } catch {
    // سقوط إلى الاحتياط أدناه
  }
  try {
    const v = await getKv<MonthBucket>(BANDWIDTH_MONTH_LEGACY_KEY);
    if (v && v.ym === ym && typeof v.bytes === "number" && v.bytes >= 0) {
      return { ym: v.ym, bytes: v.bytes };
    }
  } catch {
    // تجاهل
  }
  return { ym, bytes: 0 };
}

// استهلاك الشهر الحالي — متاح لأي عرض مستقبلي في اللوحة/الإعدادات.
export async function getMonthlyBandwidth(): Promise<{ ym: string; bytes: number }> {
  return getMonthBucket();
}

// ── إحصائيات زيارات كل صفحة منشورة (شهرياً) ──
// مفتاح لكل صفحة بقيمة {ym, visits} تتصفّر ذاتياً مع بداية الشهر — نفس نمط
// النافذة الشهرية. يقرأها صاحب المتجر من الاستوديو عبر /api/my-page-stats.
const PAGE_VISITS_PREFIX = "stats/page/";

export async function getPageVisits(
  slug: string
): Promise<{ ym: string; visits: number } | null> {
  if (!slug) return null;
  try {
    const v = await getKv<{ ym?: string; visits?: number }>(`${PAGE_VISITS_PREFIX}${slug}`);
    const ym = currentYm();
    if (v && v.ym === ym && typeof v.visits === "number" && v.visits >= 0) {
      return { ym: v.ym, visits: v.visits };
    }
    return { ym, visits: 0 };
  } catch {
    return { ym: currentYm(), visits: 0 };
  }
}

export async function bumpPageVisit(slug: string): Promise<void> {
  if (!slug || typeof slug !== "string") return;
  try {
    const ym = currentYm();
    const key = `${PAGE_VISITS_PREFIX}${slug}`;
    const cur = await getKv<{ ym?: string; visits?: number }>(key);
    const prev = cur && cur.ym === ym && typeof cur.visits === "number" ? cur.visits : 0;
    await setKv(key, { ym, visits: prev + 1 });
  } catch {
    // تعذّر التسجيل — لا يعطّل عرض الصفحة
  }
}

// يزيد العدّادين ببايتات الاستجابة، ويُفعّل علم الإنذار والتحويل للاحتياط
// عند تجاوز أيٍّ من الحدَّين (تراكمي 90GB أو شهري 3GB).
// الزيادة ذرّية عبر RPC إن توفّرت دالة bump_kv_num (انظر supabase/0003) —
// وإلا يسقط هادئاً لنمط «اقرأ←اجمع←اكتب» القديم (تقديري، مقبول مؤقتاً).
export async function bumpBandwidth(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  try {
    // 1) العدّاد التراكمي
    let next = await incrementKvNumber(BANDWIDTH_KEY, bytes);
    if (next === null) {
      const current = await getBandwidthBytes();
      next = current + bytes;
      await setKv(BANDWIDTH_KEY, next);
    }

    // 2) النافذة الشهرية — مع تصفير ذاتي عند بداية الشهر
    const ym = currentYm();
    const bucket = await getMonthBucket();
    let base = bucket.bytes;
    if (bucket.ym !== ym) {
      await setKv(MONTH_YM_KEY, ym);
      await setKv(MONTH_BYTES_KEY, 0);
      base = 0;
    }
    let mNext = await incrementKvNumber(MONTH_BYTES_KEY, bytes);
    if (mNext === null) {
      mNext = base + bytes;
      await setKv(MONTH_BYTES_KEY, mNext);
    }

    const prevLifetime = next - bytes;
    const lifetimeCrossed = prevLifetime < BANDWIDTH_WARN_BYTES && next >= BANDWIDTH_WARN_BYTES;
    const monthlyCrossed = base < BANDWIDTH_MONTHLY_WARN_BYTES && mNext >= BANDWIDTH_MONTHLY_WARN_BYTES;
    if (next >= BANDWIDTH_WARN_BYTES || mNext >= BANDWIDTH_MONTHLY_WARN_BYTES) {
      await setKv(WARNING_KEY, true);
    }
    // تحويل تلقائي إلى وضع الاحتياط عند أول تجاوز لأي حد: تنتقل المنشورات
    // الجديدة تلقائياً إلى GitHub Pages فلا تنمو كلفة الزوار على الخطة
    // المجانية. يُفعَّل مرة واحدة عند التجاوز (crossed) لا عند كل زيارة.
    // لا يمسّ هذا بأي شكل نظام الحظر/السماح.
    if (lifetimeCrossed || monthlyCrossed) {
      await setKv("fallback_mode", true);
    }
  } catch {
    // تعذّر التسجيل — نتجاهل كي لا نعطّل عرض الصفحة
  }
}

export async function isBandwidthWarning(): Promise<boolean> {
  try {
    return Boolean(await getKv<boolean>(WARNING_KEY));
  } catch {
    return false;
  }
}

// إعادة ضبط الإنذار (يستدعيها الأدمن بعد التبديل للاحتياط أو بداية شهر جديد)
export async function clearBandwidthWarning(): Promise<void> {
  try {
    await setKv(WARNING_KEY, false);
  } catch {
    // تجاهل
  }
}
