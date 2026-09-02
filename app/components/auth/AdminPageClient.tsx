"use client";

// AdminPageClient — صفحة الأدمن المبسّطة.
//
// لا تكرار:
//   - لا Tabs علوية (التنقل داخل AdminPanel كافٍ: بحث + status filter + plan filter)
//   - لا أقسام منفصلة (BannedPanel مكرر مع status filter في AdminPanel)
//   - لا HealthPanel منفصل (الروابط موجودة في catalog وتُفحص يدويًا)
//
// Header بسيط: logo + email + theme + logout + رابط سريع لـ /studio.

import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminPanel } from "@/app/components/auth/AdminPanel";

type Props = {
  email: string;
};

export function AdminPageClient({ email }: Props) {
  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* Header بسيط */}
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-base font-extrabold sm:text-xl">
              إدارة الاشتراكات
            </Link>
            <a
              href="/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 sm:inline-flex sm:text-xs dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              title="فتح الاستوديو في تبويب جديد"
            >
              <span>🛒</span>
              <span>إدارة منتجات المتجر</span>
              <span aria-hidden className="text-[10px] opacity-70">↗</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
      </header>

      <div className="container-landing py-4 sm:py-6 lg:py-8">
        <AdminPanel email={email} />
      </div>
    </main>
  );
}
