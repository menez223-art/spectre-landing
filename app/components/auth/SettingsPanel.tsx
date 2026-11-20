"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthGate";
import { useLocale } from "../LocaleProvider";
import { ThemeToggle } from "../ThemeToggle";
import { apiSetMarketing } from "@/app/lib/auth";

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
  "neu-input";
const ghostBtn =
  "neu-btn neu-btn--muted";
const primaryBtn =
  "neu-btn";

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
  // حالة واجهة حذف الاشتراك النهائي (نافذة تأكيد + كتابة البريد)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { fingerprint } = useAuth();

  // مسار حذف الحساب (بمبادرة المستخدم) — يستدعي /api/auth/account/delete.
  // تأكيد البريد + تنظيف الجلسة المحلية + توجيه للرئيسية.
  async function handleDeleteAccount() {
    if (!fingerprint || deleteBusy) return;
    const expected = (account?.email ?? "").toLowerCase().trim();
    if (deleteConfirmInput.toLowerCase().trim() !== expected) {
      setDeleteError("البريد المُدخل لا يطابق حسابك.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/auth/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint, confirmEmail: deleteConfirmInput.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        try { localStorage.removeItem("landing-studio-session"); } catch {}
        try { localStorage.removeItem("studio-device-fingerprint-v1"); } catch {}
        window.location.href = "/";
        return;
      }
      const code = data.error ?? "storage";
      const map: Record<string, string> = {
        email_mismatch: "البريد المُدخل لا يطابق حسابك.",
        unauthorized: "الجلسة انتهت، أعد تسجيل الدخول.",
        banned: "هذا الجهاز محظور.",
        no_email: "لا يوجد بريد مربوط.",
      };
      setDeleteError(map[code] ?? "خطأ غير متوقع، حاول لاحقاً.");
    } catch {
      setDeleteError("خطأ في الشبكة، حاول لاحقاً.");
    } finally {
      setDeleteBusy(false);
    }
  }

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
    // subscription يُقرأ داخل setTick فقط عبر الحالة المحلية (tick) — لا نعتمد
    // على قيمته داخل الإغلاق، لذا لا حاجة لإدراجه وإعادة تشغيل المؤقت.
    if (!subscription || subscription.validityUnit !== "day") return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    tone: "purple" | "amber" | "green" | "red" | "gray";
    isPlan: boolean;
  } {
    if (!subscription) return { planText: "", timeText: t("subNone"), tone: "gray", isPlan: false };
    if (subscription.status === "banned")
      return { planText: "", timeText: subscription.reason ?? t("subBanned"), tone: "red", isPlan: false };
    if (subscription.status === "suspended" || subscription.status === "expired")
      return { planText: "", timeText: subscription.reason ?? t("subExpired"), tone: "red", isPlan: false };
    const plan = subscription.plan;
    const planText = plan === "gold" ? t("planGold") : plan === "pro" ? t("planPro") : t("planBasic");
    return {
      planText,
      timeText: subTimeText(),
      tone: plan === "gold" ? "amber" : plan === "pro" ? "purple" : "green",
      isPlan: true,
    };
  }
  const sub = subDetail();
  const subToneCls =
    sub.tone === "purple"
      ? "t-primary"
      : sub.tone === "amber"
      ? "t-warning"
      : sub.tone === "green"
      ? "t-success"
      : sub.tone === "red"
      ? "t-danger"
      : "t-muted";

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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="neu-card my-4 w-full max-w-2xl overflow-hidden sm:my-8">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base font-extrabold sm:text-lg">{t("settingsTitle")}</h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <button onClick={onClose} className="neu-btn neu-btn--muted !px-3 !py-1.5 !text-xs">
              {t("close")}
            </button>
          </div>
        </div>

        <div className="grid gap-5 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
          {/* ── لافتة إشعار الأدمن للمستخدم ── */}
          {notice && (
            <div className="neu-inset flex items-start gap-2 px-4 py-3 t-warning">
              <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="neu-eyebrow">{t("msgFromAdmin")}</p>
                <p className="mt-0.5 text-[12px] font-semibold leading-5">{notice}</p>
              </div>
              <button
                type="button"
                className="neu-circle neu-circle--sm shrink-0"
                aria-label="إغلاق الإشعار مؤقتاً"
                onClick={() => setDismissedNotice(true)}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* ── الحالة ── */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-extrabold">{t("sheetLabel")}</span>
            {sheetUrl ? (
              <span className="neu-badge neu-badge--success">{t("linked")}</span>
            ) : (
              <span className="neu-badge neu-badge--warning">{t("notLinked")}</span>
            )}
            {linkedEmail && (
              <span className="neu-badge">{linkedEmail}</span>
            )}
          </div>

          {/* ── زر «نوعية الاشتراك» + لوحة التفاصيل الملوّنة ── */}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setShowSub((v) => !v)}
              className="neu-btn neu-btn--block !justify-between !px-4 !py-3 !text-xs"
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-star text-sm" aria-hidden="true" />
                {t("subBtn")}
              </span>
              {sub.isPlan ? (
                <span className="flex items-center gap-1.5">
                  <span className={`neu-badge ${subToneCls}`}>
                    {sub.planText}
                  </span>
                  <span className="text-[10px] font-bold t-muted">
                    {sub.timeText}
                  </span>
                </span>
              ) : (
                <span className={`neu-badge ${subToneCls}`}>
                  {sub.timeText}
                </span>
              )}
            </button>
            {showSub && (
              <div className={`neu-inset p-4 ${subToneCls}`}>
                <p className="neu-eyebrow opacity-70">{t("subBtn")}</p>
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
          <div className="neu-inset flex gap-1 !rounded-full p-1 text-xs font-bold">
            {/* تبويب «إنشاء الجدول تلقائيّاً» متاح دائماً لأنه يحوي خطوة ربط
                الإيميل الإجبارية (الشرط الأول)؛ يُقفل داخله زرّ إنشاء الجدول
                حتى يُربط الإيميل. */}
            <button
              type="button"
              onClick={() => setTab("email")}
              className={`neu-tab flex-1 !rounded-full ${
                tab === "email" ? "is-active" : ""
              }`}
            >
              {t("tabEmail")}
            </button>
            {/* تبويب «إنشاء الجدول يدويّاً» مقفل حتى يُربط الإيميل (اقتراح 1). */}
            <button
              type="button"
              onClick={() => setTab("manual")}
              disabled={!emailLinked}
              className={`neu-tab flex-1 !rounded-full ${
                !emailLinked
                  ? "cursor-not-allowed opacity-40"
                  : tab === "manual"
                  ? "is-active"
                  : ""
              }`}
            >
              {t("tabManual")}
            </button>
          </div>

          {/* لافتة إرشادية تظهر قبل ربط الإيميل — توضّح أن الربط مقفل حتى يُربط البريد */}
          {!emailLinked && (
            <p className="neu-inset px-3 py-2.5 text-[11px] font-semibold leading-5 t-warning">
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
                    <p className="neu-inset px-3 py-2.5 text-[11px] font-medium leading-5 t-muted">
                      {t("linkAdminCodeInfo", { email: pendingEmail })}
                    </p>
                    <input
                      className={`${inputCls} text-center font-bold tracking-[0.4em]`}
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
                    <button type="button" className="neu-link text-center text-[11px] font-semibold" onClick={cancelLink}>
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
                  <p className="text-[11px] leading-5 t-muted">
                    {t("emailTabDesc")}
                  </p>

                  {/* بطاقة عند وجود رابط مربوط (سواء عبر البريد أو يدويًا) */}
                  {sheetUrl ? (
                    <div className="neu-inset p-4">
                      {linkedEmail && (
                        <p className="text-xs font-bold t-success">{t("linkedEmail", { email: linkedEmail })}</p>
                      )}
                      {viewUrl ? (
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="neu-link mt-2 block break-all text-[11px]"
                        >
                          {t("openSheet")}
                        </a>
                      ) : (
                        <p className="mt-2 text-[11px] t-warning">
                          الجدول قيد الإعداد — أعد ربط بريدك لتفعيل رابطه.
                        </p>
                      )}
                      {linkedEmail && (
                        <div className="neu-panel mt-3 p-3">
                          <p className="mb-2 text-[10px] font-bold t-muted">{t("columns")}</p>
                          <div className="flex flex-wrap gap-1">
                            {SHEET_HEADERS.map((h) => (
                              <span
                                key={h}
                                className="neu-badge"
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
                  <p className="neu-inset px-3 py-2.5 text-[11px] font-medium leading-5 t-muted">
                    {t("manualCodeInfo")}
                  </p>
                  <input
                    className={`${inputCls} text-center font-bold tracking-[0.4em]`}
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
                  <button type="button" className="neu-link text-center text-[11px] font-semibold" onClick={cancelManual}>
                    {t("cancel")}
                  </button>
                </form>
              ) : (
                <>
                  <ol className="neu-inset list-decimal space-y-1.5 p-4 text-xs leading-5">
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
                  <p className="text-[11px] leading-5 t-muted">
                    {t("manualNote")}
                  </p>
                </>
              )}
            </section>
          )}

          {/* ── رسالة الحالة ── */}
          {msg && (
            <p
              className={`neu-inset px-3 py-2 text-[11px] font-semibold ${
                msg.ok ? "t-success" : "t-danger"
              }`}
            >
              {msg.text}
            </p>
          )}

          {/* ── التسويق الاختياري: Meta Pixel + واتساب الطلبات ── */}
          {emailLinked && <MarketingSection />}

          {/* ── خروج ── */}
          <section className="pt-5">
            <button
              className="neu-btn neu-btn--danger !px-5 !py-2.5 !text-xs"
              onClick={logout}
            >
              {t("logout")}
            </button>
          </section>

          {/* ── حذف الاشتراك نهائياً (بمبادرة المستخدم) ── */}
          {emailLinked && (
            <section className="neu-inset mt-4 p-4">
              <h3 className="text-sm font-extrabold t-danger">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("deleteAccountTitle") || "حذف الاشتراك نهائياً"}
              </h3>
              <p className="mt-1 text-[11px] leading-5 t-muted">
                {t("deleteAccountWarning") || "سيتم حذف اشتراكك وكل صفحاتك وروابطك وملفك الشخصي نهائياً. لا يمكن التراجع. أجهزتك لن تُحظر لكن ستحتاج ربط بريد جديد لتفعيل حساب مستقبلي."}
              </p>
              <button
                type="button"
                className="neu-btn neu-btn--danger mt-3 !px-5 !py-2 !text-xs"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                {deleteBusy ? "..." : (t("deleteAccountBtn") || "حذف الاشتراك")}
              </button>
            </section>
          )}

          {/* ── نافذة تأكيد الحذف (مطالبة بكتابة البريد) ── */}
          {deleteConfirmOpen && emailLinked && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4"
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false); }}
            >
              <div className="neu-card w-full max-w-md p-6">
                <h4 className="text-base font-extrabold t-danger">
                  <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("deleteAccountTitle") || "حذف الاشتراك نهائياً"}
                </h4>
                <p className="mt-2 text-[12px] leading-5 t-muted">
                  {(t("deleteAccountConfirmHint") || "اكتب بريدك الإلكتروني ({email}) لتأكيد الحذف النهائي:").replace("{email}", account?.email ?? "")}
                </p>
                <input
                  className={inputCls + " mt-3"}
                  placeholder={account?.email ?? ""}
                  dir="ltr"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  autoFocus
                />
                {deleteError && (
                  <p className="neu-inset mt-2 px-3 py-2 text-[11px] font-semibold t-danger">
                    {deleteError}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className={ghostBtn + " flex-1"}
                    onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmInput(""); setDeleteError(null); }}
                    disabled={deleteBusy}
                  >
                    {t("cancel") || "إلغاء"}
                  </button>
                  <button
                    type="button"
                    className="neu-btn neu-btn--danger flex-1 !px-5 !py-2 !text-xs"
                    disabled={deleteBusy || deleteConfirmInput.toLowerCase().trim() !== (account?.email ?? "").toLowerCase().trim()}
                    onClick={handleDeleteAccount}
                  >
                    {deleteBusy ? "..." : (t("deleteAccountConfirmBtn") || "تأكيد الحذف النهائي")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── قسم التسويق الاختياري: Meta Pixel + واتساب استلام الطلبات ──
// يظهر فقط بعد ربط البريد (يُستخدم عند النشر). بلا أي أكواد على العميل:
// البيكسل = لصق معرّف، والواتساب = رقم. المنصة تحقن الاثنين في صفحته.
function MarketingSection() {
  const { account, fingerprint, refreshAccount } = useAuth();
  const { t } = useLocale();
  const [pixel, setPixel] = useState("");
  // TikTok Pixel: صيغة أبجدية رقمية (مثل CC3KVBDC77U4B4F4HKCG).
  const [tiktok, setTiktok] = useState("");
  const [wa, setWa] = useState("");
  const [storeName, setStoreName] = useState("");
  const [showPublicly, setShowPublicly] = useState(false);
  // وضع تغيير رقم الواتساب الجاري: بانتظار رمز الموافقة
  const [waVerifying, setWaVerifying] = useState(false);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mMsg, setMMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  // منبثقة Test Event Code: تفتح/تُغلق من زر صغير بجانب حقل البكسل.
  const [testCodeOpen, setTestCodeOpen] = useState(false);
  // قيمة Test Code الحالية (تُحفظ في الحساب عبر apiSetMarketing).
  const [pixelTestCode, setPixelTestCode] = useState("");
  // خطوة رمز المشرف لرقم الواتساب (مرة واحدة على الجهاز — نفس بروتوكول البريد)
  const [waCode, setWaCode] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    if (syncedFor === account.email) return;
    setPixel(account.pixelId ?? "");
    setTiktok(account.tiktokPixelId ?? "");
    setWa(account.whatsapp ?? "");
    setStoreName(account.storeName ?? "");
    setShowPublicly(Boolean(account.showNamePublicly));
    setPixelTestCode(account.pixelTestEventCode ?? "");
    setSyncedFor(account.email);
  }, [account, syncedFor]);

  // الحفظ العام: البيكسل + اسم المتجر + الظهور العام — لا يرسل الواتساب
  // إطلاقاً (يبقى الرقم المحفوظ كما هو) فتُفصل قناتا الحفظ تماماً.
  async function save() {
    if (!fingerprint || busy) return;
    setBusy(true);
    setMMsg(null);
    const res = await apiSetMarketing(
      fingerprint,
      pixel.trim(),
      pixelTestCode.trim(),
      tiktok.trim(),
      undefined,
      undefined,
      storeName.trim(),
      showPublicly && Boolean(storeName.trim())
    );
    setBusy(false);
    switch (res.status) {
      case "ok":
        setMMsg({ ok: true, text: t("marketingSaved") });
        void refreshAccount();
        break;
      case "unauthorized":
        setMMsg({ ok: false, text: t("errSession") });
        break;
      case "storage":
        setMMsg({ ok: false, text: t("errRetry") });
        break;
      default:
        setMMsg({ ok: false, text: t("errRetry") });
    }
  }

  // مسار تغيير رقم الواتساب المستقل: يرسل حقل الواتساب وحده (بلا لمس البقية).
  // أول مرة على الجهاز → pending → صندوق رمز المشرف؛ بعد التوثيق أي تعديل حر.
  async function startWhatsappChange() {
    if (!fingerprint || busy || waVerifying) return;
    if (!wa.trim()) {
      setMMsg({ ok: false, text: t("marketingErrWhatsapp") });
      return;
    }
    setBusy(true);
    setMMsg(null);
    const res = await apiSetMarketing(fingerprint, undefined, undefined, undefined, wa.trim());
    setBusy(false);
    switch (res.status) {
      case "ok":
        setMMsg({ ok: true, text: t("marketingSaved") });
        void refreshAccount();
        break;
      case "pending":
        setWaVerifying(true);
        setWaCode("");
        setMMsg({ ok: true, text: t("mktWhatsappCodeSent") });
        break;
      case "bad_whatsapp":
        setMMsg({ ok: false, text: t("marketingErrWhatsapp") });
        break;
      case "email_config":
        setMMsg({ ok: false, text: t("errFactoryConfig") });
        break;
      case "email_failed":
        setMMsg({ ok: false, text: t("errEmailFailed") });
        break;
      case "unauthorized":
        setMMsg({ ok: false, text: t("errSession") });
        break;
      default:
        setMMsg({ ok: false, text: t("errRetry") });
    }
  }

  // تأكيد رمز الموافقة — يرسل نفس الرقم مع الكود لإتمام الحفظ.
  async function confirmWhatsappCode() {
    if (!fingerprint || busy || waCode === null) return;
    setBusy(true);
    const res = await apiSetMarketing(fingerprint, undefined, undefined, undefined, wa.trim(), waCode);
    setBusy(false);
    switch (res.status) {
      case "ok":
        setWaVerifying(false);
        setWaCode(null);
        setMMsg({ ok: true, text: t("marketingSaved") });
        void refreshAccount();
        break;
      case "wrong_admin_code":
        setMMsg({ ok: false, text: t("errWrongAdminCode") });
        break;
      case "code_expired":
        setWaVerifying(false);
        setWaCode(null);
        setMMsg({ ok: false, text: t("errCodeExpired") });
        break;
      case "too_many_attempts":
        setWaVerifying(false);
        setWaCode(null);
        setMMsg({ ok: false, text: t("errTooMany") });
        break;
      case "no_pending":
        setWaVerifying(false);
        setMMsg({ ok: false, text: t("errRetry") });
        break;
      default:
        setMMsg({ ok: false, text: t("errRetry") });
    }
  }

  function cancelWhatsappChange() {
    setWaVerifying(false);
    setWaCode(null);
    setMMsg(null);
  }

  return (
    <section className="neu-inset grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{t("marketingSection")}</h3>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="neu-btn neu-btn--muted !px-2.5 !py-1 !text-[11px]"
        >
          <i className="fa-solid fa-circle-question" aria-hidden="true" /> {t("marketingGuideBtn")}
        </button>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold">{t("storeNameLabel")}</span>
        <input
          className={inputCls}
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder={t("storeNamePlaceholder")}
          maxLength={40}
        />
      </label>

      <label className="neu-inset flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-xs font-semibold">{t("showNameLabel")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={showPublicly}
          disabled={!storeName.trim()}
          onClick={() => setShowPublicly((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full [box-shadow:var(--shadow-inner-sm)] transition disabled:opacity-40 ${
            showPublicly && storeName.trim() ? "bg-[color-mix(in_srgb,var(--success-color)_30%,var(--bg-color))]" : "bg-[var(--bg-color)]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--bg-color)] [box-shadow:var(--shadow-outer-sm)] transition-all ${
              showPublicly && storeName.trim() ? "start-0.5" : "end-0.5"
            }`}
          />
        </button>
      </label>

      <label className="grid gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold">{t("pixelLabel")}</span>
          <button
            type="button"
            onClick={() => setTestCodeOpen(true)}
            className="neu-btn neu-btn--success !px-2.5 !py-0.5 !text-[11px]"
            aria-label="Meta Pixel Test Event Code"
          >
            <i className="fa-solid fa-flask" aria-hidden="true" /> Test Code
          </button>
        </span>
        <input
          className={inputCls}
          dir="ltr"
          inputMode="numeric"
          maxLength={30}
          value={pixel}
          onChange={(e) => setPixel(e.target.value.replace(/\D/g, "").slice(0, 30))}
          placeholder="123456789012345"
        />
        {pixelTestCode && (
          <span className="text-[11px] font-semibold t-success">
            <i className="fa-solid fa-circle t-success" aria-hidden="true" /> Test Event Code فعّال: <span className="font-mono">{pixelTestCode}</span>
          </span>
        )}
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold">{t("tiktokPixelLabel") || "TikTok Pixel"}</span>
        <input
          className={inputCls}
          dir="ltr"
          maxLength={30}
          value={tiktok}
          onChange={(e) => setTiktok(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 30))}
          placeholder="CC3KVBDC77U4B4F4HKCG"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold">{t("whatsappLabel")}</span>
        <input
          className={inputCls}
          dir="ltr"
          inputMode="tel"
          value={wa}
          onChange={(e) => setWa(e.target.value)}
          placeholder={t("whatsappPlaceholder")}
        />
      </label>

      {/* زر تغيير رقم الواتساب المستقل — يطلب رمز موافقة عند كل تغيير */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startWhatsappChange}
          disabled={busy || waVerifying}
          className="neu-btn neu-btn--success !px-4 !py-2 !text-xs disabled:opacity-40"
        >
          <i className="fa-solid fa-rotate-right" aria-hidden="true" /> {t("changeWhatsappBtn")}
        </button>
        {waVerifying && (
          <span className="text-[11px] font-semibold t-warning">
            {t("waVerifyPending")}
          </span>
        )}
      </div>

      {/* خطوة رمز المشرف — تظهر بعد ضغط زر التغيير */}
      {waCode !== null && (
        <div className="neu-inset grid gap-2 p-3">
          <p className="text-[11px] font-medium leading-5 t-warning">
            {t("mktWhatsappCodeInfo")}
          </p>
          <input
            className={`${inputCls} text-center font-bold tracking-[0.4em]`}
            dir="ltr"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={waCode}
            onChange={(e) => setWaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={confirmWhatsappCode}
              disabled={busy || waCode.length !== 6}
              className={primaryBtn}
            >
              {busy ? t("saving") : t("confirmAdminCode")}
            </button>
            <button type="button" onClick={cancelWhatsappChange} className={ghostBtn}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] leading-5 t-muted">{t("marketingHint")}</p>

      {/* الحفظ العام: البيكسل + الاسم + خيار الظهور (الواتساب يتغير من زره المستقل) */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? t("saving") : t("saveLink")}
        </button>
        {mMsg && (
          <span className={`text-[11px] font-semibold ${mMsg.ok ? "t-success" : "t-danger"}`}>
            {mMsg.text}
          </span>
        )}
      </div>

      {/* منبثقة دليل إنشاء البيكسل — خطوات مبسطة بلا أي أكواد */}
      {guideOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setGuideOpen(false);
          }}
        >
          <div className="neu-card w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 text-center">
              <p className="text-base font-extrabold t-primary">{t("guideTitle")}</p>
              <p className="mt-0.5 text-[11px] t-muted">{t("guideSub")}</p>
            </div>
            <div className="grid gap-3 p-5">
              <ol className="neu-inset list-decimal space-y-2 p-4 text-xs leading-6">
                <li className="ms-4">{t("guideStep1")}</li>
                <li className="ms-4">{t("guideStep2")}</li>
                <li className="ms-4">{t("guideStep3")}</li>
                <li className="ms-4">{t("guideStep4")}</li>
                <li className="ms-4">{t("guideStep5")}</li>
              </ol>
              <p className="neu-inset px-3 py-2 text-[11px] font-medium leading-5 t-success">
                {t("guideNote")}
              </p>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className={primaryBtn + " w-full"}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {testCodeOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTestCodeOpen(false);
          }}
        >
          <div className="neu-card w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 text-center">
              <p className="text-base font-extrabold t-primary">Meta Pixel Test Event Code</p>
              <p className="mt-0.5 text-[11px] t-muted">Events Manager → Test Events</p>
            </div>
            <div className="grid gap-3 p-5">
              <p className="neu-inset px-3 py-2 text-[11px] font-medium leading-5 t-success">
                {t("metaTestEventsHint")}
              </p>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold">Test Event Code</span>
                <input
                  className={inputCls}
                  dir="ltr"
                  maxLength={30}
                  value={pixelTestCode}
                  onChange={(e) => setPixelTestCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 30))}
                  placeholder="TEST12345"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!fingerprint || busy) return;
                    setBusy(true);
                    setMMsg(null);
                    const res = await apiSetMarketing(
                      fingerprint,
                      pixel.trim(),
                      pixelTestCode.trim(),
                      tiktok.trim(),
                      undefined,
                      undefined,
                      storeName.trim(),
                      showPublicly && Boolean(storeName.trim())
                    );
                    setBusy(false);
                    if (res.status === "ok") {
                      setMMsg({ ok: true, text: t("marketingSaved") });
                      void refreshAccount();
                      setTestCodeOpen(false);
                    } else if (res.status === "bad_test_code") {
                      setMMsg({ ok: false, text: "كود الاختبار غير صالح (4–30 حرف/رقم)." });
                    } else {
                      setMMsg({ ok: false, text: t("errRetry") });
                    }
                  }}
                  className={primaryBtn + " flex-1"}
                >
                  {busy ? t("saving") : t("saveLink")}
                </button>
                <button
                  type="button"
                  onClick={() => setTestCodeOpen(false)}
                  className="neu-btn neu-btn--muted !px-4 !py-2 !text-xs"
                >
                  {t("close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}
