"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";

// الوضع التجريبي (نافذة منبثقة عند الطلب فقط) — يسحب قالب الهبوط كاملاً،
// فيُحمَّل كسولاً كي لا يثقل حزمة الرئيسية التي يفتحها كل زائر أولاً.
const GuestStudio = dynamic(
  () => import("@/app/components/auth/GuestStudio").then((m) => m.GuestStudio),
  { ssr: false }
);

// المتجر العام انتقل إلى صفحة مستقلة /store (§10) — الرئيسية لم تعد تستورده.
const PublicStore = dynamic(
  () => import("@/app/components/catalog/PublicStore").then((m) => m.PublicStore),
  {
    ssr: false,
    loading: () => (
      <div className="container-landing py-16 lg:py-20">
        <div className="h-40 w-full animate-pulse rounded-3xl bg-navy-900/10 dark:bg-white/10" />
      </div>
    ),
  }
);
import { useLocale } from "@/app/components/LocaleProvider";
import { PageHeader } from "@/app/components/PageHeader";
import { PageFooter } from "@/app/components/PageFooter";
import { AdminLoginModal } from "@/app/components/AdminLoginModal";
import { StudioLink } from "@/app/components/StudioLink";

// الرئيسية — فهرس منتجات + مدخل الاستوديو
export default function Home() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGuest, setShowGuest] = useState(false);

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} hideOnScroll />

      {/* البطل */}
      <section className="relative overflow-hidden bg-navy-900 text-ivory-50">
        {/* كرات تدرّج متحركة — تأثير حيوي خفيف لا يثقل الأداء */}
        <div className="absolute -start-24 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-500/25 to-teal-500/15 blur-3xl animate-pulse" />
        <div className="absolute -end-16 bottom-0 h-80 w-80 rounded-full bg-gradient-to-tl from-emerald-500/20 to-cyan-500/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="container-landing relative py-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-ivory-50/15 bg-ivory-50/5 px-4 py-1.5 text-xs font-bold text-ivory-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ivory-300" />
              {t("heroBadge")}
            </p>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.15] sm:text-5xl lg:text-6xl">
              {t("heroTitle1")}
              <span className="mt-2 block animate-gradient bg-gradient-to-r from-emerald-300 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {t("heroTitle2")}
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-ivory-200/85">
              {t("heroSub")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <StudioLink className="liquid-glass liquid-glass--pill group relative inline-flex w-full justify-center overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-emerald-500/40 transition hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/60 sm:w-auto">
                <span className="relative z-10 flex items-center gap-2">
                  {t("ctaStart")}
                  <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
              </StudioLink>
              <a
                href="#catalog"
                className="liquid-glass liquid-glass--pill group inline-flex w-full items-center justify-center overflow-hidden rounded-full border-2 border-ivory-50/20 px-8 py-4 text-sm font-bold text-ivory-50 transition hover:border-ivory-50/50 sm:w-auto"
              >
                {t("ctaBrowse")}
              </a>
              <button
                onClick={() => setShowGuest(true)}
                className="liquid-glass liquid-glass--pill inline-flex w-full items-center justify-center overflow-hidden rounded-full border border-emerald-300/50 px-6 py-4 text-sm font-bold text-emerald-100 transition hover:border-emerald-200/70 sm:w-auto"
              >
                ✨ {t("tryDemo")}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-ivory-200/60">{t("tryDemoSub")}</p>
          </div>

          {/* شريط الإحصائيات المفصول — بطاقات زجاج سائل مع تأثيرات hover */}
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: "∞", value: t("statPages"), label: t("statPagesLabel") },
              { icon: "📍", value: t("statWilayas"), label: t("statWilayasLabel") },
              { icon: "💳", value: t("statCod"), label: t("statCodLabel") },
            ].map((stat, i) => (
              <div
                key={i}
                className="liquid-glass liquid-glass--rounded group relative overflow-hidden rounded-2xl p-4 text-center transition hover:-translate-y-1 sm:p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-2 text-2xl sm:text-3xl">{stat.icon}</div>
                  <div className="font-display text-xl font-extrabold text-ivory-50 sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-ivory-200/70 sm:text-[11px]">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* كيف يعمل */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ivory-50 to-white py-16 dark:from-[#0d1117] dark:to-[#161b22] lg:py-20">
        <div className="container-landing">
          <div className="mb-10 text-center">
            <span className="inline-block rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {t("howEyebrow")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 sm:text-4xl">{t("howTitle")}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">
              {t("howSub")}
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              { n: "1", title: t("step1Title"), copy: t("step1Copy") },
              { n: "2", title: t("step2Title"), copy: t("step2Copy") },
              { n: "3", title: t("step3Title"), copy: t("step3Copy") },
            ].map((step, i) => (
              <div key={i} className="group relative">
                {/* خط الربط بين البطاقات */}
                {i < 2 && (
                  <div className="absolute right-0 top-12 hidden h-0.5 w-full bg-gradient-to-r from-navy-900/20 to-transparent lg:block dark:from-white/20" />
                )}
                <div className="liquid-glass liquid-glass--rounded relative overflow-hidden rounded-3xl p-8 shadow-xl shadow-navy-900/5 transition hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy-900/10 dark:shadow-black/20">
                  {/* رقم الخطوة بتدرّج لوني */}
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 font-display text-2xl font-bold text-white shadow-lg shadow-emerald-500/50">
                    {step.n}
                  </div>
                  <h3 className="font-display text-xl font-bold text-navy-900 dark:text-ivory-50">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">{step.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* الكتالوج — بطاقة CTA §10 (تصفّح المتجر + إنشاء صفحة جديدة) */}
      <section id="catalog" className="container-landing py-16 lg:py-20">
        <div className="liquid-glass liquid-glass--rounded relative overflow-hidden rounded-[2rem] p-8 sm:p-12">
          <div className="absolute -end-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("catalogEyebrow")}</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 sm:text-4xl">{t("catalogTitle")}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">
                {t("catalogSub")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
              <Link
                href="/store"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-navy-900 px-8 py-4 text-sm font-bold text-ivory-50 shadow-xl shadow-navy-900/20 transition hover:-translate-y-0.5 hover:bg-navy-700 dark:bg-white/10 dark:hover:bg-white/20"
              >
                🛍️ {t("browseStore")}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <StudioLink className="inline-flex items-center justify-center rounded-full border border-navy-900/15 px-6 py-4 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50/80 dark:hover:text-ivory-50">
                + {t("newPage")}
              </StudioLink>
            </div>
          </div>
        </div>
      </section>

      {/* قسم الاشتراكات — بطاقة مع صورة fb.png وزر CTA فيسبوك + زر الخطط */}
      <section className="relative overflow-hidden py-16 lg:py-20" style={{ backgroundImage: 'linear-gradient(to bottom right, rgba(var(--theme-primary-rgb), 0.08), rgba(var(--theme-secondary-rgb), 0.08))' }}>
        <div className="container-landing">
          <div className="liquid-glass liquid-glass--rounded grid gap-8 overflow-hidden rounded-[2rem] p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div className="grid gap-4">
              <span className="inline-block w-fit rounded-full px-4 py-2 text-sm font-bold theme-gradient bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300" style={{ WebkitTextFillColor: 'var(--theme-primary)' }}>
                {t("subsEyebrow")}
              </span>
              <h2 className="font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 lg:text-5xl">{t("subsTitle")}</h2>
              <p className="max-w-md text-lg leading-7 text-navy-700/80 dark:text-ivory-50/80">
                خطط مرنة تناسب احتياجاتك — من المنتج الواحد إلى متجرك الكامل
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <a
                  href="https://www.facebook.com/share/1Ep7pL32L4/"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-3 rounded-full bg-[#1877f2] px-8 py-4 font-bold text-white shadow-xl shadow-[#1877f2]/30 transition hover:bg-[#166fe5] hover:shadow-2xl hover:shadow-[#1877f2]/50"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  {t("subsCta")}
                </a>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-full px-8 py-4 font-bold text-white theme-gradient theme-shadow transition hover:theme-shadow-lg"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  عرض الخطط
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl blur-2xl" style={{ backgroundImage: 'linear-gradient(to right, rgba(var(--theme-primary-rgb), 0.2), rgba(var(--theme-secondary-rgb), 0.2))' }} />
              <img
                src="/FB.png"
                alt="باقات الاشتراكات"
                className="relative w-full rounded-3xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      <PageFooter />

      {/* نافذة الوضع التجريبي (Guest Mode) — بدون تسجيل دخول */}
      <GuestStudio open={showGuest} onClose={() => setShowGuest(false)} />

      {/* نافذة دخول الأدمن (modal) — AdminLoginModal الزجاجي */}
      <AdminLoginModal open={showAdmin} onClose={() => setShowAdmin(false)} />
    </main>
  );
}
