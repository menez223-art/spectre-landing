// مُحلّل رابط الجدول الديناميكي — server only
// المشكلة الجذرية سابقاً: كان تسليم الطلبات يتم عبر خادمنا → Apps Script،
// وكان هذا المسار غير موثوق (يُعيد Apps Script محتوى "Factory OK" بدل JSON)،
// فكانت الطلبات تضيع ولا تصل للجدول.
//
// الحل المعتمد: المنتج يحمل هوية ثابتة (sheetEmail + sheetKey)، ونبني رابط
// التسليم من إعداداتنا (FACTORY_URL المُعلَن في Blob ثم متغيّر البيئة) + المفتاح
// الثابت، ثم يُرسل المتصفح الطلب مباشرةً إلى Apps Script (وضع no-cors) — وهو
// المسار الذي يعمل فعلاً (يرى المستخدم "Factory OK" من متصفحه). لا نعتمد إطلاقاً
// على اتصال خادمنا بـ Apps Script في مسار تسليم الطلبات الحرج.

import { getKv, setKv } from "./kvStore";

if (typeof window !== "undefined") {
  throw new Error("sheetResolver.ts is server-only");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FACTORY_URL_KEY = "sheet-factory/current-url.json";

export interface ResolveResult {
  url: string | null;
  source: "config" | "stored" | "none";
}

// الرابط الأساسي للمصنع: نقرأ أولاً ما أعلنه السكريبت حديثاً (في Blob)،
// ثم متغيّر البيئة FACTORY_URL كاحتياط. هكذا يبقى الرابط دائماً محدّثاً
// بعد أي "نشر جديد" في Apps Script دون تدخل يدوي.
export async function getFactoryBaseUrl(): Promise<string | null> {
  const kvUrl = await readFactoryUrlFromKv();
  if (kvUrl) return kvUrl;
  const env = process.env.FACTORY_URL;
  return env && env.startsWith("https://") ? env : null;
}

async function readFactoryUrlFromKv(): Promise<string | null> {
  try {
    const data = await getKv<{ url?: string }>(FACTORY_URL_KEY);
    return data?.url && data.url.startsWith("https://") ? data.url : null;
  } catch {
    return null;
  }
}

export async function saveFactoryUrl(url: string): Promise<void> {
  if (!url.startsWith("https://")) return;
  try {
    await setKv(FACTORY_URL_KEY, { url, at: new Date().toISOString() });
  } catch {
    // تجاهل فشل الكتابة
  }
}

// بناء رابط تسليم الطلبات من الإعدادات (الرابط الأساسي) + المفتاح الثابت للجدول.
// هذا هو الرابط الذي يستعمله المتصفح لإرسال الطلب مباشرةً إلى Apps Script.
// لا يتطلب أي اتصال بـ Apps Script لحلّه — فقط إعداداتنا المحلية.
export async function buildWebhook(params: {
  sheetKey?: string | null;
  sheetEmail?: string | null;
}): Promise<string | null> {
  const { sheetKey, sheetEmail } = params;
  if (sheetKey) {
    const base = await getFactoryBaseUrl();
    if (!base) return null;
    return `${base}?key=${encodeURIComponent(sheetKey)}`;
  }
  // بدون مفتاح لا يمكننا بناء الرابط دون استدعاء المصنع — نعتمد على الرابط المخبّأ.
  return null;
}

export async function resolveWebhook(params: {
  sheetKey?: string | null;
  sheetEmail?: string | null;
  storedWebhook?: string | null;
}): Promise<ResolveResult> {
  const { sheetKey, sheetEmail, storedWebhook } = params;

  // الأولوية: بناء الرابط من الهوية الثابتة (دائماً جديد وموثوق — لا اتصال بـ GAS).
  const built = await buildWebhook({ sheetKey, sheetEmail });
  if (built) return { url: built, source: "config" };

  // احتياط: الرابط المخبّأ سابقاً (قد يكون قديمًا بعد إعادة نشر، لكنه أفضل من لا شيء).
  if (storedWebhook && storedWebhook.startsWith("https://")) {
    return { url: storedWebhook, source: "stored" };
  }
  return { url: null, source: "none" };
}

export async function resolveOrderTarget(params: {
  sheetKey?: string | null;
  sheetEmail?: string | null;
}): Promise<string | null> {
  const { sheetKey, sheetEmail } = params;
  if (sheetKey) return buildWebhook({ sheetKey, sheetEmail });
  return null;
}

// حقن الرابط المبني مسبقاً في المنتج قبل عرضه/توليده — يُستدعى خادمياً فقط.
// يضبط sheetWebhook = FACTORY_URL + "?key=" + sheetKey بحيث يُرسل المتصفح
// الطلب مباشرةً إلى الجدول الصحيح دون أي اعتماد على اتصال خادمنا بـ GAS.
export async function withResolvedWebhook<T extends object>(product: T): Promise<T> {
  const p = product as Record<string, unknown>;
  const sheetKey = (p.sheetKey as string | null) ?? null;
  if (!sheetKey) return product;
  const built = await buildWebhook({ sheetKey, sheetEmail: (p.sheetEmail as string | null) ?? null });
  if (built && built !== p.sheetWebhook) {
    return { ...product, sheetWebhook: built } as T;
  }
  return product;
}
