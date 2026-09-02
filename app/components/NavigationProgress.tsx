"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// شريط تقدم علوي رفيع يظهر فوراً عند بدء التنقل ويختفي عند اكتمال التحميل.
// يعطي إحساساً فورياً بالاستجابة حتى قبل ظهور شاشة التحميل الداخلية.
// يستخدم requestAnimationFrame للتمليس البصري ولا يعرقل التصفح (z-index منخفض).
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // عند تغيّر المسار = اكتمل التنقل → إخفاء فوري بشريط تقدم 100%.
    setProgress(100);
    const t = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 240);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    // يبدأ تقدماً وهمياً سريعا (0 → 70%) ثم يتباطأ (70 → 95%) حتى تكتمل الصفحة.
    // هذا يعطي شعوراً بالاستجابة دون وعود كاذبة.
    let raf = 0;
    let mounted = true;
    const start = Date.now();

    function tick() {
      if (!mounted) return;
      const elapsed = Date.now() - start;
      // منحنى لوجاريتمي: 0→70% خلال أول 400ms، ثم بطيء حتى 95% في 1.6s
      let next = 0;
      if (elapsed < 400) {
        next = (elapsed / 400) * 70;
      } else {
        next = 70 + Math.min(25, ((elapsed - 400) / 1600) * 25);
      }
      setProgress(next);
      raf = requestAnimationFrame(tick);
    }

    // يبدأ فقط إذا لم يكتمل التنقل بعد (مثلاً تأخر > 100ms).
    const delayTimer = setTimeout(() => {
      if (!mounted) return;
      setVisible(true);
      raf = requestAnimationFrame(tick);
    }, 80);

    return () => {
      mounted = false;
      clearTimeout(delayTimer);
      cancelAnimationFrame(raf);
    };
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