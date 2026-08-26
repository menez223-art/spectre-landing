"use client";

import { useLocale } from "@/app/components/LocaleProvider";
import { PageHeader } from "@/app/components/PageHeader";
import { PageFooter } from "@/app/components/PageFooter";
import { AdminLoginModal } from "@/app/components/AdminLoginModal";
import { useState, useEffect } from "react";

export default function PricingPage() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") {
      setShowAdmin(true);
    }
  }, []);

  const plans = [
    {
      name: t("planBasic"),
      price: t("basicPrice"),
      period: t("priceMonthly"),
      description: t("basicTagline"),
      features: [
        t("featureLandingPages"),
        t("featureWilayas"),
        t("featureCod"),
        t("featureColors"),
        t("featureOrderForm"),
        t("featureSheets"),
        t("featureWhatsapp"),
        t("featurePixel"),
      ],
      cta: t("ctaSubscribe"),
      highlight: false,
      popular: false,
    },
    {
      name: t("planPro"),
      price: t("proPrice"),
      period: t("priceMonthly"),
      description: t("proTagline"),
      features: [
        t("featureLandingPages"),
        t("featureWilayas"),
        t("featureCod"),
        t("featureColors"),
        t("featureOrderForm"),
        t("featureSheets"),
        t("featureWhatsapp"),
        t("featurePixel"),
        t("featureStore"),
      ],
      cta: t("ctaSubscribe"),
      highlight: false,
      popular: false,
    },
    {
      name: t("planGold"),
      price: t("goldPrice"),
      period: t("priceMonthly"),
      description: t("goldTagline"),
      features: [
        t("featureLandingPages"),
        t("featureWilayas"),
        t("featureCod"),
        t("featureColors"),
        t("featureOrderForm"),
        t("featureSheets"),
        t("featureWhatsapp"),
        t("featurePixel"),
        t("featureStore"),
      ],
      cta: t("ctaSubscribe"),
      highlight: true,
      popular: true,
    },
  ];

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} />

      {/* قسم الأسعار */}
      <section className="container-landing py-16 lg:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">{t("pricingEyebrow")}</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 sm:text-4xl">{t("pricingTitle")}</h1>
          <p className="mt-4 max-w-2xl mx-auto text-base leading-7 text-navy-700/70 dark:text-ivory-50/70">{t("pricingSub")}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`liquid-glass liquid-glass--rounded relative grid gap-6 overflow-hidden rounded-3xl p-8 transition hover:-translate-y-2 hover:shadow-2xl ${
                plan.highlight
                  ? "ring-2 ring-blue-500/40"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -right-12 top-8 rotate-45 bg-gradient-to-r from-blue-500 to-purple-600 px-12 py-1 text-xs font-bold text-white shadow-lg">
                  {plan.name}
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
                    : "border-2 border-navy-900/10 bg-white/40 hover:bg-navy-50 dark:border-white/10 dark:bg-white/5 dark:text-ivory-50"
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
              <div
                key={idx}
                className="liquid-glass liquid-glass--rounded group grid gap-3 overflow-hidden rounded-2xl p-6 transition hover:-translate-y-1"
              >
                <span className="text-3xl transition group-hover:scale-110">{item.icon}</span>
                <h3 className="font-display text-lg font-bold text-navy-900 dark:text-ivory-50">{item.title}</h3>
                <p className="text-sm text-navy-700/70 dark:text-ivory-50/70">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageFooter />

      {/* نافذة دخول الأدمن (modal) — AdminLoginModal الزجاجي */}
      <AdminLoginModal open={showAdmin} onClose={() => setShowAdmin(false)} />
    </main>
  );
}
