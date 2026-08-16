// تتبّع استهلاك السعة (Bandwidth) على Vercel — server only
// نعدّ البايتات المحمّلة فعلياً لكل زيارة لرابط منشور، ونرفع علم الإنذار
// عند الاقتراب من الحد الأقصى (90GB من أصل 100GB على Hobby) كي يُنبَّه
// الأدمن عبر لوحة /admin قبل نفاد السعة فعلياً.

import { getKv, setKv } from "./kvStore";

const BANDWIDTH_KEY = "stats/bandwidth";
const WARNING_KEY = "fallback_warning";

// حد الإنذار: 90GB (من أصل 100GB على خطة Vercel Hobby المجانية).
export const BANDWIDTH_WARN_BYTES = 90 * 1024 * 1024 * 1024;

export async function getBandwidthBytes(): Promise<number> {
  try {
    const v = await getKv<number>(BANDWIDTH_KEY);
    return typeof v === "number" && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

// يزيد عدّاد السعة ببايتات الاستجابة، ويُفعّل علم الإنذار عند التجاوز.
// نكتفي بزيادة بسيطة (inc) دون قراءة-تعديل-كتابة ذرية — القيمة تقديرية
// لأغراض الإنذار فقط، ولا حاجة للدقة المطلقة.
export async function bumpBandwidth(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  try {
    const current = await getBandwidthBytes();
    const next = current + bytes;
    await setKv(BANDWIDTH_KEY, next);
    if (next >= BANDWIDTH_WARN_BYTES) {
      await setKv(WARNING_KEY, true);
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
