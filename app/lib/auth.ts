// عميل المصادقة — دخول موحّد + ربط جهاز برمز يرسله المشرف — client only
// الجلسة في localStorage، وبصمة الجهاز تُرسل للخادم الذي يتحقق من اعتمادها.

import { MASTER_USERNAME, MASTER_PASSWORD } from "./credentials";
export { MASTER_USERNAME, MASTER_PASSWORD };
export { computeDeviceFingerprint } from "./device";

const SESSION_KEY = "landing-studio-session";
// مفتاح قديم لرابط الجدول في localStorage — يُهاجَر مرة واحدة إلى ملف تعريف الجهاز ثم يُحذف
const LEGACY_SHEET_URL_KEY = "landing-studio-sheet-url";
const LEGACY_USERS_KEY = "landing-studio-users";

export interface DeviceProfile {
  email: string | null;
  sheetUrl: string | null;
  sheetId: string | null;
  sheetKey?: string | null; // مفتاح الجدول الثابت — يبقى صالحاً عبر إعادة النشر
}

export interface Session {
  username: string;
}

// ── الجلسة ─────────────────────────────────────────────

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session> | null;
    if (!parsed || typeof parsed.username !== "string") {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { username: parsed.username };
  } catch {
    return null;
  }
}

export function setSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ username: MASTER_USERNAME }));
  } catch {
    // تجاهل
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // تجاهل
  }
}

// ── ملف تعريف الجهاز (البريد + رابط Google Sheets) ──────
// يُخزَّن خادميًا في Blob (profileStore) — ليس في localStorage.

const WEBHOOK_RE = /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;

export function isValidWebhook(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

export async function apiGetProfile(fingerprint: string): Promise<DeviceProfile | null> {
  try {
    const res = await fetch(`/api/auth/profile?fingerprint=${encodeURIComponent(fingerprint)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: DeviceProfile | null };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export type LinkEmailResult =
  | { status: "ok"; profile: DeviceProfile }
  | { status: "pending"; step: "admin" }
  | { status: "bad_email" }
  | { status: "config" }
  | { status: "factory_error" }
  | { status: "unauthorized" }
  | { status: "storage" }
  | { status: "no_pending" }
  | { status: "code_expired" }
  | { status: "too_many_attempts" }
  | { status: "wrong_admin_code" }
  | { status: "email_config" }
  | { status: "email_failed" }
  | { status: "error" };

export async function apiLinkEmail(
  fingerprint: string,
  email: string,
  adminCode?: string
): Promise<LinkEmailResult> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ fingerprint, action: "link_email", email, adminCode }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      profile?: DeviceProfile;
      error?: string;
      pending?: boolean;
      step?: "admin";
    };
    if (res.ok && data.profile) return { status: "ok", profile: data.profile };
    if (res.ok && data.pending && data.step === "admin") return { status: "pending", step: "admin" };
    if (data.error === "bad_email") return { status: "bad_email" };
    if (data.error === "config") return { status: "config" };
    if (data.error === "factory_error") return { status: "factory_error" };
    if (data.error === "unauthorized") return { status: "unauthorized" };
    if (data.error === "storage") return { status: "storage" };
    if (data.error === "no_pending") return { status: "no_pending" };
    if (data.error === "code_expired") return { status: "code_expired" };
    if (data.error === "too_many_attempts") return { status: "too_many_attempts" };
    if (data.error === "wrong_admin_code") return { status: "wrong_admin_code" };
    if (data.error === "email_config") return { status: "email_config" };
    if (data.error === "email_failed") return { status: "email_failed" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export type WebhookResult =
  | { status: "ok" }
  | { status: "pending"; step: "manual" }
  | { status: "bad_webhook" }
  | { status: "email_config" }
  | { status: "email_failed" }
  | { status: "no_pending" }
  | { status: "code_expired" }
  | { status: "too_many_attempts" }
  | { status: "wrong_admin_code" }
  | { status: "unauthorized" }
  | { status: "storage" }
  | { status: "error" };

export async function apiSetWebhook(
  fingerprint: string,
  sheetUrl: string,
  adminCode?: string
): Promise<WebhookResult> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ fingerprint, action: "set_webhook", sheetUrl, adminCode }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      pending?: boolean;
      step?: "manual";
      error?: string;
    };
    if (res.ok && data.pending && data.step === "manual") return { status: "pending", step: "manual" };
    if (res.ok) return { status: "ok" };
    if (data.error === "bad_webhook") return { status: "bad_webhook" };
    if (data.error === "email_config") return { status: "email_config" };
    if (data.error === "email_failed") return { status: "email_failed" };
    if (data.error === "no_pending") return { status: "no_pending" };
    if (data.error === "code_expired") return { status: "code_expired" };
    if (data.error === "too_many_attempts") return { status: "too_many_attempts" };
    if (data.error === "wrong_admin_code") return { status: "wrong_admin_code" };
    if (data.error === "unauthorized") return { status: "unauthorized" };
    if (data.error === "storage") return { status: "storage" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export async function apiClearProfile(fingerprint: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ fingerprint, action: "clear" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// إزالة رابط الجدول المربوط فقط (يُبقي البريد كما هو)
export async function apiClearLink(fingerprint: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ fingerprint, action: "clear_link" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// هجرة الرابط القديم من localStorage إلى ملف الجهاز (مرة واحدة)
export async function migrateLegacySheetUrl(fingerprint: string): Promise<void> {
  if (typeof window === "undefined") return;
  let legacy: string | null = null;
  try {
    legacy = window.localStorage.getItem(LEGACY_SHEET_URL_KEY);
  } catch {
    return;
  }
  if (!legacy || !legacy.trim()) return;
  const profile = await apiGetProfile(fingerprint);
  if (!profile || !profile.sheetUrl) {
    // مسار الهجرة (مرة واحدة) يُعفي من باب كود المشرف — نمرّره عبر العلم
    // migrate:true لتجاوز الباب على جهاز مُسجَّل الدخول أصلًا وله رابط سابق.
    try {
      await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ fingerprint, action: "set_webhook", sheetUrl: legacy.trim(), migrate: true }),
      });
    } catch {
      // تجاهل فشل الهجرة
    }
  }
  try {
    window.localStorage.removeItem(LEGACY_SHEET_URL_KEY);
  } catch {
    // تجاهل
  }
}

// ── التحقق المحلي (احتياطي — المصادقة الحقيقية عبر الخادم) ──

export function verifyMasterLogin(username: string, password: string): boolean {
  return username.trim().toLowerCase() === MASTER_USERNAME && password === MASTER_PASSWORD;
}

// ── استدعاءات الخادم ──────────────────────────────────

export type LoginResult =
  | { status: "approved" }
  | { status: "needs_code"; codeRequestedAt: string }
  | { status: "invalid_credentials" }
  | { status: "banned" }
  | { status: "email_config" }
  | { status: "email_failed" }
  | { status: "missing_fingerprint" }
  | { status: "error" };

export type VerifyResult =
  | { status: "approved" }
  | { status: "wrong_code" }
  | { status: "code_expired" }
  | { status: "too_many_attempts" }
  | { status: "no_pending" }
  | { status: "invalid_code" }
  | { status: "error" };

export async function apiLogin(
  username: string,
  password: string,
  fingerprint: string
): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ username, password, fingerprint }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      approved?: boolean;
      codeRequestedAt?: string;
      error?: string;
    };
    if (res.ok && data.approved) return { status: "approved" };
    if (res.ok && !data.approved) return { status: "needs_code", codeRequestedAt: data.codeRequestedAt ?? "" };
    if (data.error === "invalid_credentials") return { status: "invalid_credentials" };
    if (data.error === "banned") return { status: "banned" };
    if (data.error === "email_config") return { status: "email_config" };
    if (data.error === "email_failed") return { status: "email_failed" };
    if (data.error === "missing_fingerprint") return { status: "missing_fingerprint" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export async function apiVerify(username: string, code: string, fingerprint: string): Promise<VerifyResult> {
  try {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ username, code, fingerprint }),
    });
    const data = (await res.json().catch(() => ({}))) as { approved?: boolean; error?: string };
    if (res.ok && data.approved) return { status: "approved" };
    if (data.error === "wrong_code") return { status: "wrong_code" };
    if (data.error === "code_expired") return { status: "code_expired" };
    if (data.error === "too_many_attempts") return { status: "too_many_attempts" };
    if (data.error === "no_pending") return { status: "no_pending" };
    if (data.error === "invalid_code") return { status: "invalid_code" };
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export interface AccountSubscription {
  userId: string;
  plan: string;
  status: string;
  expiresAt: string | null;
  reason: string | null;
  updatedAt: string;
  // حقول مدة الصلاحية (لعرض تفاصيل الاشتراك للعميل)
  validityUnit?: "day" | "always" | null;
  validityDays?: number | null;
  validityExpiresAt?: string | null;
  remainingDays?: number | null;
}

export async function apiCheckDevice(
  fingerprint: string
): Promise<{
  approved: boolean;
  isAdmin: boolean;
  username: string | null;
  profile: DeviceProfile | null;
  blocked?: boolean;
  suspended?: boolean;
  reason?: string | null;
  subscription?: AccountSubscription | null;
}> {
  try {
    const res = await fetch(`/api/auth/account?fingerprint=${encodeURIComponent(fingerprint)}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      approved?: boolean;
      isAdmin?: boolean;
      username?: string | null;
      profile?: DeviceProfile | null;
      blocked?: boolean;
      suspended?: boolean;
      reason?: string | null;
      subscription?: AccountSubscription | null;
    };
    return {
      approved: Boolean(data.approved),
      isAdmin: Boolean(data.isAdmin),
      username: data.username ?? null,
      profile: data.profile ?? null,
      blocked: data.blocked ?? false,
      suspended: data.suspended ?? false,
      reason: data.reason ?? null,
      subscription: data.subscription ?? null,
    };
  } catch {
    return { approved: false, isAdmin: false, username: null, profile: null, blocked: false, suspended: false, reason: null, subscription: null };
  }
}

export type CanProduceResult = {
  allowed: boolean;
  reason?:
    | "missing_fingerprint"
    | "unauthorized"
    | "incomplete"
    | "banned"
    | "suspended"
    | "storage"
    | "config"
    | "error";
  status?: string | null;
};

// بوابة خادمية قطعية: هل يُسمح لهذا الجهاز بإنتاج محتوى (تحميل HTML/نشر)؟
// تُستدعى قبل التوليد كي لا يعتمد الحظر على حارس عميل قابل للالتفاف.
export async function apiCanProduce(fingerprint: string): Promise<CanProduceResult> {
  try {
    const res = await fetch(
      `/api/auth/can-produce?fingerprint=${encodeURIComponent(fingerprint)}`,
      { cache: "no-store" }
    );
    const data = (await res.json().catch(() => ({}))) as Partial<CanProduceResult>;
    if (res.ok && data.allowed) return { allowed: true };
    return { allowed: false, reason: (data.reason as CanProduceResult["reason"]) ?? "error", status: data.status ?? null };
  } catch {
    // فشل الشبكة → غير مسموح احتياطياً (fail-closed)
    return { allowed: false, reason: "error" };
  }
}

// تنظيف بقايا مصادقة localStorage القديمة (نظام الحسابات السابق)
export function clearLegacyAuthStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_USERS_KEY);
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: unknown };
      if (parsed && typeof parsed.token === "string") {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {
    // تجاهل
  }
}
