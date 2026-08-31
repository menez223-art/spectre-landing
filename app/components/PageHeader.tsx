"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { ThemeSelector } from "@/app/components/ThemeSelector";
import { StudioLink } from "@/app/components/StudioLink";

type Props = {
  showAdminButton?: boolean;
  onAdminClick?: () => void;
  hideOnScroll?: boolean;
};

/**
 * PageHeader — Bismillah bar + sticky glass pill header
 * Used by Home (with scroll-hide) and Pricing (without).
 */
export function PageHeader({ showAdminButton = true, onAdminClick, hideOnScroll = false }: Props) {
  const { t } = useLocale();
  const [hdrHidden, setHdrHidden] = useState(false);

  useEffect(() => {
    if (!hideOnScroll) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHdrHidden(y > last && y > 90);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideOnScroll]);

  return (
    <>
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

      {/* الترويسة — زجاج سائل pill لاصقة */}
      <header
        className={`sticky top-0 z-50 border-b border-navy-900/10 transition-transform duration-300 will-change-transform dark:border-white/10 ${
          hideOnScroll ? (hdrHidden ? "-translate-y-full" : "translate-y-0") : ""
        }`}
      >
        <div className="container-landing py-3 sm:py-4">
          <div className="liquid-glass liquid-glass--pill flex flex-wrap items-center justify-between gap-x-3 gap-y-2 overflow-hidden rounded-full px-3 py-2 sm:px-4">
            {/* الشعار */}
            <Link href="/" prefetch className="group flex items-center gap-2 sm:gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl theme-gradient font-display text-lg font-bold text-white theme-shadow transition group-hover:theme-shadow-lg sm:h-10 sm:w-10">
                S
              </div>
              <span className="font-display text-lg font-extrabold tracking-tight text-navy-900 dark:text-ivory-50 sm:text-2xl">
                {t("brand")}
              </span>
            </Link>

            <nav
              className="hidden items-center gap-8 text-sm font-semibold text-navy-700 dark:text-ivory-200 md:flex"
              aria-label={t("products")}
            >
              <Link href="/#catalog" prefetch={false} className="transition hover:text-navy-400 dark:hover:text-blue-400">
                {t("products")}
              </Link>
              <Link href="/studio" prefetch className="transition hover:text-navy-400 dark:hover:text-blue-400">
                {t("studio")}
              </Link>
            </nav>

            <div className="flex items-center gap-1.5">
              <ThemeSelector />
              <ThemeToggle />
              <LangToggle />
              <Link
                href="/pricing"
                prefetch
                className="hidden rounded-xl border border-navy-900/10 bg-white/50 px-4 py-2 text-sm font-semibold text-navy-700 backdrop-blur transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ivory-50 sm:block"
              >
                الخطط والأسعار
              </Link>
              {showAdminButton && (
                <button
                  onClick={onAdminClick}
                  title={t("adminLoginTitle")}
                  aria-label={t("adminLoginTitle")}
                  className="rounded-xl border border-navy-900/10 bg-white/50 px-3 py-2 text-sm font-semibold text-navy-700 backdrop-blur transition hover:border-navy-900/20 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-ivory-50 sm:px-4"
                >
                  <span aria-hidden className="sm:hidden">🔑</span>
                  <span className="hidden sm:inline">{t("adminLoginTitle")}</span>
                </button>
              )}
              <StudioLink className="rounded-xl theme-gradient px-3.5 py-2 text-xs font-bold text-white theme-shadow transition hover:theme-shadow-lg sm:px-6 sm:text-sm">
                {t("newPage")}
              </StudioLink>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
