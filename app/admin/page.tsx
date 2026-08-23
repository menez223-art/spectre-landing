import { redirect } from "next/navigation";
import { getAdminSession } from "@/app/lib/adminAuth";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export const dynamic = "force-dynamic";

// صفحة إدارة الاشتراكات — يدخلها الأدمن فقط عبر جلسة الكوكي الموقّعة.
// أي زائر بلا جلسة صالحة يُعاد للرئيسية (حيث صندوق دخول الأدمن).
export default function AdminPage() {
  const email = getAdminSession();
  if (!email) redirect("/?admin=1");

  return (
    <main className="min-h-screen bg-ivory-50 text-navy-900 dark:bg-[#0d1117] dark:text-ivory-50">
      <header className="sticky top-0 z-30 border-b border-navy-900/10 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-[#0d1117]/85">
        <div className="container-landing flex items-center justify-between gap-3 py-4">
          <span className="font-display text-xl font-extrabold text-navy-900 dark:text-ivory-50">إدارة الاشتراكات</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action="/api/admin/login" method="delete">
              <button
                type="submit"
                className="rounded-full border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400"
              >
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="container-landing py-8">
        <AdminPanel email={email} />
      </div>
    </main>
  );
}
