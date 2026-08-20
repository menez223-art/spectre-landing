"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthGate";
import { useLocale } from "../LocaleProvider";
import { ThemeToggle } from "../ThemeToggle";

// الأعمدة الثمانية التي تظهر في كل جدول تلقائي
const SHEET_HEADERS = [
  "الاسم (Name)",
  "رقم الهاتف (Phone)",
  "الولاية (State)",
  "البلدية (City)",
  "الكمية (Quantity)",
  "مكان الاستلام (Delivery Method)",
  "السعر الإجمالي (Total Price)",
  "حالة الطلبية (Order Status)",
];

const inputCls =
  "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 dark:border-white/15 dark:bg-[#0d1117] dark:text-ivory-50 dark:placeholder:text-ivory-50/40";
const ghostBtn =
  "rounded-full border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400";
const primaryBtn =
  "rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-50";

type Tab = "email" | "manual";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account, linkEmail, setWebhook, clearLink, logout, subscription, refreshSubscription } = useAuth();
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("email");
  const [emailInput, setEmailInput] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // خطوة المصادقة لربط إيميل جديد: كود المشرف (يُرسل لبريد الأونر). فارغة عند عدم وجود ربط معلّق.
  const [linkStep, setLinkStep] = useState<null | "admin">(null);
  const [adminCode, setAdminCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  // خطوة التحقق اليدوي: كود مشرف لمرة واحدة (أول جهاز فقط). null = لا يوجد تعليق.
  const [manualStep, setManualStep] = useState<null | "admin">(null);
  // لوحة تفاصيل الاشتراك — مخفية حتى يضغط المستخدم زر «نوعية الاشتراك»
  const [showSub, setShowSub] = useState(false);

  // نبضة تحديث حيّة كل 30 ثانية — تجلب اشتراك المستخدم الحقيقي من قاعدة
  // الأدمن مباشرةً فور فتح الإعدادات، كي ينعكس أي تعديل يجريه الأدمن (عدد
  // الأيام/الصلاحية) على الزبون مباشرةً وبنفس الوتيرة، دون إعادة تحميل.
  useEffect(() => {
    if (!open) return;
    refreshSubscription();
    const id = setInterval(() => refreshSubscription(), 30_000);
    return () => clearInterval(id);
  }, [open, refreshSubscription]);

  // نبضة حساب محلي كل دقيقة — تُعيد حساب الأيام المتبقية من الطابع المطلق
  // (validityExpiresAt) تماماً كما يفعل الأدمن، فيتناقص العداد في الجهتين
  // بنفس الوتيرة دون أي طلب شبكة إضافي.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!subscription || subscription.validityUnit !== "day") return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [subscription?.validityUnit, subscription?.validityExpiresAt]);

  // يحسب الأيام المتبقية محلياً (تقريب لأعلى) من تاريخ الانتهاء المطلق.
  // احتياط عند غياب تاريخ الانتهاء: نحسب من عدد الأيام المضبوط من الأدمن
  // (validityDays) كي لا تظل الخانة فارغة إن تعذّر حساب الطابع المطلق.
  function liveRemainingDays(): number | null {
    if (!subscription || subscription.validityUnit !== "day") return null;
    const ve = subscription.validityExpiresAt ? new Date(subscription.validityExpiresAt).getTime() : null;
    if (ve != null) {
      const diff = ve - Date.now();
      if (diff <= 0) return 0;
      return Math.ceil(diff / 86_400_000);
    }
    // احتياط: عدد الأيام المضبوط من الأدمن (مرجع من لحظة أول جلب صحيح)
    if (typeof subscription.validityDays === "number" && subscription.validityDays > 0) {
      return subscription.validityDays;
    }
    return null;
  }

  // النص الزمني للاشتراك النشط: خطة يومية → «متبقٍ N يوم» (يُحسب حيّاً من
  // الطابع المطلق فيتزامن مع عدّاد الأدمن)، وإلا اشتراك دائم. احتياط عند
  // تعذّر حساب الأيام: «مشترك».
  function subTimeText(): string {
    if (subscription?.validityUnit === "day") {
      const rem = liveRemainingDays();
      return rem != null ? t("subRemaining", { n: rem }) : t("subActive");
    }
    return t("subPermanent");
  }

  // يحدّد تفاصيل خانة الاشتراك ولونها بنفس بيانات الأدمن:
  //   • نشط  → نوع الخطة (أساسية/محترفة) + الوقت المتبقي، بلون الخطة:
  //            المحترفة (pro) بنفسجي، والأساسية (basic) أخضر.
  //   • محظور/موقوف/منتهٍ → سبب المنع بلون أحمر.
  //   • بلا اشتراك → رمادي.
  function subDetail(): {
    planText: string;
    timeText: string;
    tone: "purple" | "green" | "red" | "gray";
    isPlan: boolean;
  } {
    if (!subscription) return { planText: "", timeText: t("subNone"), tone: "gray", isPlan: false };
    if (subscription.status === "banned")
      return { planText: "", timeText: subscription.reason ?? t("subBanned"), tone: "red", isPlan: false };
    if (subscription.status === "suspended" || subscription.status === "expired")
      return { planText: "", timeText: subscription.reason ?? t("subExpired"), tone: "red", isPlan: false };
    const isPro = subscription.plan === "pro";
    return {
      planText: isPro ? t("planPro") : t("planBasic"),
      timeText: subTimeText(),
      tone: isPro ? "purple" : "green",
      isPlan: true,
    };
  }
  const sub = subDetail();
  const subToneCls =
    sub.tone === "purple"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
      : sub.tone === "green"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : sub.tone === "red"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200"
      : "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-200";

  // لافتة إشعار من الأدمن للمستخدم (مثلاً «حدّث رابطك») — تظهر أعلى لوحة
  // الإعدادات إن وُجدت. لا علاقة لها بالحظر/الاشتراك — مجرد رسالة من المشرف.
  // ⚠️ يجب أن تُعرَّف الحالة قبل أي return مشروط كي لا نكسر قواعد ترتيب الـHooks.
  const [dismissedNotice, setDismissedNotice] = useState(false);

  if (!open) return null;

  const notice = !dismissedNotice ? (subscription?.notice ?? null) : null;

  const sheetUrl = account?.sheetUrl ?? null; // رابط السكربت (webhook لاستقبال الطلبات)
  // رابط فتح الجدول الفعلي: نبنيه من sheetId عند الربط التلقائي فقط.
  // لا نسقط على رابط السكربت (/exec) لأنه يفتح صفحة "Factory OK" التي تبدو ملفاً فارغاً.
  const viewUrl = account?.sheetId
    ? `https://docs.google.com/spreadsheets/d/${account.sheetId}/edit`
    : null;
  const linkedEmail = account?.email ?? null;
  // اقتراح 1: خانات الربط (تلقائي/يدوي) تبقى مقفلة حتى يُربط الإيميل بنجاح.
  const emailLinked = Boolean(linkedEmail);

  // يربط الإيميل بكود مشرف واحد (يُرسل لبريد الأونر). يُستدعى من نموذج
  // البريد الأولي ومن خطوة إدخال كود المشرف حسب المرحلة الحالية.
  async function handleLinkEmail(e?: React.FormEvent) {
    e?.preventDefault();
    const email = (linkStep ? pendingEmail : emailInput).trim().toLowerCase();
    if (!email) return;
    setLoading(true);
    setMsg(null);
    const res = await linkEmail(email, linkStep ? adminCode : undefined);
    setLoading(false);
    if (res.status === "ok") {
      setMsg({ ok: true, text: t("okCreated") });
      setEmailInput("");
      setAdminCode("");
      setLinkStep(null);
      setPendingEmail("");
    } else if (res.status === "pending") {
      if (res.step === "admin") {
        setLinkStep("admin");
        setPendingEmail(email);
        setMsg({ ok: true, text: t("linkAdminCodeSent") });
      }
    } else if (res.status === "bad_email") {
      setMsg({ ok: false, text: t("errBadEmail") });
    } else if (res.status === "config" || res.status === "email_config") {
      setMsg({ ok: false, text: t("errFactoryConfig") });
    } else if (res.status === "email_failed") {
      setMsg({ ok: false, text: t("errEmailFailed") });
    } else if (res.status === "wrong_admin_code") {
      setMsg({ ok: false, text: t("errWrongAdminCode") });
    } else if (res.status === "code_expired") {
      setLinkStep(null);
      setMsg({ ok: false, text: t("errCodeExpired") });
    } else if (res.status === "too_many_attempts") {
      setLinkStep(null);
      setMsg({ ok: false, text: t("errTooMany") });
    } else if (res.status === "factory_error") {
      setMsg({ ok: false, text: t("errFactory") });
    } else if (res.status === "no_pending") {
      setLinkStep(null);
      setMsg({ ok: false, text: t("errRetry") });
    } else {
      setMsg({ ok: false, text: t("errGeneric") });
    }
  }

  function cancelLink() {
    setLinkStep(null);
    setAdminCode("");
    setPendingEmail("");
    setMsg(null);
  }

  // يربط الرابط يدويًا مع باب كود المشرف (مرة واحدة أول جهاز). عند الحاجة
  // للكود (جهاز جديد) يُرجع الخادم pending فيدخل المستخدم الكود ثم نعيد المحاولة.
  async function handleSaveManual(e?: React.FormEvent) {
    e?.preventDefault();
    const url = manualInput.trim();
    if (!url) return;
    const wasLinked = Boolean(sheetUrl);
    setLoading(true);
    setMsg(null);
    const res = await setWebhook(url, manualStep ? adminCode : undefined);
    setLoading(false);
    if (res.status === "ok") {
      setMsg({ ok: true, text: wasLinked ? t("okReplaced") : t("okSaved") });
      setManualInput("");
      setAdminCode("");
      setManualStep(null);
    } else if (res.status === "pending" && res.step === "manual") {
      setManualStep("admin");
      setMsg({ ok: true, text: t("manualCodeSent") });
    } else if (res.status === "bad_webhook") {
      setMsg({ ok: false, text: t("errSave") });
    } else if (res.status === "email_config") {
      setMsg({ ok: false, text: t("errFactoryConfig") });
    } else if (res.status === "email_failed") {
      setMsg({ ok: false, text: t("errEmailFailed") });
    } else if (res.status === "wrong_admin_code") {
      setMsg({ ok: false, text: t("errWrongAdminCode") });
    } else if (res.status === "code_expired") {
      setManualStep(null);
      setMsg({ ok: false, text: t("errCodeExpired") });
    } else if (res.status === "too_many_attempts") {
      setManualStep(null);
      setMsg({ ok: false, text: t("errTooMany") });
    } else if (res.status === "no_pending") {
      setManualStep(null);
      setMsg({ ok: false, text: t("errRetry") });
    } else {
      setMsg({ ok: false, text: t("errSave") });
    }
  }

  function cancelManual() {
    setManualStep(null);
    setAdminCode("");
    setMsg(null);
  }

  async function handleTest() {
    if (!sheetUrl) return;
    setTesting(true);
    setMsg(null);
    try {
      await fetch(sheetUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ timestamp: new Date().toISOString(), test: true }),
      });
      setMsg({
        ok: true,
        text: t("testSent"),
      });
    } catch {
      setMsg({ ok: false, text: t("testFailed") });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-navy-900/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161b22]">
        <div className="flex items-center justify-between border-b border-navy-900/10 px-6 py-4 dark:border-white/10">
          <h2 className="font-display text-lg font-extrabold text-navy-900 dark:text-ivory-50">{t("settingsTitle")}</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={onClose} className="text-xs font-bold text-navy-900/50 transition hover:text-navy-900 dark:text-ivory-50/50 dark:hover:text-ivory-50">
              {t("close")}
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6">
          {/* ── لافتة إشعار الأدمن للمستخدم ── */}
          {notice && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
              <span aria-hidden className="mt-0.5 text-amber-600">⚠</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">رسالة من الإدارة</p>
                <p className="mt-0.5 text-[12px] font-semibold leading-5 text-amber-900">{notice}</p>
              </div>
              <button
                type="button"
                className="shrink-0 text-[11px] font-semibold text-amber-700/70 transition hover:text-amber-900"
                aria-label="إغلاق الإشعار مؤقتاً"
                onClick={() => setDismissedNotice(true)}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── الحالة ── */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-display text-sm font-extrabold text-navy-900">{t("sheetLabel")}</span>
            {sheetUrl ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">{t("linked")}</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800">{t("notLinked")}</span>
            )}
            {linkedEmail && (
              <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[10px] font-semibold text-navy-700">{linkedEmail}</span>
            )}
          </div>

          {/* ── زر «نوعية الاشتراك» + لوحة التفاصيل الملوّنة ── */}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setShowSub((v) => !v)}
              className="flex items-center justify-between gap-2 rounded-xl border border-navy-900/15 bg-navy-50 px-4 py-3 text-xs font-bold text-navy-800 transition hover:border-navy-500 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-sm">★</span>
                {t("subBtn")}
              </span>
              {sub.isPlan ? (
                <span className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${subToneCls}`}>
                    {sub.planText}
                  </span>
                  <span className="text-[10px] font-bold text-navy-700 dark:text-ivory-50/80">
                    {sub.timeText}
                  </span>
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${subToneCls}`}>
                  {sub.timeText}
                </span>
              )}
            </button>
            {showSub && (
              <div className={`rounded-2xl p-4 ${subToneCls}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{t("subBtn")}</p>
                {sub.isPlan ? (
                  <>
                    <p className="mt-1 text-base font-extrabold leading-7">{sub.planText}</p>
                    <p className="text-xs font-bold opacity-80">{sub.timeText}</p>
                  </>
                ) : (
                  <p className="mt-1 text-base font-extrabold leading-7">{sub.timeText}</p>
                )}
              </div>
            )}
          </div>

          {/* ── التبويبان ── */}
          <div className="flex rounded-full border border-navy-900/15 bg-ivory-100 p-1 text-xs font-bold">
            {/* تبويب «إنشاء الجدول تلقائيّاً» متاح دائماً لأنه يحوي خطوة ربط
                الإيميل الإجبارية (الشرط الأول)؛ يُقفل داخله زرّ إنشاء الجدول
                حتى يُربط الإيميل. */}
            <button
              type="button"
              onClick={() => setTab("email")}
              className={`flex-1 rounded-full px-4 py-1.5 transition ${
                tab === "email" ? "bg-navy-900 text-ivory-50" : "text-navy-700 hover:text-navy-900"
              }`}
            >
              {t("tabEmail")}
            </button>
            {/* تبويب «إنشاء الجدول يدويّاً» مقفل حتى يُربط الإيميل (اقتراح 1). */}
            <button
              type="button"
              onClick={() => setTab("manual")}
              disabled={!emailLinked}
              className={`flex-1 rounded-full px-4 py-1.5 transition ${
                !emailLinked
                  ? "cursor-not-allowed text-navy-900/30"
                  : tab === "manual"
                  ? "bg-navy-900 text-ivory-50"
                  : "text-navy-700 hover:text-navy-900"
              }`}
            >
              {t("tabManual")}
            </button>
          </div>

          {/* لافتة إرشادية تظهر قبل ربط الإيميل — توضّح أن الربط مقفل حتى يُربط البريد */}
          {!emailLinked && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-amber-800">
              {t("emailRequiredHint")}
            </p>
          )}

          {/* ── تبويب البريد (تلقائي) ──
              الشرط الأول دائماً: إدخال الإيميل وربطه. قبل الربط نعرض نموذج
              الإيميل فقط. بعد نجاح الربط نعرض خيار إنشاء الجدول تلقائيّاً
              (أو بطاقة الجدول المربوط). */}
          {tab === "email" && (
            <section className="grid gap-3">
              {/* ── خطوة ربط الإيميل (الشرط الأول — متاحة دائماً) ── */}
              {!emailLinked ? (
                linkStep === "admin" ? (
                  <form onSubmit={handleLinkEmail} className="grid gap-3">
                    <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-navy-800">
                      {t("linkAdminCodeInfo", { email: pendingEmail })}
                    </p>
                    <input
                      className={`${inputCls} text-center font-display text-lg font-bold tracking-[0.4em]`}
                      dir="ltr"
                      placeholder="000000"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      autoFocus
                    />
                    <button className={primaryBtn} type="submit" disabled={loading || adminCode.length !== 6}>
                      {loading ? t("checking") : t("confirmAdminCode")}
                    </button>
                    <button type="button" className="text-center text-[11px] font-semibold text-navy-900/50 transition hover:text-navy-900" onClick={cancelLink}>
                      {t("cancel")}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleLinkEmail} className="grid gap-2">
                    <input
                      className={inputCls}
                      dir="ltr"
                      type="email"
                      placeholder="your@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                    />
                    <button className={primaryBtn} type="submit" disabled={loading || !emailInput.trim()}>
                      {loading ? t("creating") : t("createSheet")}
                    </button>
                  </form>
                )
              ) : (
                /* ── بعد ربط الإيميل: إنشاء الجدول تلقائيّاً (أو البطاقة) ── */
                <>
                  <p className="text-[11px] leading-5 text-navy-900/70">
                    {t("emailTabDesc")}
                  </p>

                  {/* بطاقة عند وجود رابط مربوط (سواء عبر البريد أو يدويًا) */}
                  {sheetUrl ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      {linkedEmail && (
                        <p className="text-xs font-bold text-emerald-800">{t("linkedEmail", { email: linkedEmail })}</p>
                      )}
                      {viewUrl ? (
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block break-all text-[11px] text-emerald-700 underline"
                        >
                          {t("openSheet")}
                        </a>
                      ) : (
                        <p className="mt-2 text-[11px] text-amber-700">
                          الجدول قيد الإعداد — أعد ربط بريدك لتفعيل رابطه.
                        </p>
                      )}
                      {linkedEmail && (
                        <div className="mt-3 rounded-xl border border-navy-900/10 bg-white p-3">
                          <p className="mb-2 text-[10px] font-bold text-navy-900/60">{t("columns")}</p>
                          <div className="flex flex-wrap gap-1">
                            {SHEET_HEADERS.map((h) => (
                              <span
                                key={h}
                                className="rounded-full bg-navy-50 px-2.5 py-1 text-[10px] font-semibold text-navy-800"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* إدارة رابط الجدول: استبدال أو إزالة */}
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          className={ghostBtn}
                          onClick={() => setTab("manual")}
                          disabled={loading}
                        >
                          {t("replaceLink")}
                        </button>
                        <button
                          type="button"
                          className={primaryBtn}
                          onClick={async () => {
                            if (!window.confirm(t("removeConfirm"))) return;
                            setLoading(true);
                            setMsg(null);
                            const ok = await clearLink();
                            setLoading(false);
                            if (ok) setMsg({ ok: true, text: t("okRemoved") });
                            else setMsg({ ok: false, text: t("errGeneric") });
                          }}
                          disabled={loading}
                        >
                          {loading ? t("removing") : t("removeLink")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleLinkEmail} className="grid gap-2">
                      <input
                        className={inputCls}
                        dir="ltr"
                        type="email"
                        placeholder="your@email.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                      />
                      <button className={primaryBtn} type="submit" disabled={loading || !emailInput.trim()}>
                        {loading ? t("creating") : t("createSheet")}
                      </button>
                    </form>
                  )}
                </>
              )}
            </section>
          )}

          {/* ── تبويب اليدوي (لصق الرابط) ── */}
          {tab === "manual" && emailLinked && (
            <section className="grid gap-3">
              {manualStep === "admin" ? (
                <form onSubmit={handleSaveManual} className="grid gap-3">
                  <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-navy-800">
                    {t("manualCodeInfo")}
                  </p>
                  <input
                    className={`${inputCls} text-center font-display text-lg font-bold tracking-[0.4em]`}
                    dir="ltr"
                    placeholder="000000"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    autoFocus
                  />
                  <button className={primaryBtn} type="submit" disabled={loading || adminCode.length !== 6}>
                    {loading ? t("checking") : t("confirmAdminCode")}
                  </button>
                  <button type="button" className="text-center text-[11px] font-semibold text-navy-900/50 transition hover:text-navy-900" onClick={cancelManual}>
                    {t("cancel")}
                  </button>
                </form>
              ) : (
                <>
                  <ol className="list-decimal space-y-1.5 rounded-2xl border border-navy-900/10 bg-ivory-50 p-4 text-xs leading-5 text-navy-900/80">
                    <li className="ms-4">{t("manualStep1")}</li>
                    <li className="ms-4">{t("manualStep2")}</li>
                    <li className="ms-4">{t("manualStep3")}</li>
                    <li className="ms-4">{t("manualStep4")}</li>
                    <li className="ms-4">{t("manualStep5")}</li>
                    <li className="ms-4">{t("manualStep6")}</li>
                  </ol>
                  <input
                    className={inputCls}
                    dir="ltr"
                    placeholder="https://script.google.com/macros/s/AKfycb…/exec"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={primaryBtn}
                      onClick={handleSaveManual}
                      disabled={loading || !manualInput.trim()}
                    >
                      {loading ? t("saving") : t("saveLink")}
                    </button>
                    {sheetUrl && (
                      <button className={ghostBtn} onClick={handleTest} disabled={testing}>
                        {testing ? t("sending") : t("sendTest")}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] leading-5 text-navy-900/50">
                    {t("manualNote")}
                  </p>
                </>
              )}
            </section>
          )}

          {/* ── رسالة الحالة ── */}
          {msg && (
            <p
              className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}
            >
              {msg.text}
            </p>
          )}

          {/* ── خروج ── */}
          <section className="border-t border-navy-900/10 pt-5">
            <button
              className="rounded-full border border-red-300 px-5 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
              onClick={logout}
            >
              {t("logout")}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
