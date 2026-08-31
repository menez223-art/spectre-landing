"use client";

import { useEffect } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import { AdminLoginBox } from "@/app/components/AdminLoginBox";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * AdminLoginModal — غلاف زجاج سائل لـ AdminLoginBox.
 * Escape للإغلاق + منع تمرير الخلفية + نقرة على الخلفية تغلق.
 */
export function AdminLoginModal({ open, onClose }: Props) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="liquid-glass liquid-glass--rounded w-full max-w-md overflow-hidden rounded-3xl p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-navy-900 dark:text-ivory-50">
            {t("adminLoginTitle")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-8 w-8 place-items-center rounded-full text-navy-500 transition hover:bg-navy-900/5 hover:text-navy-900 dark:text-ivory-50/60 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>
        <AdminLoginBox />
      </div>
    </div>
  );
}
