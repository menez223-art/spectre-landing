// مصادقة المشرف — خادم فقط (server-only)
// دخول مخصّص للأدمن عبر البريد + كلمة المرور، يُنتج جلسة موقّعة (httpOnly cookie)
// تُستخدم لدخول صفحة إدارة الاشتراكات مباشرةً. لا تُصدَّق أي بيانات من العميل.
//
// ⚡ التجاوز الديناميكي: يُقرأ من KV أولاً (يُغيَّر من لوحة الأدمن)،
//    وإلا يُرجع إلى متغيرات البيئة. هذا يسمح بتغيير كلمة الدخول فوراً
//    دون إعادة نشر.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getAdminOverride } from "./credentialOverrides";

if (typeof window !== "undefined") {
  throw new Error("adminAuth.ts is server-only");
}

// أمان: مطلوب ضبط هذه المتغيرات في Vercel (Settings → Environment Variables).
// أي غياب يفشل البناء/التشغيل فوراً بدلاً من قبول قيم افتراضية ضعيفة.
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
const ENV_ADMIN_EMAIL = requireEnv("ADMIN_EMAIL").toLowerCase();
const ENV_ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
const ADMIN_SESSION_SECRET = requireEnv("ADMIN_SESSION_SECRET");

const COOKIE_NAME = "spectre_admin";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 ساعة

// سر التوقيع: متغيّر مخصّص فقط. لا fallback — أي غياب يفشل التشغيل.
function secret(): string {
  return ADMIN_SESSION_SECRET;
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export interface AdminSession {
  email: string;
  expires: number;
}

// يُوقّع جلسة أدمن صالحة لمدة SESSION_MAX_AGE.
export function signAdminSession(email: string): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${email.toLowerCase()}|${expires}`;
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${hmac(payload)}`;
}

// يتحقّق من كلمة مرور الأدمن (مقارنة ثابتة زمنياً).
// يقرأ التجاوز من KV أولاً، ثم يرجع لمتغيرات البيئة.
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const override = await getAdminOverride();
  const expectedEmail = (override?.email ?? ENV_ADMIN_EMAIL).toLowerCase();
  const expectedPassword = override?.password ?? ENV_ADMIN_PASSWORD;

  // مقارنة ثابتة زمنياً مع حارس طول: timingSafeEqual يرمي
  // ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH إذا اختلف طول المخزنين، فأي محاولة
  // دخول بطول بريد/كلمة مرور مختلف كانت تُسقط 500 بدل رفض نظيف. نحرس الطول
  // أولاً (نفس نمط getAdminSession أدناه) ثم نقارن، فنُرجع false على اختلاف الطول.
  const emailBuf = Buffer.from(email.toLowerCase());
  const adminEmailBuf = Buffer.from(expectedEmail);
  const passBuf = Buffer.from(password);
  const adminPassBuf = Buffer.from(expectedPassword);
  const emailOk =
    emailBuf.length === adminEmailBuf.length &&
    timingSafeEqual(emailBuf, adminEmailBuf);
  const passOk =
    passBuf.length === adminPassBuf.length &&
    timingSafeEqual(passBuf, adminPassBuf);
  return emailOk && passOk;
}

// يقرأ الكوكي ويتحقّق من توقيعه وصلاحيته — يرجع البريد إن كانت الجلسة صحيحة وإلا null.
export function getAdminSession(): string | null {
  try {
    const raw = cookies().get(COOKIE_NAME)?.value;
    if (!raw) return null;
    const dot = raw.lastIndexOf(".");
    if (dot < 0) return null;
    const body = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    let payload: string;
    try {
      payload = Buffer.from(body, "base64url").toString("utf8");
    } catch {
      return null;
    }
    const expected = hmac(payload);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const sep = payload.lastIndexOf("|");
    if (sep < 0) return null;
    const email = payload.slice(0, sep);
    const expires = Number(payload.slice(sep + 1));
    if (!Number.isFinite(expires) || expires < Date.now()) return null;
    // التحقق من البريد يتم عبر getAdminEmail() (تجاوز + env)
    // لكن الكوكي نفسه يحمل البريد الذي سجّل الدخول به — لا نحتاج إعادة فحصه هنا
    // لأن التوقيع HMAC يضمن عدم التلاعب.
    return email;
  } catch {
    return null;
  }
}

// يُرجع بريد الأدمن الفعلي (تجاوز KV أولاً، ثم env).
// يُستخدم للتحقق من أن الجلسة تخص الأدمن الحالي (وليس أدمن سابق بعد تغيير البريد).
export async function getAdminEmail(): Promise<string> {
  const override = await getAdminOverride();
  return (override?.email ?? ENV_ADMIN_EMAIL).toLowerCase();
}

// بوابة جلسة الأدمن — تجمع فحص التوقيع (getAdminSession) مع مطابقة البريد
// الحالي (تجاوز KV أو env). تُستخدم من كل مسارات الأدمن كبديل موحّد عن
// المقارنة المحلية `getAdminSession() === ADMIN_EMAIL` التي لا تدعم التجاوز.
export async function assertAdminSession(): Promise<boolean> {
  const sessionEmail = getAdminSession();
  if (!sessionEmail) return false;
  const current = await getAdminEmail();
  if (!current) return false;
  return sessionEmail.toLowerCase() === current;
}

// خيارات الكوكي الآمن.
// ملاحظة: لا نفرض Secure إلا في الإنتاج (https). على http:// (التطوير/المحلي)
// يرفض المتصفح تخزين الكوكي الآمن، فتضيع جلسة الأدمن وترجع الصفحة بلا نهاية.
export function adminCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: isProd,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
