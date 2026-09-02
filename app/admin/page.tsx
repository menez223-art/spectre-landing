import { redirect } from "next/navigation";
import { getAdminSession } from "@/app/lib/adminAuth";
import { AdminPageClient } from "@/app/components/auth/AdminPageClient";

export const dynamic = "force-dynamic";

// صفحة إدارة الاشتراكات — يدخلها الأدمن فقط عبر جلسة الكوكي الموقّعة.
// أي زائر بلا جلسة صالحة يُعاد للرئيسية (حيث صندوق دخول الأدمن).
// AdminPageClient يدمج التنقل + المحتوى في مكون client واحد
// (لا يستخدم render function كـ child لتفادي server/client boundary).
export default function AdminPage() {
  const email = getAdminSession();
  if (!email) redirect("/?admin=1");

  return <AdminPageClient email={email} />;
}
