// وظائف التشفير والأمان الموحدة
//
// ملاحظة معمارية: هذا الملف خادمي (يستورد node:crypto). الدوال الآمنة
// للعميل (sha256Hex / escapeHtml / escapeJsString) موجودة في security.client.ts
// ولا تُجَرّ أي polyfill إلى الحزمة. لا تنقل استيراد "crypto" إلى هنا أبداً.

import { createHash, randomInt, timingSafeEqual } from "crypto";

export {
  sha256Hex,
  escapeHtml,
  escapeJsString,
} from "./security.client";

/**
 * قراءة متغيّر بيئة إلزامي — الفشل فوري (fail-closed) بدل قيمة فارغة.
 * غياب DEVICE_PEPPER كان يسقط إلى "" فتعود البصمة إلى SHA-256 خام.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}.`);
  }
  return v;
}

/**
 * إنشاء رمز تفعيل عشوائي من 6 أرقام
 * عشوائية مشفّرة (CSPRNG) عبر randomInt بدل Math.random القابل للتوقع.
 */
export function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * مقارنة سرّ ثابتة زمنياً (تمنع تسريب البادئات عبر توقيت الاستجابة).
 * timingSafeEqual يرمي عند اختلاف الطول ⇒ حارس طول أولاً (نفس نمط adminAuth).
 */
export function safeSecretEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * تعديل البصمة بـ pepper خادمي (server-only)
 * الفقدان المفاجئ للمتغيّر في بيئة ما يجب أن يفشل التشغيل، لا أن يُضعف التخزين بصمت.
 */
export function pepperFingerprint(fp: string): string {
  return createHash("sha256").update(fp + "|" + requireEnv("DEVICE_PEPPER")).digest("hex");
}

/**
 * إنشاء هوية جهاز من البصمة (للاستخدام كمالك عند غياب البريد)
 */
export function getDeviceOwner(rawFp: string): string {
  return "device:" + pepperFingerprint(rawFp).slice(0, 24);
}
