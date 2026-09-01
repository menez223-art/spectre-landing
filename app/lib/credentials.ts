// بيانات الدخول الموحّد — خادمية فقط
// الفحص الفعلي في POST /api/auth/login عبر === بعد قراءة MASTER_USERNAME
// و MASTER_PASSWORD من متغيّرات البيئة. مطلوب ضبطهما في Vercel
// (Settings → Environment Variables) قبل النشر. أي غياب يفشل التشغيل.

import "server-only";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in Vercel Project Settings → Environment Variables (Production).`
    );
  }
  return v;
}

export const MASTER_USERNAME: string = requireEnv("MASTER_USERNAME");
export const MASTER_PASSWORD: string = requireEnv("MASTER_PASSWORD");
