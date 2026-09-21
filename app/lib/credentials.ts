// بيانات الدخول الموحّد — خادمية فقط
// الفحص الفعلي في POST /api/auth/login عبر === بعد قراءة MASTER_USERNAME
// و MASTER_PASSWORD من متغيّرات البيئة. مطلوب ضبطهما في Vercel
// (Settings → Environment Variables) قبل النشر. أي غياب يفشل التشغيل.
//
// ⚡ التجاوز الديناميكي: يُقرأ من KV أولاً (يُغيَّر من لوحة الأدمن)،
//    وإلا يُرجع إلى متغيرات البيئة. هذا يسمح بتغيير كلمة الدخول فوراً
//    دون إعادة نشر.

import "server-only";
import { getStudioOverride } from "./credentialOverrides";

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

// القيم الافتراضية من متغيرات البيئة (fallback)
const ENV_USERNAME: string = requireEnv("MASTER_USERNAME");
const ENV_PASSWORD: string = requireEnv("MASTER_PASSWORD");

/**
 * يقرأ بيانات دخول الاستوديو الفعلية:
 * 1. التجاوز من KV (إن وُجد — يُغيَّر من لوحة الأدمن)
 * 2. متغيرات البيئة (الافتراضي)
 *
 * تُستدعى في كل عملية دخول — لا تُخزَّن في متغير module-scope
 * لأن التجاوز قد يتغير بين الطلبات.
 */
export async function getStudioCredentials(): Promise<{ username: string; password: string }> {
  const override = await getStudioOverride();
  if (override) return override;
  return { username: ENV_USERNAME, password: ENV_PASSWORD };
}

// تصدير ثابت للتوافق مع الكود القديم (يُستخدم فقط في سياقات لا تدعم async)
export const MASTER_USERNAME: string = ENV_USERNAME;
export const MASTER_PASSWORD: string = ENV_PASSWORD;
