// تجاوزات بيانات الدخول — server only
// تُخزَّن في KV وتُقرأ **قبل** متغيرات البيئة عند كل عملية دخول.
// هذا يسمح للأدمن بتغيير كلمات الدخول من لوحة التحكم دون إعادة نشر.
//
// المفاتيح:
//   credentials/studio.json  → { username, password }  (الاستوديو)
//   credentials/admin.json   → { email, password }     (الأدمن)
//
// ⚠️ الأمان: هذه القيم تُخزَّن في Supabase (server-only) ولا تُرسَل أبداً
// للعميل. GET يرجع فقط { overridden: boolean } — لا قيم فعلية.

import { getKv, setKv, deleteKv } from "./kvStore";

if (typeof window !== "undefined") {
  throw new Error("credentialOverrides.ts is server-only");
}

const STUDIO_KEY = "credentials/studio.json";
const ADMIN_KEY = "credentials/admin.json";

export interface StudioCredentials {
  username: string;
  password: string;
}

export interface AdminCredentials {
  email: string;
  password: string;
}

// ── الاستوديو ──

export async function getStudioOverride(): Promise<StudioCredentials | null> {
  try {
    const rec = await getKv<StudioCredentials>(STUDIO_KEY);
    if (rec && typeof rec.username === "string" && typeof rec.password === "string") {
      return rec;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setStudioOverride(creds: StudioCredentials): Promise<void> {
  await setKv(STUDIO_KEY, creds);
}

export async function clearStudioOverride(): Promise<void> {
  await deleteKv(STUDIO_KEY);
}

// ── الأدمن ──

export async function getAdminOverride(): Promise<AdminCredentials | null> {
  try {
    const rec = await getKv<AdminCredentials>(ADMIN_KEY);
    if (rec && typeof rec.email === "string" && typeof rec.password === "string") {
      return rec;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setAdminOverride(creds: AdminCredentials): Promise<void> {
  await setKv(ADMIN_KEY, creds);
}

export async function clearAdminOverride(): Promise<void> {
  await deleteKv(ADMIN_KEY);
}

// ── فحص الحالة (بدون كشف القيم) ──

export async function getCredentialStatus(): Promise<{
  studio: { overridden: boolean };
  admin: { overridden: boolean };
}> {
  const [studio, admin] = await Promise.all([getStudioOverride(), getAdminOverride()]);
  return {
    studio: { overridden: studio !== null },
    admin: { overridden: admin !== null },
  };
}