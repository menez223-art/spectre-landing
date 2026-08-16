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
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-ivory-50/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex items-center justify-between gap-3 py-5">
          <div className="flex flex-col items-start gap-1">
            <a
              href="https://www.facebook.com/share/1Ep7pL32L4/"
              target="_blank"
              rel="noopener"
              className="rounded-full border border-navy-900/15 px-4 py-2 text-xs font-extrabold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50/80"
            >
              SHOP‑VISION
            </a>
            <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-navy-900">
              {t("brand")}
            </Link>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-700 md:flex" aria-label={t("products")}>
            <a href="#catalog" className="transition hover:text-navy-400">{t("products")}</a>
            <Link href="/studio" className="transition hover:text-navy-400">{t("studio")}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LangToggle />
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className="rounded-full border border-navy-900/15 px-4 py-2.5 text-xs font-bold text-navy-700 transition hover:border-rose-500 hover:text-rose-700"
            >
              {t("adminLoginTitle")}
            </button>
            <StudioLink className="rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700">
              {t("newPage")}
            </StudioLink>
          </div>
        </div>
      </header>

      {/* البطل */}
      <section className="relative overflow-hidden bg-navy-900 text-ivory-50">
        <div className="absolute -start-24 top-10 h-72 w-72 rounded-full bg-navy-500/30 blur-3xl" />
        <div className="absolute -end-16 bottom-0 h-80 w-80 rounded-full bg-navy-400/20 blur-3xl" />
        <div className="container-landing relative py-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-ivory-50/15 bg-ivory-50/5 px-4 py-1.5 text-xs font-bold text-ivory-200">
              <span className="h-1.5 w-1.5 rounded-full bg-ivory-300" />
              {t("heroBadge")}
            </p>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.15] sm:text-5xl">
              {t("heroTitle1")}
              <span className="mt-1 block bg-gradient-to-l from-ivory-300 via-ivory-100 to-white bg-clip-text text-transparent">
                {t("heroTitle2")}
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-ivory-200/85">
              {t("heroSub")}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <StudioLink className="rounded-full bg-ivory-50 px-7 py-4 text-sm font-bold text-navy-900 shadow-lg shadow-navy-950/40 transition hover:-translate-y-0.5 hover:bg-white">
                {t("ctaStart")} <span className="ms-3">←</span>
              </StudioLink>
              <a
                href="#catalog"
                className="rounded-full border border-ivory-50/20 px-7 py-4 text-sm font-bold text-ivory-50 transition hover:border-ivory-50/50"
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

          {/* شريط الإحصائيات المفصول — أنيق تحت الأزرار */}
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-3">
            {[
              { value: "∞", label: t("statPages") },
              { value: "58", label: t("statWilayas") },
              { value: "COD", label: t("statCod") },
            ].map((stat) => (
              <div
                key={stat.label}
                className="grid place-items-center gap-1 rounded-3xl border border-ivory-50/10 bg-ivory-50/[0.04] px-3 py-6 text-center backdrop-blur"
              >
                <span className="font-display text-2xl font-extrabold text-ivory-50 sm:text-3xl">{stat.value}</span>
                <span className="text-[11px] font-semibold text-ivory-200/70">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* كيف يعمل */}
      <section className="container-landing py-16 lg:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("howEyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50">{t("howTitle")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">
            {t("howSub")}
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { n: "1", title: t("step1Title"), copy: t("step1Copy") },
            { n: "2", title: t("step2Title"), copy: t("step2Copy") },
            { n: "3", title: t("step3Title"), copy: t("step3Copy") },
          ].map((step) => (
            <div
              key={step.n}
              className="relative grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#11161d]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-navy-900 font-display text-lg font-extrabold text-ivory-50 dark:bg-navy-500">
                {step.n}
              </span>
              <h3 className="font-display text-lg font-bold text-navy-900 dark:text-ivory-50">{step.title}</h3>
              <p className="text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">{step.copy}</p>
            </div>
          ))}
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

      {/* قسم الاشتراكات — بطاقة مع صورة fb.png وزر CTA فيسبوك */}
      <section className="container-landing py-16 lg:py-20">
        <div className="grid gap-8 rounded-[2rem] border border-navy-900/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#11161d] sm:p-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div className="grid gap-4">
            <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("subsEyebrow")}</p>
            <h2 className="font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50">{t("subsTitle")}</h2>
            <p className="max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">{t("subsCta")}</p>
            <a
              href="https://www.facebook.com/share/1Ep7pL32L4/"
              target="_blank"
              rel="noopener"
              className="mt-2 w-fit rounded-full bg-[#1877f2] px-7 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#166fe0]"
            >
              {t("subsCta")}
            </a>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <img
              src="/fb.png"
              alt="باقات الاشتراكات"
              className="w-full rounded-3xl ring-1 ring-navy-900/10 dark:ring-white/10"
            />
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
