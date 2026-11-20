"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// صفحة الزائر/التجربة المستقلة /tryfree (طلب المالك: رابط بدل نافذة منفصلة).
// تعرض استوديو الزوار كاملاً (يتضمن تدفق رابط التجربة TrialPanel).
// يُحمَّل كسولاً كي لا يثقل الحزم الأخرى. الإغلاق يعيد إلى الرئيسية.
const GuestStudio = dynamic(
  () => import("@/app/components/auth/GuestStudio").then((m) => m.GuestStudio),
  { ssr: false }
);

export default function TryFreePage() {
  const router = useRouter();
  return <GuestStudio open onClose={() => router.replace("/")} />;
}
