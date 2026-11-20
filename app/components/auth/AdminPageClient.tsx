"use client";

// AdminPageClient — صفحة الأدمن المبسّطة.
//
// لا تكرار:
//   - لا Tabs علوية (التنقل داخل AdminPanel كافٍ: بحث + status filter + plan filter)
//   - لا أقسام منفصلة (BannedPanel مكرر مع status filter في AdminPanel)
//   - لا HealthPanel منفصل (الروابط موجودة في catalog وتُفحص يدويًا)
//
// Header بسيط: logo + email + theme + lang-toggle + logout + رابط سريع لـ /studio.
//
// اللغة مستقلة عن لغة الموقع (AdminLangProvider بمفتاح localStorage منفصل).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { AdminLangProvider, AdminLangToggle, useAdminLocale } from "@/app/components/auth/AdminLocale";

type Props = {
  email: string;
};

function AdminHeader({ email }: { email: string }) {
  const { t, dir } = useAdminLocale();
  const router = useRouter();

  // HTML لا يدعم <form method="delete"> (يُرسَل GET) ⇒ الخروج كان لا يعمل
  // والكوكي يبقى 12 ساعة. نُرسل DELETE حقيقياً ثم نوجّه للرئيسية.
  const handleLogout = async () => {
    try {
      await fetch("/api/admin/login", { method: "DELETE", cache: "no-store" });
    } catch {
      // الكوكي يُمسح من الخادم؛ نتابع التوجيه على أي حال
    }
    router.replace("/?admin=1");
    router.refresh();
  };
  return (
    <main dir={dir} className="neu-app min-h-screen">
      {/* Header بسيط */}
      <header className="sticky top-0 z-30 bg-[var(--bg-color)] [box-shadow:var(--shadow-outer-sm)]">
        <div className="container-landing flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-base font-extrabold sm:text-xl">
              {t("adminPageTitle")}
            </Link>
            <a
              href="/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="neu-btn neu-btn--success !hidden items-center !gap-1.5 !px-3 !py-1.5 !text-xs sm:!inline-flex sm:!text-[11px] min-h-[44px] touch-manipulation sm:min-h-0"
              title={t("adminOpenStudioTip")}
            >
              <span><i className="fa-solid fa-store" aria-hidden="true" /></span>
              <span>{t("adminStoreManage")}</span>
              <span aria-hidden className="text-[10px] opacity-70"><i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /></span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="neu-badge !hidden !px-3 !py-1 !text-[11px] !font-bold sm:!inline">
              {email}
            </span>
            <ThemeToggle
              labels={{
                light: t("themeLight"),
                dark: t("themeDark"),
                toLight: t("themeToLight"),
                toDark: t("themeToDark"),
              }}
            />
            <AdminLangToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="neu-btn neu-btn--muted !px-3 !py-1.5 !text-xs sm:!px-4 sm:!py-2 sm:!text-[11px] min-h-[44px] touch-manipulation sm:min-h-0"
            >
              {t("adminExit")}
            </button>
          </div>
        </div>
      </header>

      <div className="container-landing py-4 sm:py-6 lg:py-8">
        <AdminPanel email={email} />
      </div>
    </main>
  );
}

export function AdminPageClient({ email }: Props) {
  return (
    <AdminLangProvider>
      <AdminHeader email={email} />
    </AdminLangProvider>
  );
}
