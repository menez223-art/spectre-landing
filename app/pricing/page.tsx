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
      key: "basic",
      name: t("planBasic"),
      price: t("basicPrice"),
      period: t("priceMonthly"),
      description: t("basicTagline"),
      stats: [
        { value: "1", label: t("statPages") },
        { value: "1", label: t("statProducts") },
        { value: "2", label: t("statImages") },
      ],
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
      key: "pro",
      name: t("planPro"),
      price: t("proPrice"),
      period: t("priceMonthly"),
      description: t("proTagline"),
      stats: [
        { value: "2", label: t("statPages") },
        { value: "2", label: t("statProducts") },
        { value: "4", label: t("statImages") },
      ],
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
      key: "gold",
      name: t("planGold"),
      price: t("goldPrice"),
      period: t("priceMonthly"),
      description: t("goldTagline"),
      stats: [
        { value: "4", label: t("statPages") },
        { value: "5", label: t("statProducts") },
        { value: "8", label: t("statImages") },
      ],
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

  // رقم الواتساب للأدمن (يُحقن من Vercel env var NEXT_PUBLIC_ADMIN_WHATSAPP)
  const adminWhatsapp = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || "213658123545";

  // يبني رابط wa.me مع رسالة جاهزة تتضمن اسم الخطة والسعر
  const whatsappLink = (plan: { name: string; price: string }) => {
    const msg = `السلام عليكم، أريد الاشتراك في باقة ${plan.name} بسعر ${plan.price}/شهر.`;
    return `https://wa.me/${adminWhatsapp}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <main className="neu-app">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} />

      {/* قسم الأسعار */}
      <section className="neu-wrap py-16 lg:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="neu-eyebrow">{t("pricingEyebrow")}</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t("pricingTitle")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 t-muted">{t("pricingSub")}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <article key={plan.key} className="neu-card relative grid gap-6 p-8">
              {plan.popular && (
                <span className="neu-badge neu-badge--warning absolute -top-3 start-6">
                  <i className="fa-solid fa-star" aria-hidden="true" />
                  {plan.name}
                </span>
              )}

              <div className="grid gap-3 text-center">
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold t-primary">{plan.price}</span>
                  <span className="text-sm font-semibold t-muted">{plan.period}</span>
                </div>
                <p className="text-sm t-muted">{plan.description}</p>
              </div>

              {/* شبكة الإحصائيات */}
              <div className="neu-inset grid grid-cols-3 gap-2 p-3">
                {plan.stats.map((stat, sidx) => (
                  <div key={sidx} className="text-center">
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="mt-1 text-[10px] font-semibold t-muted">{stat.label}</div>
                  </div>
                ))}
              </div>

              <ul className="grid gap-3" role="list">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm t-muted">
                    <i className="fa-solid fa-circle-check mt-0.5 shrink-0 t-success" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="grid gap-2 pt-2">
                <hr className="neu-divider" />
                <p className="text-[11px] t-muted">{t("noteQuotasTotal")}</p>
                <p className="text-[11px] t-muted">{t("noteRenewable")}</p>
              </div>

              <a
                href={whatsappLink(plan)}
                target="_blank"
                rel="noopener noreferrer"
                className={`neu-btn neu-btn--lg neu-btn--block mt-2 ${plan.highlight ? "neu-btn--success" : ""}`}
              >
                <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                {plan.cta}
              </a>
            </article>
          ))}
        </div>

        {/* المميزات المشتركة */}
        <div className="mx-auto mt-16 max-w-4xl">
          <h2 className="text-center text-2xl font-bold">
            مميزات متاحة في كل الباقات
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: "fa-file-lines", title: t("featureLandingPages"), desc: t("featureLandingPagesDesc") },
              { icon: "fa-flag", title: t("featureWilayas"), desc: t("featureWilayasDesc") },
              { icon: "fa-sack-dollar", title: t("featureCod"), desc: t("featureCodDesc") },
              { icon: "fa-palette", title: t("featureColors"), desc: t("featureColorsDesc") },
              { icon: "fa-clipboard-list", title: t("featureOrderForm"), desc: t("featureOrderFormDesc") },
              { icon: "fa-table", title: t("featureSheets"), desc: t("featureSheetsDesc") },
            ].map((item, idx) => (
              <div key={idx} className="neu-panel grid gap-3 p-6">
                <span className="text-3xl t-primary"><i className={`fa-solid ${item.icon}`} aria-hidden="true" /></span>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="text-sm t-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PageFooter />

      {/* نافذة دخول الأدمن (modal) */}
      <AdminLoginModal open={showAdmin} onClose={() => setShowAdmin(false)} />
    </main>
  );
}