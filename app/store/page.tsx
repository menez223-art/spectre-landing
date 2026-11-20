"use client";

import { useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { PageHeader } from "@/app/components/PageHeader";
import { PageFooter } from "@/app/components/PageFooter";
import { AdminLoginModal } from "@/app/components/AdminLoginModal";
import { StudioLink } from "@/app/components/StudioLink";
import { StorefrontClient } from "@/app/components/catalog/StorefrontClient";

// صفحة المتجر المخصّصة — فهرس المنتجات منظّماً حسب التصنيف. هوية Neumorphism.
// تُبقي مدخل المشرف كما في الرئيسية: زر «دخول المشرف» + نافذة الدخول.
export default function StorePage() {
  const { t } = useLocale();
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <main className="neu-app">
      <PageHeader showAdminButton onAdminClick={() => setShowAdmin(true)} />

      <section className="neu-wrap py-12 lg:py-16">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="neu-eyebrow">{t("catalogEyebrow")}</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{t("catalogTitle")}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 t-muted">{t("catalogSub")}</p>
          </div>
          <StudioLink className="neu-btn shrink-0">
            <i className="fa-solid fa-plus" aria-hidden="true" />
            {t("newPage")}
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
