// قراءة/كتابة تجاوزات النصوص — **خادم فقط** (يستورد KV و`fs` عبره).
// الأنواع وقائمة المفاتيح في `siteCopyShared.ts` كي يستطيع العميل استيرادها.

import { getKvCached, setKv, deleteKv } from "./kvStore";
import { KV_KEYS } from "./utils/constants";
import {
  EDITABLE_KEYS,
  EMPTY_SITE_COPY,
  SITE_COPY_KEYS,
  type SiteCopy,
  type Lang,
} from "./siteCopyShared";
import type { I18nKey } from "./i18n";

// ── قراءة ──

// تُنقّي ما يُقرأ من القاعدة: مفاتيح معروفة فقط، وقيم نصّية غير فارغة.
function sanitize(raw: unknown): SiteCopy {
  const out: SiteCopy = { ar: {}, en: {} };
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const lang of ["ar", "en"] as const) {
    const bucket = src[lang];
    if (!bucket || typeof bucket !== "object") continue;
    for (const [k, v] of Object.entries(bucket as Record<string, unknown>)) {
      if (!EDITABLE_KEYS.has(k)) continue; // لا نسمح بتجاوز مفاتيح خارج القائمة
      if (typeof v === "string" && v.trim()) out[lang][k as I18nKey] = v;
    }
  }
  return out;
}

export async function getSiteCopy(): Promise<SiteCopy> {
  try {
    // تُستدعى حصراً داخل `unstable_cache` (غلاف الرئيسية) ⇒ قراءة مخزَّنة،
    // لأن `getKv` العادية (`no-store`) ترمي داخل ذلك النطاق دائماً.
    return sanitize(await getKvCached(KV_KEYS.SITE_COPY));
  } catch {
    // فشل القراءة لا يجوز أن يُسقط الصفحة — نرجع للقاموس المدمج.
    return EMPTY_SITE_COPY;
  }
}

// ── كتابة ──

export async function saveSiteCopy(copy: SiteCopy): Promise<SiteCopy> {
  const clean = sanitize(copy);
  const hasAny = SITE_COPY_KEYS.some((k) => clean.ar[k] || clean.en[k]);
  if (!hasAny) {
    // لا تجاوزات إطلاقاً ⇒ نحذف المفتاح بدل تخزين كائن فارغ.
    await deleteKv(KV_KEYS.SITE_COPY);
    return EMPTY_SITE_COPY;
  }
  await setKv(KV_KEYS.SITE_COPY, clean);
  return clean;
}

// نص واحد: التجاوز إن وُجد، وإلا القيمة المدمجة (يُستعمل في مسار الأدمن).
export function resolveCopy(copy: SiteCopy, lang: Lang, key: I18nKey, fallback: string): string {
  const v = copy[lang]?.[key];
  return v && v.trim() ? v : fallback;
}
