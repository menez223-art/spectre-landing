"use client";

// لافتة التجربة — تظهر أعلى صفحة الڤيست (/p/<slug>) للزائر:
//   • نص واضح أن النموذج تجريبي
//   • عدّاد تنازلي للوقت المتبقي
//   • زر بارز إلى /pricing لاختيار باقة مباشرة
//
// النص **يتبع لغة الصفحة** التي يختارها الزائر (عربي/إنجليزي) عبر useLandingLang.
// لا تُعرض لأي صفحة مشترك — المُمرِّر trialUntil هو ما يحدّد ذلك.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLandingLang } from "./LandingLang";

const COPY = {
  ar: {
    title: "هذه صفحة تجريبية",
    body: "النموذج أدناه للتجربة فقط، ويختفي نهائياً بعد انتهاء المدة.",
    remaining: "الوقت المتبقي",
    hours: "س",
    minutes: "د",
    seconds: "ث",
    cta: "اشترك الآن للحفاظ على صفحتك",
    expired: "انتهت مدة التجربة",
  },
  en: {
    title: "This is a trial page",
    body: "The form below is for trial only and disappears permanently when time runs out.",
    remaining: "Time remaining",
    hours: "h",
    minutes: "m",
    seconds: "s",
    cta: "Subscribe now to keep your page",
    expired: "The trial period has ended",
  },
} as const;

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function TrialBanner({ expiresAt }: { expiresAt: string | null }) {
  const { lang } = useLandingLang();
  const c = COPY[lang] ?? COPY.ar;

  const target = expiresAt ? new Date(expiresAt).getTime() : 0;

  // ⚠️ منع خطأ الترطيب (hydration): الخادم يحسب وقتاً والعميل يحسب آخر، فيختلف
  // النص ويكسر React. الحل: العدّاد **لا يُرسم على الخادم** — نرسم بديلاً ثابتاً
  // حتى يكتمل التركيب على العميل، ثم يبدأ العدّ الحقيقي.
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) return;
    setMounted(true);
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target) || target <= 0) return null;

  const done = mounted && remaining <= 0;
  const { h, m, s } = split(remaining);
  // قبل التركيب: عنصر نائب بعرض ثابت يمنع «قفز» التخطيط ويبقي الـSSR مطابقاً
  const clockText = mounted ? `${pad(h)}${c.hours} ${pad(m)}${c.minutes} ${pad(s)}${c.seconds}` : "--";

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      role="status"
      aria-live="polite"
      className="container-landing pt-3"
    >
      {/* لا أسلوب dark: هنا: سكربت منع وميض الوضع الداكن (theme-script.ts) يضع
          صنف .dark على <html> في كل الصفحات بما فيها /p/<slug>، فيُفعِّل
          أكواد dark: بغضّ النظر عن ثيم الصفحة. على ثيم فاتح كان النص الكهرماني
          الفاتح فوق خلفية شبه بيضاء (تباين ≈1.05:1) → مختفٍ تماماً في الوضع
          الداكن. اللافتة لها لوحتها المعتمة الخاصة دائماً (نفس نهج باقي الأقسام
          التي تعتمد ثيم CSS vars فقط) فتبقى مرئية على أي ثيم. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold">{done ? c.expired : c.title}</p>
          {!done && <p className="mt-0.5 text-xs opacity-80">{c.body}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {!done && (
            <div className="rounded-xl bg-amber-900/10 px-3 py-1.5 text-center">
              <span className="block text-[10px] uppercase opacity-70">{c.remaining}</span>
              <span className="font-mono text-sm font-bold tabular-nums">{clockText}</span>
            </div>
          )}

          <Link
            href="/pricing"
            className="rounded-full bg-amber-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-800"
          >
            {c.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
