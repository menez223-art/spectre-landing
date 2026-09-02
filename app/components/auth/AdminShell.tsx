"use client";

// AdminShell — غلاف لوحة الأدمن مع تنقل محسّن (Sidebar على Desktop + Tabs على Mobile)
// يحتوي ثلاث وجهات: نظرة عامة / الاشتراكات / قائمة الحظر
// — كل واحدة تحافظ على بروتوكول الحظر (القراءة من نفس مصادر /api/admin/*)
//
// الاستخدام في app/admin/page.tsx:
//   <AdminShell email={email}>
//     <SubscriptionsTab email={email} />
//   </AdminShell>

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export type AdminView = "overview" | "subscriptions" | "banned" | "health";

const VIEWS: { id: AdminView; label: string; icon: string; desc: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: "📊", desc: "إحصائيات وتحذيرات" },
  { id: "subscriptions", label: "الاشتراكات", icon: "👥", desc: "إدارة المستخدمين والخطط" },
  { id: "banned", label: "قائمة الحظر", icon: "🚫", desc: "المحظورون والموقوفون" },
  { id: "health", label: "صحة الروابط", icon: "🔗", desc: "فحص روابط المنتجات" },
];

type Props = {
  email: string;
  children: (view: AdminView) => ReactNode;
};

export function AdminShell({ email, children }: Props) {
  const pathname = usePathname();
  const [view, setView] = useState<AdminView>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      {/* الشريط العلوي الثابت (Header) */}
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex items-center justify-between gap-3 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* زر القائمة على Mobile فقط */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-xl border border-navy-900/10 p-2 text-navy-700 dark:border-white/10 dark:text-ivory-50 lg:hidden"
              aria-label="فتح القائمة"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2 text-sm text-navy-700 hover:text-navy-900 dark:text-ivory-50 dark:hover:text-white">
              <span className="font-display text-base font-extrabold sm:text-xl">إدارة الاشتراكات</span>
            </Link>
          </div>
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
        <div className="container-landing hidden border-t border-navy-900/5 py-2 text-[11px] text-navy-700/60 dark:border-white/5 dark:text-ivory-50/60 sm:block">
          <nav aria-label="مسار التنقل" className="flex items-center gap-1.5">
            <Link href="/" className="hover:underline">الرئيسية</Link>
            <span>/</span>
            <span className="font-bold text-navy-900 dark:text-ivory-50">لوحة الأدمن</span>
            <span>/</span>
            <span className="text-navy-900/80 dark:text-ivory-50/80">{VIEWS.find((v) => v.id === view)?.label}</span>
          </nav>
        </div>

        {/* Tabs أفقية على Mobile (داخل الـ Header لتوفير المساحة) */}
        <div className="container-landing lg:hidden">
          <div className="flex gap-1 overflow-x-auto border-t border-navy-900/5 pt-2 dark:border-white/5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => { setView(v.id); setMobileOpen(false); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-t-xl px-3 py-2 text-[11px] font-bold transition ${
                  view === v.id
                    ? "border-b-2 border-blue-500 bg-white text-blue-700 dark:bg-[#0d1117] dark:text-blue-300"
                    : "text-navy-700/70 hover:text-navy-900 dark:text-ivory-50/70"
                }`}
              >
                <span>{v.icon}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container-landing py-4 sm:py-6 lg:py-8">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:gap-6">
          {/* Sidebar على Desktop فقط */}
          <aside className="hidden lg:block">
            <nav className="sticky top-32 grid gap-2" aria-label="قائمة الأدمن">
              <div className="rounded-2xl border border-navy-900/10 bg-white p-2 dark:border-white/10 dark:bg-[#11161d]">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-current={view === v.id ? "page" : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                      view === v.id
                        ? "bg-navy-900 text-white dark:bg-white dark:text-navy-900"
                        : "text-navy-700 hover:bg-navy-50 dark:text-ivory-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>{v.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{v.label}</span>
                      <span className={`mt-0.5 block text-[10px] ${view === v.id ? "opacity-80" : "opacity-60"}`}>
                        {v.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {/* بطاقة معلومات سريعة */}
              <div className="rounded-2xl border border-blue-200/50 bg-blue-50/50 p-3 text-[11px] dark:border-blue-500/20 dark:bg-blue-500/5">
                <p className="mb-1 font-bold text-blue-900 dark:text-blue-200">المسار الحالي</p>
                <code className="block break-all text-[10px] text-blue-700/80 dark:text-blue-300/80" dir="ltr">
                  {pathname}
                </code>
              </div>
            </nav>
          </aside>

          {/* المحتوى الرئيسي */}
          <section className="min-w-0">
            {/* عنوان الصفحة الحالية (يظهر فقط على Desktop) */}
            <div className="mb-3 hidden items-center justify-between sm:flex lg:flex">
              <h1 className="font-display text-lg font-extrabold text-navy-900 dark:text-ivory-50 sm:text-xl">
                {VIEWS.find((v) => v.id === view)?.icon} {VIEWS.find((v) => v.id === view)?.label}
              </h1>
              <span className="rounded-full bg-navy-900/5 px-2.5 py-1 text-[10px] font-bold text-navy-700 dark:bg-white/5 dark:text-ivory-50">
                {VIEWS.find((v) => v.id === view)?.desc}
              </span>
            </div>

            {/* محتوى الـ view المختارة */}
            {children(view)}
          </section>
        </div>
      </div>

      {/* زر FAB على Mobile لفتح القائمة الجانبية كـ Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute right-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto bg-white p-4 shadow-2xl dark:bg-[#0d1117]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-extrabold">القائمة</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-navy-900/10 p-2 dark:border-white/10"
                aria-label="إغلاق"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
            <nav className="grid gap-1.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setView(v.id); setMobileOpen(false); }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-right transition ${
                    view === v.id
                      ? "bg-navy-900 text-white dark:bg-white dark:text-navy-900"
                      : "bg-navy-50 text-navy-900 hover:bg-navy-100 dark:bg-white/5 dark:text-ivory-50 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg" aria-hidden>{v.icon}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{v.label}</span>
                    <span className="block text-[10px] opacity-70">{v.desc}</span>
                  </span>
                </button>
              ))}
            </nav>
            <div className="mt-4 rounded-xl bg-rose-50 p-3 text-[11px] dark:bg-rose-900/20">
              <p className="font-bold text-rose-700 dark:text-rose-300">المسؤول:</p>
              <p className="text-rose-700/80 dark:text-rose-300/80">{email}</p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
