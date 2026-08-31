"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiCheckDevice,
  apiGetProfile,
  apiClearLink,
  apiLinkEmail,
  apiLogin,
  apiSetWebhook,
  apiVerify,
  clearLegacyAuthStorage,
  clearSession,
  computeDeviceFingerprint,
  getSession,
  migrateLegacySheetUrl,
  setSession,
  type AccountSubscription,
  type DeviceProfile,
  type LinkEmailResult,
  type WebhookResult,
} from "@/app/lib/auth";

// Username used as a display label only (matches server MASTER_USERNAME).
const MASTER_USERNAME = "project";
import { purgeLegacySamples } from "@/app/lib/storage";
import { useLocale } from "../LocaleProvider";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeToggle } from "../ThemeToggle";
import { useSubscriptionSync } from "@/app/hooks/useSubscriptionSync";

interface AuthContextValue {
  user: string | null;
  fingerprint: string | null;
  account: DeviceProfile | null;
  subscription: AccountSubscription | null;
  isAdmin: boolean;
  logout: () => void;
  openSettings: () => void;
  refreshAccount: () => Promise<void>;
  // يجلب اشتراك المستخدم الحقيقي من قاعدة الأدمن فوراً (متزامناً مع لوحة الأدمن)
  refreshSubscription: () => Promise<void>;
  // يحدّث الاشتراك محلياً (يستخدمه useSubscriptionSync عبر Realtime)
  setSubscription: (sub: AccountSubscription | null | ((prev: AccountSubscription | null) => AccountSubscription | null)) => void;
  linkEmail: (email: string, adminCode?: string, emailCode?: string) => Promise<LinkEmailResult>;
  setWebhook: (url: string, adminCode?: string) => Promise<WebhookResult>;
  clearLink: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  fingerprint: null,
  account: null,
  subscription: null,
  isAdmin: false,
  logout: () => {},
  openSettings: () => {},
  refreshAccount: async () => {},
  refreshSubscription: async () => {},
  setSubscription: () => {},
  linkEmail: async () => ({ status: "error" }),

  setWebhook: async () => ({ status: "error" }),
  clearLink: async () => false,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

const inputCls =
  "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-[16px] text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm dark:border-white/15 dark:bg-[#0d1117] dark:text-ivory-50 dark:placeholder:text-ivory-50/40";

// ── شاشة تسجيل الدخول: خطوة البيانات ثم خطوة رمز الجهاز ──
function LoginScreen({ onSuccess }: { onSuccess: (fingerprint: string) => void }) {
  const { t } = useLocale();
  const [stage, setStage] = useState<"credentials" | "code">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fingerprintRef = useRef<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fingerprint = await computeDeviceFingerprint();
      fingerprintRef.current = fingerprint;
      const res = await apiLogin(username, password, fingerprint);
      if (res.status === "approved") {
        setSession();
        onSuccess(fingerprint);
        return;
      }
      if (res.status === "needs_code") {
        setStage("code");
        setPassword("");
        return;
      }
      if (res.status === "invalid_credentials") {
        setError(t("errInvalidCreds"));
      } else if (res.status === "banned") {
        setError(t("bannedLogin"));
      } else if (res.status === "email_config") {
        setError(t("errEmailConfig"));
      } else if (res.status === "email_failed") {
        setError(t("errEmailFailed"));
      } else if (res.status === "missing_fingerprint") {
        setError(t("errFingerprint"));
      } else {
        setError(t("errGeneric"));
      }
    } catch {
      setError(t("errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const fingerprint = fingerprintRef.current;
    if (!fingerprint) {
      setError(t("errRetry"));
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiVerify(username, code, fingerprint);
      if (res.status === "approved") {
        setSession();
        onSuccess(fingerprint);
        return;
      }
      if (res.status === "wrong_code") setError(t("errWrongCode"));
      else if (res.status === "code_expired") setError(t("errCodeExpired"));
      else if (res.status === "too_many_attempts") setError(t("errTooMany"));
      else if (res.status === "no_pending") setError(t("errNoPending"));
      else if (res.status === "invalid_code") setError(t("errInvalidCode"));
      else setError(t("errGeneric"));
    } catch {
      setError(t("errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const card = (
    <div className="overflow-hidden rounded-3xl border border-ivory-50/10 bg-white shadow-2xl shadow-navy-950/40 dark:border-white/10 dark:bg-[#161b22]">
      <div className="flex items-center justify-between bg-navy-900 px-5 py-3 text-ivory-50 sm:px-7 sm:py-4">
        <div className="text-center">
          <p className="font-display text-2xl font-extrabold">
            استوديو<span className="text-navy-400">.</span>
          </p>
          <p className="mt-1 text-xs text-ivory-50/70">
            {stage === "credentials" ? t("loginTitle") : t("newDevice")}
          </p>
        </div>
        <ThemeToggle />
      </div>

      {stage === "credentials" ? (
        <form onSubmit={handleLogin} className="grid gap-3 p-7">
          <input
            className={inputCls}
            placeholder={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
          <input
            className={inputCls}
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold leading-5 text-red-600">{error}</p>
          )}
          <button
            className="rounded-full bg-navy-900 px-6 py-3 text-sm font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-50"
            type="submit"
            disabled={busy}
          >
            {busy ? t("checking") : t("login")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="grid gap-3 p-7">
          <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-navy-800">
            {t("codeInfo")}
          </p>
          <input
            className={`${inputCls} text-center font-display text-lg font-bold tracking-[0.4em]`}
            placeholder="000000"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
            required
          />
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold leading-5 text-red-600">{error}</p>
          )}
          <button
            className="rounded-full bg-navy-900 px-6 py-3 text-sm font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-50"
            type="submit"
            disabled={busy}
          >
            {busy ? t("checking") : t("activate")}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("credentials");
              setError("");
            }}
            className="text-center text-[11px] font-semibold text-navy-900/50 transition hover:text-navy-900"
          >
            {t("backToLogin")}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="grid min-h-screen place-items-center bg-navy-950 px-6 py-12 text-navy-900">
      <div className="w-full max-w-md">{card}</div>
    </div>
  );
}

// ── شاشة منع الدخول بسبب حالة الاشتراك (محظور/موقوف/منتهٍ) ──
function DeniedScreen({ reason }: { reason: string | null }) {
  return (
    <div className="grid min-h-screen place-items-center bg-navy-950 px-6 py-12 text-navy-900">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-ivory-50/10 bg-white shadow-2xl shadow-navy-950/40">
        <div className="bg-navy-900 px-7 py-8 text-center text-ivory-50">
          <p className="font-display text-2xl font-extrabold">
            استوديو<span className="text-navy-400">.</span>
          </p>
          <p className="mt-1 text-xs text-ivory-50/70">تعذّر الدخول</p>
        </div>
        <div className="grid gap-3 p-7">
          <p className="rounded-xl bg-red-50 px-3 py-3 text-[12px] font-semibold leading-6 text-red-600">
            {reason ?? "لا يمكنك الوصول إلى الاستوديو في الوقت الحالي."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── البوابة + المزوّد ──
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [account, setAccount] = useState<DeviceProfile | null>(null);
  const [subscription, setSubscription] = useState<AccountSubscription | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshAccount = useCallback(async (fp: string | null = fingerprint) => {
    if (!fp) return;
    const profile = await apiGetProfile(fp);
    setAccount(profile);
  }, [fingerprint]);

  useEffect(() => {
    clearLegacyAuthStorage();
    purgeLegacySamples();

    const session = getSession();
    if (!session) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    // نحتفظ بنسخة من الجلسة المحلية لاستخدامها عند فشل الشبكة،
    // كي لا نطرد المستخدم ظلماً عند الرجوع (Back) في المتصفح — خاصة على الجوال.
    const localSession = session;

    computeDeviceFingerprint()
      .then(async (fp) => {
        // نلتقط فشل الشبكة هنا لنحتفظ بالبصمة المُحسوبة ونقرّر لاحقاً.
        try {
          return { fp, res: await apiCheckDevice(fp), ok: true as const };
        } catch {
          return { fp, res: null, ok: false as const };
        }
      })
      .then(({ fp, res, ok }) => {
        if (cancelled) return;

        // ── تثبيت الجلسة نهائياً ──
        // الجلسة المحلية (localStorage) هي المصدر الموثوق: ما دامت موجودة، يدخل
        // المستخدم بحرية دون إعادة طلب الباسورد — حتى عند الرجوع للرئيسية أو
        // التنقّل بين الصفحات. لا نطرده إلا عند حظر/إيقاف صريح من الخادم.
        const keepLocal = () => {
          setUser(localSession.username);
          setFingerprint(fp);
          // نحدّث بيانات الاشتراك والملف إن توفّرت (دون طرد الجلسة عند غيابها)
          setIsAdmin(res?.isAdmin ?? false);
          if (ok && res?.profile) setAccount(res.profile);
          if (ok && res?.subscription) setSubscription(res.subscription);
          // هجرة الرابط القديم من localStorage إن وُجد ثم تحديث الملف الشخصي
          migrateLegacySheetUrl(fp).then(() => {
            if (cancelled) return;
            apiGetProfile(fp).then(setAccount);
          });
          setLoaded(true);
        };

        if (ok && res!.blocked) {
          // اقتراح 2: الحظر (Ban) → طرد فوري إلى الصفحة الرئيسية فوراً،
          // مع مسح الجلسة المحلية كي لا يعود المستخدم عند الرجوع (Back).
          // النطاق: الاستوديو فقط — لوحة الأدمن (/admin) تبقى تعمل بدخول المشرف.
          clearSession();
          router.replace("/");
          setLoaded(true);
        } else if (ok && res!.suspended) {
          // إيقاف/انتهاء صريح (غير حظر) → نعرض شاشة المنع داخل الاستوديو
          // كما كان، دون طرد (الحظر وحده يُطرد للرئيسية).
          setDenied(res!.reason ?? "تم إيقاف اشتراكك.");
          setLoaded(true);
        } else {
          // كل الحالات الأخرى (معتمد / غير معتمد عابر / فشل شبكة / تخزين متقلّب)
          // → نُبقي الجلسة المحلية ونسمح بالدخول. الجهاز غير المعتمد سيعرض شاشة
          // تفعيل الرمز فقط عند تسجيل الدخول الجديد، لا أثناء التنقّل داخل التطبيق.
          keepLocal();
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    clearSession();
    setUser(null);
    setAccount(null);
    setSubscription(null);
    setIsAdmin(false);
    setFingerprint(null);
    setSettingsOpen(false);
  }

  function handleAuthSuccess(fp: string, username?: string) {
    setFingerprint(fp);
    // عرض اسم المستخدم الفعلي المُدخل (مصدر الحقيقة)، أو اسم العرض الافتراضي إن لم يُمرَّر.
    setUser(username?.trim() || MASTER_USERNAME);
    // تحميل بيانات الحساب والاشتراك مرتبطة مباشرةً بقاعدة بيانات الأدمن فور
    // تسجيل الدخول — دون ذلك يبقى subscription فارغاً ويظهر «اشتراك مجاني».
    loadAccount(fp);
  }

  // يحمّل حساب المستخدم + اشتراكه الحقيقي من الخادم (مرتبط بقاعدة الأدمن).
  // يُستدعى بعد الدخول وعند استعادة الجلسة المحلية. لا يطرد المستخدم عند
  // فشل الشبكة — الجلسة المحلية تبقى الموثوقة.
  async function loadAccount(fp: string) {
    setIsAdmin(false);
    try {
      const res = await apiCheckDevice(fp);
      setIsAdmin(res.isAdmin);
      if (res.profile) setAccount(res.profile);
      // الاشتراك الحقيقي (بأيامه المتبقية) يأتي من subsStore عبر الأدمن
      if (res.subscription) setSubscription(res.subscription);
    } catch {
      // فشل الشبكة — لا نمسح الجلسة المحلية
    }
    migrateLegacySheetUrl(fp).then(() => refreshAccount(fp));
  }

  // يجلب اشتراك المستخدم الحقيقي من الخادم (مرتبط بقاعدة الأدمن) فوراً.
  // يُستدعى عند فتح لوحة الإعدادات كي ينعكس أي تحديث للأدمن (أيام/صلاحية)
  // مباشرةً على الزبون دون انتظار إعادة تحميل الصفحة.
  const refreshSubscription = useCallback(async (): Promise<void> => {
    if (!fingerprint) return;
    try {
      const res = await apiCheckDevice(fingerprint);
      if (res.subscription) setSubscription(res.subscription);
    } catch {
      // فشل الشبكة — نُبقي آخر قيمة (الجلسة المحلية تبقى الموثوقة)
    }
  }, [fingerprint]);

  // مزامنة الحظر/التوقيف مع الخادم دورياً: نسحب الحالة القطعية من بوابة
  // /api/auth/can-produce (fail-closed) ونعكسها فوراً على العميل، كي يظهر
  // الحظر/التوقيف في الواجهة (وشاشة المنع) مباشرةً بعد أن يضغط الأدمن «حظر»،
  // دون انتظار إعادة تحميل الصفحة. هذا يحلّ شكوى «حالة الحظر لا تظهر».
  useEffect(() => {
    if (!fingerprint) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await apiCheckDevice(fingerprint);
        if (cancelled) return;
        // حظر (Ban) صريح → طرد فوري للرئيسية (اقتراح 2) وتنظيف الجلسة،
        // كي لا يبقى المستخدم المحظور في الاستوديو ولا يعود بالرجوع.
        if (res.blocked) {
          clearSession();
          router.replace("/");
          return;
        }
        // نعكس التوقيف/الانتهاء الصريح فوراً على العميل
        if (res.suspended) {
          setSubscription((prev) => ({
            userId: prev?.userId ?? res.subscription?.userId ?? "",
            plan: prev?.plan ?? "basic",
            status: res.blocked ? "banned" : "suspended",
            expiresAt: prev?.expiresAt ?? null,
            reason: res.reason ?? prev?.reason ?? null,
            updatedAt: new Date().toISOString(),
            validityUnit: prev?.validityUnit ?? null,
            validityDays: prev?.validityDays ?? null,
            validityExpiresAt: prev?.validityExpiresAt ?? null,
            remainingDays: prev?.remainingDays ?? null,
          }));
        } else if (res.subscription) {
          // غير محظور → نحدّث الحالة من الخادم (يرفع الحظر إن رُفع)
          setSubscription(res.subscription);
        }
      } catch {
        // فشل الشبكة — نُبقي الحالة كما هي (الجلسة المحلية تبقى الموثوقة)
      }
    };
    sync();
    const id = setInterval(sync, 15000); // كل 15 ثانية
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  // مزامنة الاشتراكات فورياً عبر Supabase Realtime
  // يستمع لتغييرات مفاتيح subs/% في جدول kv ويحدّث حالة الاشتراك محلياً
  useSubscriptionSync();

  async function handleLinkEmail(
    email: string,
    adminCode?: string
  ): Promise<LinkEmailResult> {
    if (!fingerprint) return { status: "error" };
    const res = await apiLinkEmail(fingerprint, email, adminCode);
    if (res.status === "ok") setAccount(res.profile);
    return res;
  }

  async function handleSetWebhook(url: string, adminCode?: string): Promise<WebhookResult> {
    if (!fingerprint) return { status: "error" };
    const res = await apiSetWebhook(fingerprint, url, adminCode);
    if (res.status === "ok") await refreshAccount(fingerprint);
    return res;
  }

  async function handleClearLink(): Promise<boolean> {
    if (!fingerprint) return false;
    const ok = await apiClearLink(fingerprint);
    if (ok) await refreshAccount(fingerprint);
    return ok;
  }

  // مغلّف refreshAccount كـ useCallback — يجب أن يكون قبل أي return مشروط
  // كي لا نكسر قواعد ترتيب الـHooks (تحذير React السابق كان بسببه).
  const wrappedRefreshAccount = useCallback(
    () => refreshAccount(fingerprint),
    [refreshAccount, fingerprint]
  );

  if (!loaded) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-navy-400/20 border-t-navy-400" />
      </div>
    );
  }

  if (denied) {
    return <DeniedScreen reason={denied} />;
  }

  if (!user) {
    return <LoginScreen onSuccess={handleAuthSuccess} />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        fingerprint,
        account,
        subscription,
        isAdmin,
        logout: handleLogout,
        openSettings: () => {
          setSettingsOpen(true);
          // جلب اشتراك المستخدم الحقيقي فوراً عند فتح الإعدادات
          // كي ينعكس تعديل الأدمن (الأيام/الصلاحية) مباشرةً على الزبون.
          refreshSubscription();
        },
        refreshAccount: wrappedRefreshAccount,
        refreshSubscription,
        setSubscription,
        linkEmail: handleLinkEmail,
        setWebhook: handleSetWebhook,
        clearLink: handleClearLink,
      }}
    >
      {subscription?.notice ? (
        <div className="sticky top-0 z-40 flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-[13px] font-bold text-amber-900">
          <span aria-hidden="true">⚠️</span>
          <span className="flex-1">{subscription.notice}</span>
        </div>
      ) : null}
      {children}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AuthContext.Provider>
  );
}
