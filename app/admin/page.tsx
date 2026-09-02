import { redirect } from "next/navigation";
import { getAdminSession } from "@/app/lib/adminAuth";
import { AdminPanel } from "@/app/components/auth/AdminPanel";
import { AdminShell, type AdminView } from "@/app/components/auth/AdminShell";
import { BannedPanel } from "@/app/components/auth/BannedPanel";
import { HealthPanel } from "@/app/components/auth/HealthPanel";

export const dynamic = "force-dynamic";

// صفحة إدارة الاشتراكات — يدخلها الأدمن فقط عبر جلسة الكوكي الموقّعة.
// أي زائر بلا جلسة صالحة يُعاد للرئيسية (حيث صندوق دخول الأدمن).
// AdminShell يوفّر تنقلاً محسّناً: Sidebar على Desktop + Tabs/Drawer على Mobile
// + Breadcrumb. يلتزم ببروتوكول الحظر (يقرأ من نفس APIs ولا يكسر fail-closed).
export default function AdminPage() {
  const email = getAdminSession();
  if (!email) redirect("/?admin=1");

  return (
    <AdminShell email={email}>
      {(view: AdminView) => {
        switch (view) {
          case "overview":
          case "subscriptions":
            // نفس شاشة الاشتراكات (تحتوي إحصائيات + قائمة + تحذيرات)
            return <AdminPanel email={email} />;
          case "banned":
            return <BannedPanel />;
          case "health":
            return <HealthPanel />;
          default:
            return <AdminPanel email={email} />;
        }
      }}
    </AdminShell>
  );
}
