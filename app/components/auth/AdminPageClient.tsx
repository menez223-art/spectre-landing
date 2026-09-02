"use client";

// AdminPageClient — صفحة الأدمن مع تنقل Anchor (Scroll-to-section).
//
// الـ Header فيه 4 أزرار تنقل تعمل كـ Anchor links (scroll to section):
//   1. 📊 الاشتراكات       → #section-subscriptions
//   2. 🚫 قائمة الحظر      → #section-banned
//   3. 🔗 صحة الروابط      → #section-health
//   4. 🛒 إدارة منتجات المتجر → /studio (خارجي، تبويب جديد)
//
// لا تبديل محتوى: كل الأقسام تظهر تحت بعضها في صفحة واحدة طويلة
// (AdminPanel → BannedPanel → HealthPanel). الـ Header فقط يسهّل
// التنقل بالـ scroll + smooth.

import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { BannedPanel } from "@/app/components/auth/BannedPanel";
import { HealthPanel } from "@/app/components/auth/HealthPanel";

const NAV: { id: string; label: string; icon: string; href: string; external?: boolean }[] = [
  { id: "nav-subscriptions", label: "الاشتراكات", icon: "📊", href: "#section-subscriptions" },
  { id: "nav-banned", label: "قائمة الحظر", icon: "🚫", href: "#section-banned" },
  { id: "nav-health", label: "صحة الروابط", icon: "🔗", href: "#section-health" },
  { id: "nav-studio", label: "إدارة منتجات المتجر", icon: "🛒", href: "/studio", external: true },
];

type Props = {
  email: string;
};

export function AdminPageClient({ email }: Props) {
  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* Header مع 4 أزرار تنقل (Anchor + رابط خارجي) */}
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex flex-wrap items-center justify-between gap-3 py-3 sm:py-4">
          <Link href="/" className="font-display text-base font-extrabold sm:text-xl">
            إدارة الاشتراكات
          </Link>
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

        {/* أزرار التنقل — كلها في الـ Header */}
        <div className="container-landing border-t border-navy-900/5 py-2 dark:border-white/5">
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="تنقل الأدمن">
            {NAV.map((n) =>
              n.external ? (
                <a
                  key={n.id}
                  id={n.id}
                  href={n.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 sm:text-xs dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                >
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                  <span aria-hidden className="text-[10px] opacity-70">↗</span>
                </a>
              ) : (
                <a
                  key={n.id}
                  id={n.id}
                  href={n.href}
                  className="flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:bg-navy-100 sm:text-xs dark:bg-white/5 dark:text-ivory-50 dark:hover:bg-white/10"
                >
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                </a>
              )
            )}
          </nav>
        </div>
      </header>

      <div className="container-landing grid gap-8 py-4 sm:py-6 lg:py-8">
        {/* القسم 1: الاشتراكات (AdminPanel) */}
        <section id="section-subscriptions" aria-labelledby="nav-subscriptions" className="scroll-mt-32">
          <AdminPanel email={email} />
        </section>

        <hr className="border-navy-900/10 dark:border-white/10" />

        {/* القسم 2: قائمة الحظر */}
        <section id="section-banned" aria-labelledby="nav-banned" className="scroll-mt-32">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold sm:text-xl">
              🚫 قائمة الحظر
            </h2>
            <span className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[10px] font-bold text-navy-700 dark:bg-white/5 dark:text-ivory-50">
              المحظورون والموقوفون
            </span>
          </div>
          <BannedPanel />
        </section>

        <hr className="border-navy-900/10 dark:border-white/10" />

        {/* القسم 3: صحة الروابط */}
        <section id="section-health" aria-labelledby="nav-health" className="scroll-mt-32">
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
