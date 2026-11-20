"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { PageHeader } from "@/app/components/PageHeader";
import { PageFooter } from "@/app/components/PageFooter";
import { AdminLoginModal } from "@/app/components/AdminLoginModal";
import { StudioLink } from "@/app/components/StudioLink";

// محتوى الصفحة الرئيسية (عميل) — هوية Neumorphism المعتمدة من المالك.
// الوضع التجريبي صار صفحة مستقلة /tryfree (طلب المالك) بدل نافذة منبثقة،
// وزر تصفّح المنتجات يوجّه إلى /store مباشرة.
export function HomeClient() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);

  // فتح نافذة دخول الأدمن تلقائياً عند الوصول من /?admin=1
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("admin") === "1") {
        setShowAdmin(true);
      }
    } catch {
      // تجاهل
    }
  }, []);

  return (
    <main className="neu-app">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} hideOnScroll />

      {/* البطل */}
      <section className="relative overflow-hidden">
        <div className="neu-wrap relative py-16 lg:py-24">
          <div className="max-w-2xl">
            <p className="neu-badge neu-badge--primary">
              <i className="fa-solid fa-circle text-[6px]" aria-hidden="true" />
              {t("heroBadge")}
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-[1.15] sm:text-5xl lg:text-6xl">
              {t("heroTitle1")}
              <span className="mt-2 block t-primary">{t("heroTitle2")}</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 t-muted">{t("heroSub")}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              <StudioLink className="neu-btn neu-btn--lg w-full sm:w-auto">
                {t("ctaStart")}
                <i className="fa-solid fa-arrow-right neu-arrow" aria-hidden="true" />
              </StudioLink>
              <Link href="/store" prefetch className="neu-btn neu-btn--lg w-full sm:w-auto">
                {t("ctaBrowse")}
              </Link>
              <Link href="/tryfree" prefetch className="neu-btn neu-btn--lg neu-btn--success w-full sm:w-auto">
                <i className="fa-solid fa-flask" aria-hidden="true" />
                {t("tryDemo")}
              </Link>
            </div>
            <p className="mt-3 text-xs leading-5 t-muted">{t("tryDemoSub")}</p>
          </div>

          {/* شريط الإحصائيات */}
          <div className="mt-12 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: "fa-infinity", value: t("statPages"), label: t("statPagesLabel") },
              { icon: "fa-location-dot", value: t("statWilayas"), label: t("statWilayasLabel") },
              { icon: "fa-money-bill-wave", value: t("statCod"), label: t("statCodLabel") },
            ].map((stat, i) => (
              <div key={i} className="neu-panel p-4 text-center sm:p-6">
                <div className="mb-2 text-2xl t-primary sm:text-3xl">
                  <i className={`fa-solid ${stat.icon}`} aria-hidden="true" />
                </div>
                <div className="text-xl font-bold sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-[10px] font-semibold leading-4 t-muted sm:text-[11px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* كيف يعمل */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="neu-wrap">
          <div className="mb-10 text-center">
            <span className="neu-eyebrow">{t("howEyebrow")}</span>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{t("howTitle")}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 t-muted">{t("howSub")}</p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              { n: "1", title: t("step1Title"), copy: t("step1Copy") },
              { n: "2", title: t("step2Title"), copy: t("step2Copy") },
              { n: "3", title: t("step3Title"), copy: t("step3Copy") },
            ].map((step, i) => (
              <div key={i} className="neu-card p-8">
                <div className="neu-circle neu-circle--lg mb-6 font-bold">{step.n}</div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 t-muted">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* الكتالوج — CTA تصفّح المتجر + إنشاء صفحة جديدة */}
      <section id="catalog" className="neu-wrap py-16 lg:py-20">
        <div className="neu-card p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-xl">
              <p className="neu-eyebrow">{t("catalogEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{t("catalogTitle")}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 t-muted">{t("catalogSub")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
              <Link href="/store" prefetch className="neu-btn neu-btn--lg">
                <i className="fa-solid fa-store" aria-hidden="true" />
                {t("browseStore")}
                <i className="fa-solid fa-arrow-right neu-arrow" aria-hidden="true" />
              </Link>
              <StudioLink className="neu-btn neu-btn--lg">
                <i className="fa-solid fa-plus" aria-hidden="true" />
                {t("newPage")}
              </StudioLink>
            </div>
          </div>
        </div>
      </section>

      {/* الاشتراكات — بطاقة مع صورة fb.png وزر فيسبوك + زر الخطط */}
      <section className="relative overflow-hidden py-16 lg:py-20">
        <div className="neu-wrap">
          <div className="neu-card grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div className="grid gap-4">
              <span className="neu-eyebrow w-fit">{t("subsEyebrow")}</span>
              <h2 className="text-3xl font-bold lg:text-5xl">{t("subsTitle")}</h2>
              <p className="max-w-md text-lg leading-7 t-muted">
                خطط مرنة تناسب احتياجاتك — من المنتج الواحد إلى متجرك الكامل
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="https://www.facebook.com/share/1Ep7pL32L4/"
                  target="_blank"
                  rel="noopener"
                  className="neu-btn neu-btn--lg"
                >
                  <i className="fa-brands fa-facebook" aria-hidden="true" />
                  {t("subsCta")}
                </a>
                <Link href="/pricing" prefetch className="neu-btn neu-btn--lg">
                  <i className="fa-solid fa-arrow-right neu-arrow" aria-hidden="true" />
                  عرض الخطط
                </Link>
              </div>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- صورة ثابتة محلية غير محسّنة عبر next/image */}
              <img
                src="/fb.png"
                alt="باقات الاشتراكات"
                className="w-full rounded-3xl"
                style={{ boxShadow: "var(--shadow-outer)" }}
              />
            </div>
          </div>
        </div>
      </section>

      <PageFooter />

      {/* نافذة دخول الأدمن (modal) */}
      <AdminLoginModal open={showAdmin} onClose={() => setShowAdmin(false)} />
    </main>
  );
}
