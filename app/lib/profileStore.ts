// ملف تعريف الجهاز (البريد + رابط الجدول) في Supabase Postgres — server only
// كل جهاز معتمد له صف kv ببادئة studio-auth/profiles/<peppered-fp>.json يربطه ببريده وجدوله.
// البريد هو هوية المالك للصفحات المنشورة؛ يُقرأ من هذا الملف خادميًا لا من طلب العميل.

import { getKv, setKv, listKv } from "./kvStore";
import { pepperFingerprint } from "./authStore";

if (typeof window !== "undefined") {
  throw new Error("profileStore.ts is server-only");
}

export interface DeviceProfile {
  fingerprint: string; // بصمة مُعدَّلة بالـ pepper
  email: string | null;
  sheetUrl: string | null;
  sheetId: string | null;
  sheetKey?: string | null; // مفتاح الجدول الثابت — يبقى صالحاً عبر إعادة النشر
  adminVerified?: boolean; // هل أُكّد كود المشرف مرة واحدة على هذا الجهاز؟ (يُعفي من إعادة الطلب) — للربط التلقائي واليدوي على حدّ سواء
  createdAt: string;
  updatedAt: string;
}

function profileKey(fp: string): string {
  return `studio-auth/profiles/${fp}.json`;
}

export function hasProfileStore(): boolean {
  return true;
}

export async function getProfile(rawFp: string): Promise<DeviceProfile | null> {
  try {
    const fp = pepperFingerprint(rawFp);
    const profile = await getKv<DeviceProfile>(profileKey(fp));
    if (profile && typeof profile.fingerprint === "string") return profile;
    return null;
  } catch {
    return null;
  }
}

export async function saveProfile(
  rawFp: string,
  patch: Partial<Pick<DeviceProfile, "email" | "sheetUrl" | "sheetId" | "sheetKey" | "adminVerified">>
): Promise<DeviceProfile> {
  const fp = pepperFingerprint(rawFp);
  const existing = await getProfile(rawFp);
  const now = new Date().toISOString();
  const profile: DeviceProfile = {
    fingerprint: fp,
    email: patch.email !== undefined ? patch.email : (existing?.email ?? null),
    sheetUrl: patch.sheetUrl !== undefined ? patch.sheetUrl : (existing?.sheetUrl ?? null),
    sheetId: patch.sheetId !== undefined ? patch.sheetId : (existing?.sheetId ?? null),
    sheetKey: patch.sheetKey !== undefined ? patch.sheetKey : (existing?.sheetKey ?? null),
    adminVerified: patch.adminVerified !== undefined ? patch.adminVerified : existing?.adminVerified,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await setKv(profileKey(fp), profile);
  return profile;
}

// البريد هو المالك الأساسي؛ غيابه تعني أن المالك سقوطًا هو هوية الجهاز
export async function getProfileEmail(rawFp: string): Promise<string | null> {
  const profile = await getProfile(rawFp);
  return profile?.email ?? null;
}

// يجلب ملف تعريف أي جهاز مرتبط ببريد معيّن (أيًا كان الجهاز).
// يُستخدم لجعل ربط البريد idempotent: إن كان البريد مربوطاً سابقاً من
// جهاز آخر، نعيد استخدام جدوله (sheetUrl/sheetId/sheetKey) دون إعادة
// إنشائه في المصنع — فيتمكّن المستخدم من إعادة إدخال إيميله القديم من
// أي جهاز دون أن يرفضه النظام بخطأ تكرار.
export async function getProfileByEmail(email: string): Promise<DeviceProfile | null> {
  const lower = email.toLowerCase();
  try {
    const rows = await listKv("studio-auth/profiles/");
    for (const row of rows) {
      const profile = row.value as DeviceProfile | null;
      if (profile?.email && profile.email.toLowerCase() === lower) return profile;
    }
    return null;
  } catch {
    return null;
  }
}

// يحلّ مالكًا (إيميل أو هوية جهاز) إلى البريد الكنسي الخاص به.
// إن كان owner بريدًا مباشرًا نعيده؛ وإن كان device:<hash> نبحث ملفّات
// التعريف عن الجهاز الذي يطابق هذا الـ hash ونعيد بريده إن وُجد.
// يُستخدم من صفحة الهبوط للتحقق من حظر/توقيف المالك سواء أُسندت منشوراته
// للبريد أم لبقيت بأصل هوية الجهاز (حماية دفاعية شاملة 100%).
export async function resolveOwnerEmail(owner: string): Promise<string | null> {
  if (!owner) return null;
  if (!owner.startsWith("device:")) return owner; // بريد مباشر = الكنسي
  const hash = owner.slice("device:".length);
  try {
    const rows = await listKv("studio-auth/profiles/");
    for (const row of rows) {
      const profile = row.value as DeviceProfile | null;
      if (!profile?.fingerprint) continue;
      if (
        profile.fingerprint.slice(0, 24) === hash ||
        profile.fingerprint === hash
      ) {
        return profile.email ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// يجلب هويات الجهاز (device:hash) المرتبطة ببريد معيّن عبر ملفات التعريف.
// يُستخدم عند حظر الأدمن لبريد: ننقل منشورات هوية الجهاز إلى البريد الكنسي
// كي يطابق مفتاح المنشور مفتاح الاشتراك المحظور وتتوقف كل الروابط فوراً.
export async function deviceOwnersForEmail(email: string): Promise<string[]> {
  const lower = email.toLowerCase();
  try {
    const rows = await listKv("studio-auth/profiles/");
    const owners = new Set<string>();
    for (const row of rows) {
      const profile = row.value as DeviceProfile | null;
      if (profile?.email && profile.email.toLowerCase() === lower) {
        owners.add(`device:${profile.fingerprint.slice(0, 24)}`);
        // كذلك نضيف الهوية الكاملة تحسباً لأي تباين في طول التخزين
        owners.add(`device:${profile.fingerprint}`);
      }
    }
    return Array.from(owners);
  } catch {
    return [];
  }
}

// يجلب البصمات المُعدَّلة بالـ pepper (fp) لكل الأجهزة المربوطة ببريد معيّن.
// يُستخدم عند حظر الأدمن للبريد: نحظر صفَّ كل جهاز منه عبر setDeviceBannedByPepper
// كي يُمنع من الإنتاج فوراً حتى لو كانت بعض منشوراته مملوكة بصيغة device:hash
// تفلت من إعادة الإسناد — هذا يغلق حافة «جهاز يهرب من حظر الإيميل».
export async function deviceFingerprintsForEmail(email: string): Promise<string[]> {
  const lower = email.toLowerCase();
  try {
    const rows = await listKv("studio-auth/profiles/");
    const fps = new Set<string>();
    for (const row of rows) {
      const profile = row.value as DeviceProfile | null;
      if (profile?.email && profile.email.toLowerCase() === lower) {
        if (profile.fingerprint) fps.add(profile.fingerprint);
      }
    }
    return Array.from(fps);
  } catch {
    return [];
  }
}
