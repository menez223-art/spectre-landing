"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRODUCTS } from "@/app/data/products";
import { CatalogLocal } from "@/app/components/catalog/CatalogLocal";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminLoginBox } from "@/app/components/AdminLoginBox";
import { GuestStudio } from "@/app/components/auth/GuestStudio";
import { useLocale } from "@/app/components/LocaleProvider";

// انتقال سلس إلى الاستوديو: نُعلّق صنف الانتقال على <html> قبل التنقّل،
// فيتلاشى التعتيم تدريجياً أثناء تحميل صفحة الاستوديو.
function goToStudio(router: ReturnType<typeof useRouter>) {
  const root = document.documentElement;
  root.classList.add("page-enter", "page-enter-active");
  requestAnimationFrame(() => root.classList.remove("page-enter"));
  setTimeout(() => root.classList.remove("page-enter-active"), 120);
  router.push("/studio");
}

// الرئيسية — فهرس منتجات + مدخل الاستوديو
export default function Home() {
  const { t } = useLocale();
  const router = useRouter();
  const adminRef = useRef<HTMLDivElement | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showGuest, setShowGuest] = useState(false);

  // إن احتوت الرابط ?admin=1 (أعيد توجيه الأدمن بلا جلسة) نعرض الصندوق ونمرّر إليه.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      setShowAdmin(true);
      setTimeout(() => adminRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
  }, []);

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
              onClick={() => {
                setShowAdmin((v) => !v);
                if (!showAdmin) setTimeout(() => adminRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
              }}
              className="rounded-full border border-navy-900/15 px-4 py-2.5 text-xs font-bold text-navy-700 transition hover:border-rose-500 hover:text-rose-700"
            >
              {t("adminLoginTitle")}
            </button>
            <button
              onClick={() => goToStudio(router)}
              className="rounded-full bg-navy-900 px-5 py-2.5 text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
            >
              {t("newPage")}
            </button>
          </div>
        </div>
      </header>

      {/* البطل */}
      <section className="relative overflow-hidden bg-navy-900 text-ivory-50">
        <div className="absolute -start-24 top-10 h-72 w-72 rounded-full bg-navy-500/30 blur-3xl" />
        <div className="absolute -end-16 bottom-0 h-80 w-80 rounded-full bg-navy-400/20 blur-3xl" />
        <div className="container-landing relative grid gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-24">
          <div>
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
              <button
                onClick={() => goToStudio(router)}
                className="rounded-full bg-ivory-50 px-7 py-4 text-sm font-bold text-navy-900 shadow-lg shadow-navy-950/40 transition hover:-translate-y-0.5 hover:bg-white"
              >
                {t("ctaStart")} <span className="ms-3">←</span>
              </button>
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

          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "∞", label: t("statPages") },
              { value: "58", label: t("statWilayas") },
              { value: "COD", label: t("statCod") },
            ].map((stat) => (
              <div
                key={stat.label}
                className="grid place-items-center gap-1 rounded-3xl border border-ivory-50/10 bg-ivory-50/[0.04] px-3 py-8 text-center backdrop-blur"
              >
                <span className="font-display text-2xl font-extrabold text-ivory-50 sm:text-3xl">{stat.value}</span>
                <span className="text-[11px] font-semibold text-ivory-200/70">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* صندوق دخول الأدمن — يظهر عند الطلب للوصول المباشر لإدارة الاشتراكات */}
          {showAdmin && (
            <div ref={adminRef} className="mt-6">
              <AdminLoginBox />
            </div>
          )}
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
          <button
            onClick={() => goToStudio(router)}
            className="shrink-0 rounded-full border border-navy-900/15 px-5 py-3 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900"
          >
            + {t("newPage")}
          </button>
        </div>

        <CatalogLocal staticProducts={PRODUCTS} />
      </section>

      {/* قسم الاشتراكات — صورة عمودية متمركزة قبل التذييل */}
      <section className="container-landing py-16 lg:py-20">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("subsEyebrow")}</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50">{t("subsTitle")}</h2>
        </div>
        <div className="mx-auto max-w-md">
          <img
            src="/اشتراك.png"
            alt="باقات الاشتراكات"
            className="w-full rounded-3xl ring-1 ring-navy-900/10 dark:ring-white/10"
          />
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
    </main>
  );
}
