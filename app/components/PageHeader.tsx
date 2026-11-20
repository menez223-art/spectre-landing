"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { LangToggle } from "@/app/components/LangToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
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
      <div lang="ar" translate="no" className="neu-bismillah">
        بسم الله
      </div>

      {/* الترويسة — neumorphic لاصقة */}
      <header
        className={`page-header-neu transition-transform duration-300 will-change-transform ${
          hideOnScroll ? (hdrHidden ? "-translate-y-full" : "translate-y-0") : ""
        }`}
      >
        <div className="neu-wrap">
          {/* الشعار */}
          <Link href="/" prefetch className="brand-mark">
            <div className="neu-circle neu-circle--sm">S</div>
            <span>{t("brand")}</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex" aria-label={t("products")}>
            <Link href="/#catalog" prefetch={false} className="neu-link t-muted">
              {t("products")}
            </Link>
            <Link href="/studio" prefetch className="neu-link t-muted">
              {t("studio")}
            </Link>
          </nav>

          <div className="header-actions">
            <ThemeToggle />
            <LangToggle />
            <Link href="/pricing" prefetch className="neu-btn hidden sm:inline-flex">
              الخطط والأسعار
            </Link>
            {showAdminButton && (
              <button
                onClick={onAdminClick}
                title={t("adminLoginTitle")}
                aria-label={t("adminLoginTitle")}
                className="neu-btn"
              >
                <i className="fa-solid fa-key sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{t("adminLoginTitle")}</span>
              </button>
            )}
            <StudioLink className="neu-btn neu-btn--lg">
              {t("newPage")}
            </StudioLink>
          </div>
        </div>
      </header>
    </>
  );
}
