"use client";

// لوحة تجربة الڤيست — تظهر للزائر عند محاولة النشر في وضع الكيست.
//
// وفق docs/SPEC-guest-trial.md:
//   • إيميل + رقم واتساب (**إجباريان**) بلا رمز تحقّق
//   • رابط واحد فقط لمنتج واحد بصورة واحدة · 24 ساعة · حرق نهائي
//   • الحذف اليدوي **نهائي** ⇒ نافذة تأكيد إلزامية
//   • الهويات الثلاث (إيميل/جهاز/واتساب) كلها مرة واحدة

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { computeDeviceFingerprint } from "@/app/lib/auth";
import { useLocale } from "@/app/components/LocaleProvider";
import type { Product } from "@/app/lib/types";

const COPY = {
  ar: {
    title: "رابط تجريبي مجاني",
    lead: "نمنحك رابطاً حقيقياً واحداً يعمل 24 ساعة فقط. أدخل بريدك ورقم واتسابك لتصلك طلبات الزبائن عليه. التجربة للعملاء الجدد فقط: بريد جديد + جهاز جديد + رقم جديد.",
    email: "البريد الإلكتروني",
    emailPh: "you@example.com",
    whatsapp: "رقم الواتساب (إجباري)",
    whatsappPh: "213555123456",
    waHint: "يبدأ الرقم بـ 213 (رمز الجزائر) — مثال: 213555123456. لا تكتب 0 في البداية.",
    waSendCode: "أرسل رمز التفعيل عبر واتساب",
    waResend: "أعد إرسال الرمز",
    codeSent: "✓ فُتح واتساب — انسخ الرمز والصقه أدناه.",
    codeLabel: "رمز التفعيل (6 أرقام)",
    codePh: "••••••",
    codeHint: "افتح واتساب، انسخ الرمز الذي وصلك، والصقه هنا — ثم اضغط «تأكيد الرمز».",
    verifyCode: "تأكيد الرمز",
    verifying: "جارٍ التأكيد…",
    codeOk: "✓ الرمز صحيح — اضغط «أنشئ الرابط التجريبي».",
    errVerifyFirst: "أكّد الرمز أولاً بالزر أعلاه — ثم أنشئ الرابط.",
    errCodeRequired: "أرسل رمز التفعيل عبر واتساب أولاً — الزر الأخضر فوق خانة الرمز.",
    errCode: "أدخل رمز التفعيل المكوّن من 6 أرقام.",
    errCodeBad: "الرمز غير صحيح — تأكد من آخر رسالة وصلتك على واتساب.",
    errCodeExpired: "انتهت صلاحية الرمز — أرسل رمزاً جديداً.",
    errCodeLocked: "محاولات خاطئة كثيرة — أرسل رمزاً جديداً عبر واتساب.",
    errCodeMismatch: "الرمز مرتبط ببريد/جهاز آخر — أرسل رمزاً جديداً بنفس البيانات.",
    errRate: "طلبات كثيرة — انتظر قليلاً قبل إرسال رمز جديد.",
    restore: "استعادة حالة رابط سابق",
    checking: "جارٍ التحقق من الرابط…",
    ended: "انتهت التجربة أو حُذف الرابط. لا يمكن إنشاء تجربة أخرى.",
    converted: "أصبح رابطك تابعاً لاشتراك؛ أدره من الاستوديو.",
    submit: "أنشئ الرابط التجريبي",
    busy: "جارٍ الإنشاء…",
    cancel: "إلغاء",
    terms: "بالمتابعة تقبل: رابط واحد فقط لكل بريد وجهاز ورقم · يُرفض الرابط إن كان البريد أو الجهاز أو الرقم مسجلاً لدى مشترك · يختفي نهائياً بعد 24 ساعة · لا يمكن استرجاعه أو إنشاء رابط آخر.",
    okTitle: "رابطك جاهز",
    copy: "انسخ الرابط",
    copied: "تم النسخ ✓",
    open: "افتح الرابط",
    remaining: "الوقت المتبقي",
    del: "احذف الرابط",
    delConfirmTitle: "تأكيد الحذف",
    delConfirmBody: "لن تتمكّن من إنشاء رابط جديد بعد الحذف — لا بهذا البريد ولا بهذا الجهاز ولا بهذا الرقم. هل أنت متأكد؟",
    delYes: "نعم، احذف نهائياً",
    delNo: "تراجع",
    deleted: "حُذف الرابط.",
    subscribe: "اشترك للحفاظ على صفحتك",
    errEmail: "البريد الإلكتروني غير صالح.",
    errWhatsapp: "رقم الواتساب غير صالح — أدخل أرقاماً فقط (8 خانات على الأقل).",
    errSubscribed: "هذا البريد مشترك لدينا بالفعل — سجّل الدخول إلى الاستوديو بدلاً من التجربة.",
    errWhatsappSubscribed: "رقم الواتساب هذا مسجّل لدى مشترك — التجربة للعملاء الجدد فقط (رقم جديد + جهاز جديد + بريد جديد).",
    errDeviceSubscribed: "هذا الجهاز مرتبط بحساب مشترك — التجربة للعملاء الجدد فقط. جرّب من جهاز آخر.",
    errEmailUsed: "هذا البريد استعمل تجربة سابقاً. لكل بريد رابط واحد فقط.",
    errDeviceUsed: "هذا الجهاز استعمل تجربة سابقاً. لكل جهاز رابط واحد فقط.",
    errWhatsappUsed: "رقم الواتساب هذا استُعمل في تجربة سابقة. لكل رقم رابط واحد فقط.",
    errName: "اكتب اسم المنتج في المسودة أولاً.",
    errProduct: "أكمل خانات المنتج أولاً: الاسم · السعر · الصورة · العنوان · الوصف · مميزة واحدة على الأقل.",
    errGeneric: "تعذّر إنشاء الرابط — حاول بعد قليل.",
    disabledTitle: "خاصية الرابط التجريبي غير متاحة الآن",
    disabledMsg: "عذراً، تم تعطيل إنشاء الروابط التجريبية مؤقتاً من قبل الإدارة. حاول مرة أخرى لاحقاً.",
    errTrialsDisabled: "خاصية الرابط التجريبي غير متاحة الآن.",
  },
  en: {
    title: "Free trial link",
    lead: "We give you one real link that works for 24 hours only. Enter your email and WhatsApp number so your customers' orders reach you. Trials are for new customers only: new email + new device + new number.",
    email: "Email address",
    emailPh: "you@example.com",
    whatsapp: "WhatsApp number (required)",
    whatsappPh: "213555123456",
    waHint: "Starts with 213 (Algeria code) — e.g. 213555123456. Do not write 0 at the start.",
    waSendCode: "Send activation code via WhatsApp",
    waResend: "Resend code",
    codeSent: "✓ WhatsApp opened — copy the code and paste it below.",
    codeLabel: "Activation code (6 digits)",
    codePh: "••••••",
    codeHint: "Open WhatsApp, copy the code you received, paste it here — then press “Verify code”.",
    verifyCode: "Verify code",
    verifying: "Verifying…",
    codeOk: "✓ Code accepted — press “Create my trial link”.",
    errVerifyFirst: "Verify the code first with the button above — then create the link.",
    errCodeRequired: "Send the activation code via WhatsApp first — the green button above the code field.",
    errCode: "Enter the 6-digit activation code.",
    errCodeBad: "Wrong code — check the last message you received on WhatsApp.",
    errCodeExpired: "Code expired — request a new one.",
    errCodeLocked: "Too many wrong attempts — request a new code via WhatsApp.",
    errCodeMismatch: "Code is linked to another email/device — request a new code with the same details.",
    errRate: "Too many requests — wait a moment before requesting a new code.",
    restore: "Restore an existing trial",
    checking: "Checking your link…",
    ended: "The trial has expired or been deleted. Another trial cannot be created.",
    converted: "Your link now belongs to a subscription. Manage it in the studio.",
    submit: "Create my trial link",
    busy: "Creating…",
    cancel: "Cancel",
    terms: "By continuing you accept: one link per email, device and number · the link is refused if the email, device or number belongs to a subscriber · it disappears permanently after 24 hours · it cannot be restored or re-created.",
    okTitle: "Your link is ready",
    copy: "Copy link",
    copied: "Copied ✓",
    open: "Open link",
    remaining: "Time remaining",
    del: "Delete link",
    delConfirmTitle: "Confirm deletion",
    delConfirmBody: "You will NOT be able to create another link — not with this email, device or number. Are you sure?",
    delYes: "Yes, delete permanently",
    delNo: "Go back",
    deleted: "Link deleted.",
    subscribe: "Subscribe to keep your page",
    errEmail: "Invalid email address.",
    errWhatsapp: "Invalid WhatsApp number — digits only (at least 8).",
    errSubscribed: "This email already has a subscription — sign in to the studio instead.",
    errWhatsappSubscribed: "This WhatsApp number is registered to a subscriber — trials are for new customers only (new number + new device + new email).",
    errDeviceSubscribed: "This device is linked to a subscriber account — trials are for new customers only. Try another device.",
    errEmailUsed: "This email already used a trial. One link per email.",
    errDeviceUsed: "This device already used a trial. One link per device.",
    errWhatsappUsed: "This WhatsApp number already used a trial. One link per number.",
    errName: "Enter the product name in the draft first.",
    errProduct: "Complete the product fields first: name · price · image · tagline · description · at least one feature.",
    errGeneric: "Could not create the link — please try again shortly.",
    disabledTitle: "Trial links are temporarily unavailable",
    disabledMsg: "Sorry — creating trial links has been disabled by the administrator. Please try again later.",
    errTrialsDisabled: "The trial-link feature is currently unavailable.",
  },
} as const;

const pad = (n: number) => String(n).padStart(2, "0");

function fmt(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

const TRIAL_EMAIL_KEY = "spectre-trial-email";

export function TrialPanel({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { lang } = useLocale();
  const c = COPY[lang === "ar" ? "ar" : "en"];

  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeOk, setCodeOk] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [made, setMade] = useState<{ url: string; slug: string; expiresAt: string } | null>(null);
  const [fp, setFp] = useState("");
  const [left, setLeft] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [converted, setConverted] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [closed, setClosed] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);

  async function restore(address: string, fingerprint: string) {
    if (!address || !fingerprint) return;
    setRestoring(true);
    setRestoreFailed(false);
    setError("");
    try {
      const query = new URLSearchParams({ email: address.trim().toLowerCase(), fingerprint });
      const r = await fetch(`/api/trial/status?${query}`, { cache: "no-store" });
      if (!alive.current) return;
      if (r.status === 404) {
        setMade(null);
        setDeleted(false);
        setConverted(false);
        try { localStorage.removeItem(TRIAL_EMAIL_KEY); } catch { /* تخزين اختياري */ }
        return;
      }
      const data = await r.json();
      if (!r.ok || typeof data.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(data.slug) ||
          !Number.isFinite(Date.parse(data.expiresAt)) ||
          !["active", "expired", "burned", "deleted", "converted"].includes(data.status)) throw new Error("invalid_trial");
      const isConverted = data.status === "converted";
      setEmail(address.trim().toLowerCase());
      setConverted(isConverted);
      const ended = !isConverted && (data.status !== "active" || data.expired || Date.parse(data.expiresAt) <= Date.now());
      setDeleted(ended);
      setMade(ended ? null : { url: `${window.location.origin}/p/${data.slug}`, slug: data.slug, expiresAt: data.expiresAt });
      try { localStorage.setItem(TRIAL_EMAIL_KEY, JSON.stringify({ email: address.trim().toLowerCase(), fp: fingerprint })); } catch { /* تخزين اختياري */ }
    } catch {
      if (alive.current) setRestoreFailed(true);
    } finally {
      if (alive.current) setRestoring(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    // حالة التعطيل العامة — تُقرأ فوراً لتُعطّل الخانتين قبل أي محاولة إدخال.
    void fetch("/api/trial/availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.disabled) setClosed(true); })
      .catch(() => { /* القراءة فقط — نفترض المتاح */ });
    void computeDeviceFingerprint().then(async (fingerprint) => {
      if (cancelled) return;
      setFp(fingerprint);
      let saved: { email?: string; fp?: string } | null = null;
      try { saved = JSON.parse(localStorage.getItem(TRIAL_EMAIL_KEY) || "null"); } catch { /* تخزين اختياري */ }
      if (saved?.fp === fingerprint && typeof saved.email === "string") {
        setEmail(saved.email);
        await restore(saved.email, fingerprint);
      } else setRestoring(false);
    }).catch(() => { if (!cancelled) { setFp(""); setRestoring(false); } });
    return () => { cancelled = true; alive.current = false; };
  }, []);

  // عدّاد — لا يُحسب على الخادم (منع خطأ الترطيب)
  useEffect(() => {
    if (!made) return;
    const target = new Date(made.expiresAt).getTime();
    setMounted(true);
    const tick = () => setLeft(target - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [made]);

  // إرسال رمز التفعيل عبر واتساب — يفتح wa.me برسالة جاهزة تحوي الرمز
  async function sendCode() {
    if (sending || busy || closed || !fp) return;
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(c.errEmail);
    if (!/^\d{8,15}$/.test(whatsapp.replace(/[^\d]/g, "").replace(/^00/, ""))) return setError(c.errWhatsapp);

    // ⚠️ حاسم: window.open يجب أن يحدث **متزامناً** داخل ضغطة المستخدم — أي await
    // قبله يفقد «سياق الإيماءة» فتحجبه المتصفحات (مانع النوافذ المنبثقة). لذلك
    // نفتح صفحة فارغة فوراً ثم نوجّهها إلى wa.me بعد وصول ردّ الخادم.
    // هذا كان سبب «الرمز لا يصل / واتساب لا يفتح».
    const win = window.open("", "_blank");

    setSending(true);
    try {
      const res = await fetch("/api/trial/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), whatsapp: whatsapp.trim(), deviceFp: fp }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; waUrl?: string; error?: string };
      if (res.ok && data.waUrl) {
        setCodeSent(true);
        setCode("");
        setCodeOk(false);
        if (win) win.location.href = data.waUrl;
        else window.location.href = data.waUrl; // سقوط: المانع حجب — ننقل الصفحة
      } else {
        if (win) win.close();
        // الرفض المباشر قبل توليد الرمز — كل سبب برسالة صريحة (لا تعميم).
        const map: Record<string, string> = {
          rate_limited: c.errRate,
          already_subscribed: c.errSubscribed,
          whatsapp_subscribed: c.errWhatsappSubscribed,
          device_subscribed: c.errDeviceSubscribed,
          trial_used: c.errEmailUsed,
          device_used: c.errDeviceUsed,
          whatsapp_used: c.errWhatsappUsed,
          trials_disabled: c.errTrialsDisabled,
          bad_email: c.errEmail,
          bad_whatsapp: c.errWhatsapp,
        };
        setError(map[String(data.error ?? "")] ?? c.errGeneric);
      }
    } catch {
      if (win) win.close();
      setError(c.errGeneric);
    } finally {
      setSending(false);
    }
  }

  // تأكيد الرمز مسبقاً — يجيب «صحيح أم خاطئ» قبل ضغطة الإنشاء، بنفس حكم
  // الخادم (`checkTrialCodeRecord`) دون استهلاك الرمز أو زيادة العدّاد.
  async function verifyCode() {
    if (verifying || busy || closed || !fp || !codeSent) return;
    setError("");
    if (!/^\d{6}$/.test(code)) return setError(c.errCode);
    setVerifying(true);
    try {
      const res = await fetch("/api/trial/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), whatsapp: whatsapp.trim(), deviceFp: fp, code: code.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setCodeOk(true);
        return;
      }
      setCodeOk(false);
      const map: Record<string, string> = {
        bad_code: c.errCodeBad,
        code_expired: c.errCodeExpired,
        code_locked: c.errCodeLocked,
        code_mismatch: c.errCodeMismatch,
        code_required: c.errCodeRequired,
        rate_limited: c.errRate,
      };
      setError(map[String(data.error ?? "")] ?? c.errGeneric);
    } catch {
      setCodeOk(false);
      setError(c.errGeneric);
    } finally {
      setVerifying(false);
    }
  }

  async function submit() {
    if (inFlight.current || restoring || restoreFailed || made || deleted || closed) return;
    setError("");
    // شروط إلزامية (نفس شرط الواجهة + الخادم) — نُنبّه مبكراً برسالة واضحة
    const incomplete =
      !product.name?.trim() ||
      !(Number(product.price) > 0) ||
      !product.image ||
      !product.tagline?.trim() ||
      !product.description?.trim() ||
      !(Array.isArray(product.features) && product.features.some((f) => f?.title?.trim() && f?.copy?.trim()));
    if (incomplete) return setError(c.errProduct);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError(c.errEmail);
    if (!/^\d{8,15}$/.test(whatsapp.replace(/[^\d]/g, "").replace(/^00/, ""))) return setError(c.errWhatsapp);
    // رمز التفعيل — شرط أساسي: 6 أرقام بعد الإرسال **وتأكيد مسبق بالزر**
    if (!codeSent) return setError(c.errCodeRequired);
    if (!/^\d{6}$/.test(code)) return setError(c.errCode);
    if (!codeOk) return setError(c.errVerifyFirst);
    if (!fp) return setError(c.errGeneric);

    inFlight.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/trial/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          deviceFp: fp,
          code: code.trim(),
          name: product.name,
          price: product.price,
          category: product.category ?? "",
          tagline: product.tagline ?? "",
          description: product.description ?? "",
          features: Array.isArray(product.features) ? product.features : [],
          // صورة واحدة فقط
          image: product.image ?? "",
          // ثيم الاستوديو المختار (يُعقَّم خادمياً)
          theme: product.theme ?? undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        const map: Record<string, string> = {
          bad_email: c.errEmail,
          bad_whatsapp: c.errWhatsapp,
          already_subscribed: c.errSubscribed,
          whatsapp_subscribed: c.errWhatsappSubscribed,
          device_subscribed: c.errDeviceSubscribed,
          trial_used: c.errEmailUsed,
          device_used: c.errDeviceUsed,
          whatsapp_used: c.errWhatsappUsed,
          trials_disabled: c.errTrialsDisabled,
          code_required: c.errCodeRequired,
          bad_code: c.errCodeBad,
          code_expired: c.errCodeExpired,
          code_locked: c.errCodeLocked,
          code_mismatch: c.errCodeMismatch,
        };
        setError(map[String(j.error ?? "")] ?? c.errGeneric);
        return;
      }
      if (typeof j.slug !== "string" || !/^[a-zA-Z0-9_-]+$/.test(j.slug) || !Number.isFinite(Date.parse(j.expiresAt))) throw new Error("invalid_trial");
      setMade({ url: `${window.location.origin}/p/${j.slug}`, slug: j.slug, expiresAt: j.expiresAt });
      try { localStorage.setItem(TRIAL_EMAIL_KEY, JSON.stringify({ email: email.trim().toLowerCase(), fp })); } catch { /* تخزين اختياري */ }
    } catch {
      setError(c.errGeneric);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function removeLink() {
    if (inFlight.current || !confirmDel || !fp || converted) return;
    inFlight.current = true;
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/trial", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), deviceFp: fp }),
      });
      if (r.ok) {
        setDeleted(true);
        setMade(null);
      } else {
        setError(c.errGeneric);
      }
    } catch {
      setError(c.errGeneric);
    } finally {
      inFlight.current = false;
      setBusy(false);
      setConfirmDel(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-[16px] text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50 dark:placeholder:text-ivory-50/35";
  const ghostBtn =
    "rounded-full border border-navy-900/15 px-4 py-2.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400";

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-navy-950/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-navy-900/15 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161b22]">
        <div className="bg-navy-900 px-5 py-4 text-center text-ivory-50">
          <p className="font-display text-lg font-extrabold">{c.title}</p>
        </div>

        <div className="grid gap-4 p-6">
          <button onClick={onClose} className={ghostBtn} disabled={busy}>{c.cancel}</button>
          {(error || restoreFailed) && <p role="alert" className="text-sm text-red-600">{error || c.errGeneric}</p>}
          {restoring ? <p role="status">{c.checking}</p> : restoreFailed ? (
            <button className={ghostBtn} onClick={() => void restore(email, fp)}>{c.restore}</button>
          ) : deleted ? (
            <>
              <p className="text-sm text-navy-800 dark:text-ivory-50/80">{c.ended}</p>
              <Link
                href="/pricing"
                className="rounded-full bg-amber-600 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-amber-700"
              >
                {c.subscribe}
              </Link>
              <button onClick={onClose} className={ghostBtn}>{c.cancel}</button>
            </>
          ) : made ? (
            <>
              <p className="text-sm font-bold text-navy-900 dark:text-ivory-50">{converted ? c.converted : c.okTitle}</p>
              <div className="rounded-xl border border-navy-900/10 bg-navy-50 px-3 py-2 text-xs break-all text-navy-800 dark:border-white/10 dark:bg-white/5 dark:text-ivory-50/85">
                {made.url}
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-2 text-center dark:bg-amber-400/10">
                <span className="block text-[10px] uppercase text-amber-800/70 dark:text-amber-100/70">{c.remaining}</span>
                <span className="font-mono text-lg font-bold tabular-nums text-amber-900 dark:text-amber-100">
                  {mounted ? fmt(left) : "--:--:--"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(made.url);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                  className="rounded-full bg-navy-900 px-4 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
                >
                  {copied ? c.copied : c.copy}
                </button>
                <a
                  href={made.url}
                  target="_blank"
                  rel="noreferrer"
                  className={ghostBtn}
                >
                  {c.open}
                </a>
                <button disabled={busy || converted || !fp} onClick={() => setConfirmDel(true)} className="rounded-full border border-red-500/40 px-4 py-2.5 text-xs font-bold text-red-600 transition hover:border-red-500">
                  {c.del}
                </button>
              </div>
              <Link
                href="/pricing"
                className="rounded-full bg-amber-600 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-amber-700"
              >
                {c.subscribe}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm leading-7 text-navy-800 dark:text-ivory-50/80">{c.lead}</p>

              {closed && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 dark:bg-amber-400/10"
                >
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-100">{c.disabledTitle}</p>
                  <p className="mt-1 text-xs leading-6 text-amber-800/85 dark:text-amber-100/75">{c.disabledMsg}</p>
                </div>
              )}

              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-navy-700 dark:text-ivory-50/70">{c.email}</span>
                <input
                  className={inputCls}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (codeSent) { setCodeSent(false); setCode(""); setCodeOk(false); } }}
                  placeholder={c.emailPh}
                  dir="ltr"
                  disabled={closed}
                  readOnly={closed}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-navy-700 dark:text-ivory-50/70">{c.whatsapp}</span>
                <input
                  className={inputCls}
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => { setWhatsapp(e.target.value); if (codeSent) { setCodeSent(false); setCode(""); setCodeOk(false); } }}
                  placeholder={c.whatsappPh}
                  dir="ltr"
                  disabled={closed}
                  readOnly={closed}
                />
                <span className="text-[11px] text-navy-900/50 dark:text-ivory-50/50">{c.waHint}</span>
                {/* زر إرسال رمز التفعيل عبر واتساب — يفتح wa.me برسالة جاهزة */}
                {whatsapp.trim() && email.trim() && !closed && (
                  <button
                    type="button"
                    onClick={() => void sendCode()}
                    disabled={sending || busy || !fp || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                    className="self-start rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 min-h-[44px] touch-manipulation sm:min-h-0"
                  >
                    {sending ? "…" : codeSent ? c.waResend : c.waSendCode}
                  </button>
                )}
                {codeSent && (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{c.codeSent}</span>
                )}
              </label>

              {/* خانة إدخال رمز التفعيل — تظهر بعد الإرسال (شرط أساسي لإنشاء الرابط) */}
              {codeSent && !closed && (
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-navy-700 dark:text-ivory-50/70">{c.codeLabel}</span>
                  <input
                    className={`${inputCls} text-center font-mono text-lg tracking-[0.4em]`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeOk(false); setError(""); }}
                    placeholder={c.codePh}
                    dir="ltr"
                    maxLength={6}
                    disabled={closed}
                  />
                  <span className="text-[11px] text-navy-900/50 dark:text-ivory-50/50">{c.codeHint}</span>
                  {/* زر تأكيد الرمز — يتحقق مسبقاً دون استهلاكه */}
                  <button
                    type="button"
                    onClick={() => void verifyCode()}
                    disabled={verifying || busy || closed || !fp || !/^\d{6}$/.test(code)}
                    className="self-start rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20 min-h-[44px] touch-manipulation sm:min-h-0"
                  >
                    {verifying ? c.verifying : c.verifyCode}
                  </button>
                  {codeOk && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{c.codeOk}</span>
                  )}
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </p>
              )}

              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-6 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
                {c.terms}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={submit}
                  disabled={busy || closed}
                  className="rounded-full bg-navy-900 px-5 py-3 text-sm font-bold text-ivory-50 transition hover:bg-navy-700 disabled:opacity-50"
                >
                  {busy ? c.busy : c.submit}
                </button>
                <button disabled={busy || !fp || !email.trim()} className={ghostBtn} onClick={() => void restore(email, fp)}>{c.restore}</button>
                <button onClick={onClose} className={ghostBtn}>{c.cancel}</button>
              </div>
            </>
          )}
        </div>

        {confirmDel && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-navy-950/80 p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-red-500/40 bg-white dark:bg-[#161b22]">
              <div className="bg-red-600 px-5 py-3 text-center text-sm font-extrabold text-white">
                {c.delConfirmTitle}
              </div>
              <div className="grid gap-3 p-5">
                <p className="text-sm leading-7 text-navy-800 dark:text-ivory-50/80">{c.delConfirmBody}</p>
                <button onClick={removeLink} disabled={busy} className="rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
                  {c.delYes}
                </button>
                <button onClick={() => setConfirmDel(false)} className={ghostBtn}>{c.delNo}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
