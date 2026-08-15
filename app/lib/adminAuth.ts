// مصادقة المشرف — خادم فقط (server-only)
// دخول مخصّص للأدمن عبر البريد + كلمة المرور، يُنتج جلسة موقّعة (httpOnly cookie)
// تُستخدم لدخول صفحة إدارة الاشتراكات مباشرةً. لا تُصدَّق أي بيانات من العميل.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

if (typeof window !== "undefined") {
  throw new Error("adminAuth.ts is server-only");
}

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "menez223@gmail.com").toLowerCase();
// كلمة مرور الأدمن — تُفضَّل عبر متغيّر البيئة ADMIN_PASSWORD، وإلا القيمة الافتراضية المطلوبة.
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Aline";

const COOKIE_NAME = "spectre_admin";
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 ساعة

// سر التوقيع: متغيّر مخصّص إن وُجد، وإلا فلفلفة الأجهزة (سريّة خادمية موجودة).
function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.DEVICE_PEPPER || "spectre-admin-session-secret";
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
export function verifyAdminCredentials(email: string, password: string): boolean {
  const emailOk = timingSafeEqual(
    Buffer.from(email.toLowerCase()),
    Buffer.from(ADMIN_EMAIL)
  );
  const passOk = timingSafeEqual(
    Buffer.from(password),
    Buffer.from(ADMIN_PASSWORD)
  );
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
    if (email.toLowerCase() !== ADMIN_EMAIL) return null;
    return email;
  } catch {
    return null;
  }
}

// خيارات الكوكي الآمن.
export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
