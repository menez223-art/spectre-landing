"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// شريط تقدم علوي رفيع يظهر عند اكتمال التنقل (وميض 100%) ثم يختفي.
// ملاحظة (2026-09-16): كانت هنا محاكاة «تقدم أثناء الانتظار» تعمل بعد 80ms
// من تغيّر المسار — لكن في App Router لا يتغيّر usePathname إلا **بعد** جهوزية
// الصفحة، فكان المنحنى يعمل دائماً بعد الاكتمال: يُعيد الشريط من 100% إلى ~0%
// (وميض خلبي عند كل تنقل) وحلقة requestAnimationFrame فيه لم تتوقف أبداً
// (استهلاك CPU مستمر بعد الإخفاء). أُزيل ذلك المنحنى؛ إشارة «بدء التنقل»
// الحقيقية تتطلب useLinkStatus (Next 15+) لا usePathname.
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // عند تغيّر المسار = اكتمل التنقل → وميض إتمام بشريط 100% ثم إخفاء.
    setProgress(100);
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 240);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}