"use client";

import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminLoginBox } from "@/app/components/AdminLoginBox";
import { useState, useEffect } from "react";

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

export default function PricingPage() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      setShowAdmin(true);
    }
  }, []);

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

  const plans = [
    {
      name: t("planBasic"),
      price: t("basicPrice"),
      period: t("priceMonthly"),
      description: t("basicProducts") + " · " + t("basicImages") + " · " + t("basicEmail") + " · " + t("basicLinks"),
      features: [
        t("featureLandingPages"),
        t("featureWilayas"),
        t("featureCod"),
        t("featureColors"),
        t("featureOrderForm"),
        t("featureSheets"),
      ],
      cta: t("ctaSubscribe"),
      highlight: false,
      popular: false,
    },
    {
      name: t("planPro"),
      price: t("proPrice"),
      period: t("priceMonthly"),
      description: t("proProducts") + " · " + t("proImages") + " · " + t("proEmail") + " · " + t("proLinks"),
      features: [
        t("featureLandingPages"),
        t("featureWilayas"),
        t("featureCod"),
        t("featureColors"),
        t("featureOrderForm"),
        t("featureSheets"),
      ],
      cta: t("ctaSubscribe"),
      highlight: true,
      popular: true,
    },
  ];

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* شريط «بسم الله» */}
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
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-ivory-50/70 backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-[#0d1117]/70">
        <div className="container-landing flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 font-display text-lg font-bold text-white shadow-lg shadow-blue-500/50 transition group-hover:shadow-xl group-hover:shadow-blue-500/70">
                S
              </div>
              <span className="font-display text-2xl font-extrabold tracking-tight text-navy-900 dark:text-ivory-50">
                {t("brand")}
              </span>
            </Link>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-navy-700 md:flex dark:text-ivory-200" aria-label={t("products")}>
            <a href="/" className="transition hover:text-navy-400 dark:hover:text-blue-400">{t("products")}</a>
            <Link href="/studio" className="transition hover:text-navy-400 dark:hover:text-blue-400">{t("studio")}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LangToggle />
            <button
              onClick={() => setShowAdmin((v) => !v)}
              className="rounded-xl border border-navy-900/10 bg-white/50 px-4 py-2 text-sm font-semibold text-navy-700 backdrop-blur transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ivory-50"
            >
              {t("adminLoginTitle")}
            </button>
            <StudioLink className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition hover:shadow-xl hover:shadow-blue-500/50">
              {t("newPage")}
            </StudioLink>
          </div>
        </div>
      </header>

      {/* قسم الأسعار */}
      <section className="container-landing py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("pricingEyebrow")}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 sm:text-4xl">{t("pricingTitle")}</h1>
          <p className="mt-4 max-w-2xl mx-auto text-base leading-7 text-navy-700/70 dark:text-ivory-50/70">{t("pricingSub")}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative grid gap-6 overflow-hidden rounded-3xl border-2 p-8 transition hover:-translate-y-2 hover:shadow-2xl ${
                plan.highlight
                  ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20"
                  : "border-navy-900/10 bg-white dark:border-white/10 dark:bg-[#161b22]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -right-12 top-8 rotate-45 bg-gradient-to-r from-blue-500 to-purple-600 px-12 py-1 text-xs font-bold text-white shadow-lg">
                  {t("planPro")}
                </div>
              )}

              <div className="grid gap-3">
                <h2 className="font-display text-2xl font-extrabold text-navy-900 dark:text-ivory-50">{plan.name}</h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-display text-5xl font-extrabold text-navy-900 dark:text-ivory-50">{plan.price}</span>
                  <span className="text-sm font-semibold text-navy-700/70 dark:text-ivory-50/70">{plan.period}</span>
                </div>
                <p className="text-sm text-navy-700/70 dark:text-ivory-50/70">{plan.description}</p>
              </div>

              <ul className="grid gap-3" role="list">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-navy-700/80 dark:text-ivory-50/80">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="grid gap-2 pt-2 border-t border-navy-900/10 dark:border-white/10">
                <p className="text-[11px] text-navy-900/50 dark:text-ivory-50/50">{t("noteQuotasTotal")}</p>
                <p className="text-[11px] text-navy-900/50 dark:text-ivory-50/50">{t("noteRenewable")}</p>
              </div>

              <button
                className={`mt-2 w-full rounded-xl py-4 text-sm font-bold transition ${
                  plan.highlight
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl"
                    : "border-2 border-navy-900/10 bg-white hover:bg-navy-50 dark:border-white/10 dark:bg-white/5 dark:text-ivory-50"
                }`}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </div>

        
        {/* المميزات المشتركة */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="font-display text-2xl font-extrabold text-center text-navy-900 dark:text-ivory-50">
            مميزات متاحة في كل الباقات
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: "📄", title: t("featureLandingPages"), desc: "أنشئ عدداً غير محدود من صفحات الهبوط" },
              { icon: "🇩🇿", title: t("featureWilayas"), desc: "توصيل لكل الولايات الجزائرية" },
              { icon: "💰", title: t("featureCod"), desc: "الدفع عند الاستلام للزبائن" },
              { icon: "🎨", title: t("featureColors"), desc: "استخراج الألوان من صورة المنتج تلقائياً" },
              { icon: "📋", title: t("featureOrderForm"), desc: "نموذج طلب ذكي مع اختيار الولاية والبلدية" },
              { icon: "📊", title: t("featureSheets"), desc: "ربط تلقائي مع Google Sheets للطلبات" },
            ].map((item, idx) => (
              <div key={idx} className="group grid gap-3 rounded-2xl border border-navy-900/10 bg-white p-6 transition hover:-translate-y-1 hover:border-navy-500/30 hover:shadow-lg dark:border-white/10 dark:bg-[#11161d]">
                <span className="text-3xl transition group-hover:scale-110">{item.icon}</span>
                <h3 className="font-display text-lg font-bold text-navy-900 dark:text-ivory-50">{item.title}</h3>
                <p className="text-sm text-navy-700/70 dark:text-ivory-50/70">{item.desc}</p>
              </div>
            ))}
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

      {/* نافذة دخول الأدمن (modal) */}
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