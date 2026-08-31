"use client";

import { useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { PageHeader } from "@/app/components/PageHeader";
import { PageFooter } from "@/app/components/PageFooter";
import { AdminLoginModal } from "@/app/components/AdminLoginModal";
import { StudioLink } from "@/app/components/StudioLink";
import { StorefrontClient } from "@/app/components/catalog/StorefrontClient";

// صفحة المتجر المخصّصة — فهرس المنتجات منظّماً حسب التصنيف (المصنّف من الاستوديو).
// تُبقي مدخل المشرف كما في الرئيسية: زر «دخول المشرف» + نافذة الدخول.
export default function StorePage() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} />

      <section className="container-landing py-12 lg:py-16">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-wide text-navy-400 dark:text-navy-300">
              {t("catalogEyebrow")}
            </p>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-navy-900 dark:text-ivory-50 sm:text-4xl">
              {t("catalogTitle")}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-navy-700/70 dark:text-ivory-50/70">
              {t("catalogSub")}
            </p>
          </div>
          <StudioLink className="shrink-0 rounded-full border border-navy-900/15 px-5 py-3 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50/80 dark:hover:text-ivory-50">
            + {t("newPage")}
          </StudioLink>
        </div>

        <StorefrontClient />
      </section>

      <PageFooter />

      {/* نافذة دخول المشرف — نفس مدخل الرئيسية */}
      <AdminLoginModal open={showAdmin} onClose={() => setShowAdmin(false)} />
    </main>
  );
}
