"use client";

import Link from "next/link";

type Props = {
  className: string;
  children: React.ReactNode;
  href?: string;
};

/**
 * StudioLink — غلاف موحّد لـ Link إلى /studio مع تأثير انتقال سلس.
 * يستعمل <Link prefetch> كي يحمّل Next.js الحزمة مسبقاً فيصبح التنقّل فورياً.
 */
export function StudioLink({ className, children, href = "/studio" }: Props) {
  const handleClick = () => {
    const root = document.documentElement;
    root.classList.add("page-enter", "page-enter-active");
    requestAnimationFrame(() => root.classList.remove("page-enter"));
    setTimeout(() => root.classList.remove("page-enter-active"), 120);
  };
  return (
    <Link href={href} prefetch onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
