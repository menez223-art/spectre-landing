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
      className="neu-app fixed inset-0 z-50 flex items-center justify-center !bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="neu-card w-full max-w-md overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {t("adminLoginTitle")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("close")}
            className="neu-circle neu-circle--sm !h-8 !w-8"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
        <AdminLoginBox />
      </div>
    </div>
  );
}
