// عميل المصادقة — دخول موحّد + ربط جهاز برمز يرسله المشرف — client only
// الجلسة في localStorage، وبصمة الجهاز تُرسل للخادم الذي يتحقق من اعتمادها.

import { MASTER_USERNAME, MASTER_PASSWORD } from "./credentials";
export { MASTER_USERNAME, MASTER_PASSWORD };
export { computeDeviceFingerprint } from "./device";

const SESSION_KEY = "landing-studio-session";
// مفتاح قديم لرابط الجدول في localStorage — يُهاجَر مرة واحدة إلى ملف تعريف الجهاز ثم يُحذف
const LEGACY_SHEET_URL_KEY = "landing-studio-sheet-url";
const LEGACY_USERS_KEY = "landing-studio-users";

// ── تخزين الجلسة المزدوج (localStorage + cookie) ──
// المشكلة: الجلسة كانت تعتمد كلياً على localStorage، فأي مسح عرضي (تصفّح خاص،
// مسح الكاش، متصفّحات التطبيقات المدمجة كفيسبوك/إنستغرام التي تعزل التخزين)
// كان يُسقط المستخدم خارج الاستوديو ويتطلّب إعادة دخول. الحل: نكتب الجلسة
// أيضاً في ملف تعريف ارتباط (cookie) بعمر طويل كاحتياطي. تُستعاد الجلسة من أي
// من المصدرين، فلا يكفي مسح أحدهما لإسقاطها. لا تُخزَّن بيانات حسّاسة — فقط
// اسم المستخدم. **لا يمسّ هذا بأي شكل نظام الحظر** (حظر/تفعيل يُنفَّذ خادمياً
// عبر apiCheckDevice ويُطبَّق في AuthGate كما كان).
const SESSION_COOKIE = "landing-studio-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // سنة واحدة

function setSessionCookie(username: string): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(
      username
    )}; path=/; max-age=${SESSION_MAX_AGE}; samesite=lax`;
  } catch {
    // تجاهل
  }
}

function getSessionCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const m = document.cookie.match(/(?:^|;\s*)landing-studio-session=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // تجاهل
  }
}

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
  // نقرأ من localStorage أولاً، ثم نتراجع إلى ملف تعريف الارتباط إن غاب
  // (المسح العرضي لأحدهما لا يُسقط الجلسة ما دام الآخر سالماً).
  let username: string | null = null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Session> | null;
      if (parsed && typeof parsed.username === "string") username = parsed.username;
    }
  } catch {
    // تجاهل قراءة localStorage — سنجرّب ملف تعريف الارتباط كاحتياطي
  }
  if (!username) username = getSessionCookie();
  if (!username) return null;
  return { username };
}

export function setSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ username: MASTER_USERNAME }));
  } catch {
    // تجاهل — الاحتياطي في ملف تعريف الارتباط سيعوّض
  }
  // احتياطي: نكتب ملف تعريف الارتباط بنفس القيمة كي تنجو الجلسة من مسح localStorage.
  setSessionCookie(MASTER_USERNAME);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // تجاهل
  }
  // نمسح الاحتياطي أيضاً كي يختفي تسجيل الدخول فعلياً عند الخروج أو الحظر.
  clearSessionCookie();
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
    const wrapper = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: {
        approved?: boolean;
        codeRequestedAt?: string;
      };
      error?: string;
    };

    // Extract actual data from wrapper { ok, data, error }
    const data = wrapper.data || wrapper as any;
    const error = wrapper.error;

    if (res.ok && (data as any).approved) return { status: "approved" };
    if (res.ok && !(data as any).approved) return { status: "needs_code", codeRequestedAt: (data as any).codeRequestedAt ?? "" };
    if (error === "invalid_credentials") return { status: "invalid_credentials" };
    if (error === "banned") return { status: "banned" };
    if (error === "email_config") return { status: "email_config" };
    if (error === "email_failed") return { status: "email_failed" };
    if (error === "missing_fingerprint") return { status: "missing_fingerprint" };
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

    console.log('[apiVerify] Response status:', res.status);
    console.log('[apiVerify] Response headers:', Object.fromEntries(res.headers.entries()));

    const text = await res.text();
    console.log('[apiVerify] Response body (raw):', text);

    let wrapper: { ok?: boolean; data?: { approved?: boolean }; error?: string } = {};
    try {
      wrapper = JSON.parse(text);
      console.log('[apiVerify] Response body (parsed):', wrapper);
    } catch (parseError) {
      console.error('[apiVerify] JSON parse error:', parseError);
      console.error('[apiVerify] Invalid JSON received:', text.substring(0, 500));
      return { status: "error" };
    }

    // Extract actual data from wrapper { ok, data, error }
    const data = wrapper.data || wrapper as any;
    const error = wrapper.error;

    if (res.ok && (data as any).approved) return { status: "approved" };
    if (error === "wrong_code") return { status: "wrong_code" };
    if (error === "code_expired") return { status: "code_expired" };
    if (error === "too_many_attempts") return { status: "too_many_attempts" };
    if (error === "no_pending") return { status: "no_pending" };
    if (error === "invalid_code") return { status: "invalid_code" };

    console.warn('[apiVerify] Unhandled response:', { status: res.status, wrapper });
    return { status: "error" };
  } catch (networkError) {
    console.error('[apiVerify] Network error:', networkError);
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
  notice?: string | null;
  // حدود النشر حسب الخطة (يوفّرها الخادم في /api/auth/account عبر نشر صف الاشتراك)
  maxProducts?: number;
  maxImages?: number;
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
