// الإعدادات التسويقية المرتبطة بالبريد (لا بالجهاز) — server only
// البيكسل + رقم الواتساب + اسم المتجر وظهوره تُخزَّن الآن في سجل واحد
// بمفتاح البريد الكنسي: studio-auth/marketing/<email>.json — فتنتقل مع
// الحساب إلى أي متصفح يربط نفس البريد، ويقرأها النشر ولوحة الأدمن منها.
//
// ترحيل شفاف: عند غياب سجل البريد نبحث ملفات تعريف الأجهزة المرتبطة
// بنفس البريد وننقل أول قيم موجودة (كانت مخزنة لكل جهاز قديماً) — مرة
// واحدة، ثم يصبح سجل البريد هو المصدر الوحيد.

import { getKv, setKv, listKv } from "./kvStore";
import { getProfile, type DeviceProfile } from "./profileStore";

if (typeof window !== "undefined") {
  throw new Error("marketingStore.ts is server-only");
}

export interface MarketingSettings {
  email: string;
  pixelId?: string | null;
  whatsapp?: string | null;
  storeName?: string | null;
  showNamePublicly?: boolean | null;
  updatedAt: string;
}

const PREFIX = "studio-auth/marketing/";

function mKey(email: string): string {
  return `${PREFIX}${email.toLowerCase()}.json`;
}

export async function getMarketingByEmail(email: string): Promise<MarketingSettings | null> {
  try {
    const rec = await getKv<MarketingSettings>(mKey(email));
    if (rec && typeof rec.email === "string") return rec;
    return null;
  } catch {
    return null;
  }
}

// يجلب سجل البريد مع الترحيل الشفاف من ملفات تعريف الأجهزة المرتبطة
// بنفس البريد (القيم القديمة كانت مخزنة لكل جهاز على حدة). لا يُنشئ
// سجلاً فارغاً إن لم يوجد ما يُرحَّل — يعيد غلافاً مؤقتاً فقط.
export async function getMarketingForEmailWithMigration(
  email: string
): Promise<MarketingSettings> {
  const lower = email.toLowerCase();
  const existing = await getMarketingByEmail(lower);
  if (existing) return existing;

  let migrated: Partial<Pick<MarketingSettings, "pixelId" | "whatsapp" | "storeName" | "showNamePublicly">> = {};
  try {
    const rows = await listKv("studio-auth/profiles/");
    for (const row of rows) {
      const p = row.value as DeviceProfile | null;
      if (!p?.email || p.email.toLowerCase() !== lower) continue;
      if (migrated.pixelId === undefined && p.pixelId != null) migrated.pixelId = p.pixelId;
      if (migrated.whatsapp === undefined && p.whatsapp != null) migrated.whatsapp = p.whatsapp;
      if (migrated.storeName === undefined && p.storeName != null) migrated.storeName = p.storeName;
      if (migrated.showNamePublicly === undefined && p.showNamePublicly != null) {
        migrated.showNamePublicly = p.showNamePublicly;
      }
    }
  } catch {
    // فشل المسح — نعيد غلافاً فارغاً دون تخزين
  }

  const hasAny =
    migrated.pixelId != null ||
    migrated.whatsapp != null ||
    migrated.storeName != null ||
    migrated.showNamePublicly != null;

  if (!hasAny) {
    return { email: lower, pixelId: null, whatsapp: null, storeName: null, showNamePublicly: null, updatedAt: new Date().toISOString() };
  }

  const rec: MarketingSettings = {
    email: lower,
    ...migrated,
    updatedAt: new Date().toISOString(),
  };
  try {
    await setKv(mKey(lower), rec);
  } catch {
    // فشل حفظ الترحيل لا يمنع إرجاع القيم المدموجة
  }
  return rec;
}

export async function saveMarketing(
  email: string,
  patch: Partial<Pick<MarketingSettings, "pixelId" | "whatsapp" | "storeName" | "showNamePublicly">>
): Promise<MarketingSettings> {
  const lower = email.toLowerCase();
  const existing = await getMarketingByEmail(lower);
  const rec: MarketingSettings = {
    email: lower,
    pixelId: patch.pixelId !== undefined ? patch.pixelId : (existing?.pixelId ?? null),
    whatsapp: patch.whatsapp !== undefined ? patch.whatsapp : (existing?.whatsapp ?? null),
    storeName: patch.storeName !== undefined ? patch.storeName : (existing?.storeName ?? null),
    showNamePublicly:
      patch.showNamePublicly !== undefined ? patch.showNamePublicly : (existing?.showNamePublicly ?? null),
    updatedAt: new Date().toISOString(),
  };
  await setKv(mKey(lower), rec);
  return rec;
}

// عرض ملف الجهاز مدموجاً بمصدر البريد: حقول الربط/الجدول من ملف الجهاز،
// والحقول التسويقية من سجل البريد (مع ترحيل شفاف عند أول قراءة).
// هذا هو الشكل الذي يراه العميل كله — فتصبح الإعدادات تتبع البريد.
export async function getMergedProfileView(rawFp: string): Promise<DeviceProfile | null> {
  const prof = await getProfile(rawFp);
  if (!prof) return null;
  const merged: DeviceProfile = { ...prof };
  if (prof.email) {
    try {
      const mk = await getMarketingForEmailWithMigration(prof.email);
      merged.pixelId = mk.pixelId ?? null;
      merged.whatsapp = mk.whatsapp ?? null;
      merged.storeName = mk.storeName ?? null;
      merged.showNamePublicly = mk.showNamePublicly ?? null;
    } catch {
      // غياب السجل يبقي قيم الجهاز كما هي
    }
  }
  return merged;
}
