"use client";

// AdminPageClient — صفحة الأدمن مع 4 أزرار تنقل في الـ Header:
//   1. 📊 الاشتراكات (AdminPanel — افتراضي)
//   2. 🚫 قائمة الحظر (BannedPanel)
//   3. 🔗 صحة الروابط (HealthPanel)
//   4. 🛒 إدارة منتجات المتجر (يفتح /studio في تبويب جديد)
//
// لا تكرار: AdminPanel الداخلي يحوي بالفعل Tabs الخطط + البحث + القوائم.
// Header فقط يبدّل الـ view الكبير.

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { BannedPanel } from "@/app/components/auth/BannedPanel";
import { HealthPanel } from "@/app/components/auth/HealthPanel";

type AdminView = "subscriptions" | "banned" | "health";

const NAV: { id: AdminView; label: string; icon: string }[] = [
  { id: "subscriptions", label: "الاشتراكات", icon: "📊" },
  { id: "banned", label: "قائمة الحظر", icon: "🚫" },
  { id: "health", label: "صحة الروابط", icon: "🔗" },
];

type Props = {
  email: string;
};

export function AdminPageClient({ email }: Props) {
  const [view, setView] = useState<AdminView>("subscriptions");

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* Header مع 4 أزرار تنقل + breadcrumb */}
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

        {/* أزرار التنقل الأربعة — في الـ Header */}
        <div className="container-landing border-t border-navy-900/5 py-2 dark:border-white/5">
          <nav className="flex flex-wrap items-center gap-1.5" aria-label="تنقل الأدمن">
            {NAV.map((n) => {
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setView(n.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition sm:text-xs ${
                    active
                      ? "bg-navy-900 text-white dark:bg-white dark:text-navy-900"
                      : "bg-navy-50 text-navy-700 hover:bg-navy-100 dark:bg-white/5 dark:text-ivory-50 dark:hover:bg-white/10"
                  }`}
                >
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              );
            })}

            {/* زر "إدارة منتجات المتجر" — يفتح /studio في تبويب جديد (رابط خارجي) */}
            <a
              href="/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 sm:text-xs dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            >
              <span>🛒</span>
              <span>إدارة منتجات المتجر</span>
              <span aria-hidden className="text-[10px] opacity-70">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <div className="container-landing py-4 sm:py-6 lg:py-8">
        {view === "subscriptions" && <AdminPanel email={email} />}
        {view === "banned" && <BannedPanel />}
        {view === "health" && <HealthPanel />}
      </div>
    </main>
  );
}
