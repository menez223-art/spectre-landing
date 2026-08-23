"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PRODUCTS } from "@/app/data/products";
// الكتالوج يُرسم أسفل الصفحة — نحمّله كسولاً مع هيكل بديل كي لا يثقل
// الرسم الأولي للرئيسية (البطل + قسم الاشتراكات يظهران فوراً).
const CatalogLocal = dynamic(
  () => import("@/app/components/catalog/CatalogLocal").then((m) => m.CatalogLocal),
  {
    ssr: false,
    loading: () => (
      <div className="container-landing py-16 lg:py-20">
        <div className="h-40 w-full animate-pulse rounded-3xl bg-navy-900/10 dark:bg-white/10" />
      </div>
    ),
  }
);
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { ThemeSelector } from "@/app/components/ThemeSelector";
import { AdminLoginBox } from "@/app/components/AdminLoginBox";
import { GuestStudio } from "@/app/components/auth/GuestStudio";
import { useLocale } from "@/app/components/LocaleProvider";

// انتقال سلس إلى الاستوديو: نُعلّق صنف الانتقال على <html> قبل التنقّل،
// فيتلاشى التعتيم تدريجياً أثناء تحميل صفحة الاستوديو. نستعمل <Link prefetch>
// كي يحمّل Next.js حزمة المسار مسبقاً فيصبح التنقّل فورياً.
function StudioLink({ className, children }: { className: string; children: React.ReactNode }) {
  const handleClick = () => {
    const root = document.documentElement;
    root.classList.add("page-enter", "page-enter-active");
    requestAnimationFrame(() => root.classList.remove("page-enter"));
    setTimeout(() => root.classList.remove("page-enter-active"), 120);
  };
  return (
    <Link href="/studio" prefetch onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}

// الرئيسية — فهرس منتجات + مدخل الاستوديو
export default function Home() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGuest, setShowGuest] = useState(false);

  // إن احتوت الرابط ?admin=1 (أعيد توجيه الأدمن بلا جلسة) نفتح صندوق الدخول في modal.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      setShowAdmin(true);
    }
  }, []);

  // إغلاق modal الأدمن بمفتاح Escape + منع تمرير الخلفية أثناء فتحه.
  useEffect(() => {
    if (!showAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAdmin(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showAdmin]);

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* شريط «بسم الله» — نص عربي ثابت لا يتأثر بمبدّل اللغة */}
      <div
        lang="ar"
        translate="no"
        className="border-b border-navy-900/10 bg-navy-900 py-1.5 text-center dark:border-white/10"
      >
        <p className="font-display text-sm font-bold tracking-wide text-ivory-50/90">
          بسم الله
        </p>
      </div>

      {/* الترويسة */}
      <header className="sticky top-0 z-50 border-b border-navy-900/10 bg-ivory-50/70 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#0d1117]/70">
        <div className="container-landing flex items-center justify-between gap-3 py-4">
          {/* الشعار */}
          <div className="flex items-center gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl theme-gradient font-display text-lg font-bold text-white theme-shadow transition group-hover:theme-shadow-lg">
                S
              </div>
              <span className="font-display text-2xl font-extrabold tracking-tight text-navy-900 dark:text-ivory-50">
                {t("brand")}
              </span>
            </Link>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-700 dark:text-ivory-200 md:flex" aria-label={t("products")}>
            <a href="#catalog" className="transition hover:text-navy-400 dark:hover:text-blue-400">{t("products")}</a>
            <Link href="/studio" className="transition hover:text-navy-400 dark:hover:text-blue-400">{t("studio")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <ThemeToggle />
            <LangToggle />
            <Link
              href="/pricing"
              className="hidden rounded-xl border border-navy-900/10 bg-white/50 px-4 py-2 text-sm font-semibold text-navy-700 backdrop-blur transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ivory-50 sm:block"
            >
              الخطط والأسعار
            </Link>
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className="rounded-xl border border-navy-900/10 bg-white/50 px-4 py-2 text-sm font-semibold text-navy-700 backdrop-blur transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ivory-50"
            >
              {t("adminLoginTitle")}
            </button>
            <StudioLink className="rounded-xl theme-gradient px-6 py-2 text-sm font-bold text-white theme-shadow transition hover:theme-shadow-lg">
              {t("newPage")}
            </StudioLink>
          </div>
        </div>
      </header>

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
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <StudioLink className="group relative overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-emerald-500/40 transition hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/60">
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
                className="group rounded-full border-2 border-ivory-50/20 bg-ivory-50/5 px-8 py-4 text-sm font-bold text-ivory-50 backdrop-blur-sm transition hover:border-ivory-50/50 hover:bg-ivory-50/10"
              >
                {t("ctaBrowse")}
              </a>
              <button
                onClick={() => setShowGuest(true)}
                className="rounded-full border border-emerald-300/50 bg-emerald-400/15 px-6 py-4 text-sm font-bold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-400/25"
              >
                ✨ {t("tryDemo")}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-ivory-200/60">{t("tryDemoSub")}</p>
          </div>

          {/* شريط الإحصائيات المفصول — بطاقات أنيقة مع تأثيرات hover */}
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-4">
            {[
              { icon: "∞", value: t("statPages"), label: t("statPagesLabel") },
              { icon: "📍", value: t("statWilayas"), label: t("statWilayasLabel") },
              { icon: "💳", value: t("statCod"), label: t("statCodLabel") },
            ].map((stat, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-ivory-50/10 bg-ivory-50/5 backdrop-blur-sm p-6 text-center transition hover:border-ivory-50/30 hover:bg-ivory-50/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-2 text-3xl">{stat.icon}</div>
                  <div className="font-display text-2xl font-extrabold text-ivory-50 sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-[11px] font-semibold text-ivory-200/70">{stat.label}</div>
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
                <div className="relative rounded-3xl border border-navy-900/10 bg-white p-8 shadow-xl shadow-navy-900/5 transition hover:-translate-y-2 hover:shadow-2xl hover:shadow-navy-900/10 dark:border-white/10 dark:bg-[#161b22] dark:shadow-black/20">
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

      {/* الكتالوج */}
      <section id="catalog" className="container-landing py-16 lg:py-20">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("catalogEyebrow")}</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50">{t("catalogTitle")}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">
              {t("catalogSub")}
            </p>
          </div>
          <StudioLink className="shrink-0 rounded-full border border-navy-900/15 px-5 py-3 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900">
            + {t("newPage")}
          </StudioLink>
        </div>

        <CatalogLocal staticProducts={PRODUCTS} />
      </section>

      {/* قسم الاشتراكات — بطاقة مع صورة fb.png وزر CTA فيسبوك + زر الخطط */}
      <section className="relative overflow-hidden py-16 lg:py-20" style={{ backgroundImage: 'linear-gradient(to bottom right, rgba(var(--theme-primary-rgb), 0.08), rgba(var(--theme-secondary-rgb), 0.08))' }}>
        <div className="container-landing">
          <div className="grid gap-8 rounded-[2rem] lg:grid-cols-[1fr_0.9fr] lg:items-center">
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

      {/* التذييل */}
      <footer className="border-t border-navy-900/10 dark:border-white/10">
        <div className="container-landing flex flex-col justify-between gap-3 py-8 text-xs text-navy-900/50 sm:flex-row dark:text-ivory-50/50">
          <p>{t("footer1")}</p>
          <p>{t("footer2")}</p>
        </div>
      </footer>

      {/* نافذة الوضع التجريبي (Guest Mode) — بدون تسجيل دخول */}
      <GuestStudio open={showGuest} onClose={() => setShowGuest(false)} />

      {/* نافذة دخول الأدمن (modal) — تحتوي AdminLoginBox كما هو */}
      {showAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdmin(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-navy-900/10 bg-ivory-50 p-6 shadow-2xl dark:border-white/10 dark:bg-[#11161d]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-navy-900 dark:text-ivory-50">
                {t("adminLoginTitle")}
              </h3>
              <button
                onClick={() => setShowAdmin(false)}
                aria-label={t("close")}
                className="grid h-8 w-8 place-items-center rounded-full text-navy-500 transition hover:bg-navy-900/5 hover:text-navy-900 dark:text-ivory-50/60 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <AdminLoginBox />
          </div>
        </div>
      )}
    </main>
  );
}
