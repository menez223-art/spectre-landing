"use client";

// AdminPageClient — صفحة الأدمن الكاملة (client component).
// صفحة واحدة تجمع (من الأعلى للأسفل):
//   1) إدارة المنتجات (modal داخل AdminPanel — لتحميل/تعديل المنتجات)
//   2) الإحصائيات + التحذيرات (داخل AdminPanel)
//   3) شريط البحث + Tabs الخطط + قائمة المستخدمين (داخل AdminPanel)
//   4) صحة الروابط (HealthPanel — في الأسفل)
// لا تكرار: لا Tabs سفلية مكررة، "إدارة المنتجات" modal في الأعلى (داخل AdminPanel).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { HealthPanel } from "@/app/components/auth/HealthPanel";

type Props = {
  email: string;
};

export function AdminPageClient({ email }: Props) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex items-center justify-between gap-3 py-3 sm:py-4">
          <Link href="/" className="font-display text-base font-extrabold sm:text-xl">
            إدارة الاشتراكات
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 sm:inline">
              {email}
            </span>
            <ThemeToggle />
            <form action="/api/admin/login" method="delete">
              <button
                type="submit"
                className="rounded-full border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 sm:px-4 sm:py-2 sm:text-xs dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400"
              >
                خروج
              </button>
            </form>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="container-landing border-t border-navy-900/5 py-2 text-[11px] text-navy-700/60 dark:border-white/5 dark:text-ivory-50/60">
          <nav aria-label="مسار التنقل" className="flex items-center gap-1.5">
            <Link href="/" className="hover:underline">الرئيسية</Link>
            <span>/</span>
            <span className="font-bold text-navy-900 dark:text-ivory-50">لوحة الأدمن</span>
          </nav>
        </div>
      </header>

      <div className="container-landing grid gap-4 py-4 sm:py-6 lg:py-8">
        {/* محتوى AdminPanel: إدارة المنتجات + إحصائيات + قائمة المستخدمين */}
        <AdminPanel email={email} />

        {/* فاصل بصري */}
        <hr className="my-2 border-navy-900/10 dark:border-white/10" />

        {/* صحة الروابط (HealthPanel) */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold sm:text-xl">
              🔗 صحة الروابط
            </h2>
            <span className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[10px] font-bold text-navy-700 dark:bg-white/5 dark:text-ivory-50">
              فحص روابط المنتجات
            </span>
          </div>
          <HealthPanel />
        </section>
      </div>
    </main>
  );
}
