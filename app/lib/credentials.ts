// بيانات الدخول الموحّد — خادمية فقط
// الفحص الفعلي في POST /api/auth/login عبر === بعد قراءة MASTER_USERNAME
// و MASTER_PASSWORD من متغيّرات البيئة. في الإنتاج يجب ضبطهما في Vercel
// (Settings → Environment Variables) قبل النشر.

import "server-only";

const FALLBACK_USERNAME = "project";
const FALLBACK_PASSWORD = "SPECTRE";

function readEnv(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  return fallback;
}

export const MASTER_USERNAME: string = readEnv("MASTER_USERNAME", FALLBACK_USERNAME);
export const MASTER_PASSWORD: string = readEnv("MASTER_PASSWORD", FALLBACK_PASSWORD);
