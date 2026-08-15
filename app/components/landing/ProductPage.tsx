"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/app/lib/types";
import { getProduct } from "@/app/lib/storage";
import { useLocale } from "@/app/components/LocaleProvider";
import { ProductLanding } from "./ProductLanding";

// حقل صفحة /p/[slug] — يبدأ بالمنتج الثابت (SSR) ثم يترك نسخة localStorage تتفوّق إن وُجدت
export function ProductPage({
  slug,
  staticProduct,
}: {
  slug: string;
  staticProduct: Product | null;
}) {
  const { t } = useLocale();
  const [product, setProduct] = useState<Product | null>(staticProduct);
  const [checked, setChecked] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // النسخة المنشورة (من الخادم/Blob) هي المصدر الحيّ لإعدادات المنتج
    // (أسعار التوصيل المخصّصة وغيرها). نتركها متفوّقة، ونستعمل نسخة
    // localStorage فقط كنسخة احتياطية إن غابت النسخة المنشورة.
    const local = getProduct(slug);
    if (!product && local) setProduct(local);
    setChecked(true);
  }, [slug, product]);

  // كشف وضع الجوال — زر «معاينة» يظهر فقط على الشاشات الصغيرة
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (product) {
    return (
      <>
        <ProductLanding product={product} />

        {/* زر المعاينة العائم — يظهر فقط على الجوال */}
        {isMobile && !previewOpen && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-navy-900 px-6 py-3 text-sm font-bold text-ivory-50 shadow-2xl shadow-navy-900/40 transition hover:bg-navy-700"
          >
            👁 {t("previewBtn")}
          </button>
        )}

        {/* نافذة المعاينة — للعرض فقط، غير قابلة للتعديل أو التحميل */}
        {previewOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-navy-950/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0d1117] px-4 py-3 text-ivory-50">
              <div className="min-w-0">
                <p className="text-sm font-bold">{t("previewTitle")}</p>
                <p className="truncate text-[11px] text-ivory-50/60">{t("previewNote")}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:border-white/40"
              >
                {t("close")}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ProductLanding product={product} preview />
            </div>
          </div>
        )}
      </>
    );
  }

  // هيكل حتمي أثناء التحقق من localStorage — نفس الشكل لتفادي اختلاف الترطيب
  if (!checked) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="container-landing grid gap-14 py-16 lg:grid-cols-[1fr_0.95fr] lg:py-24">
          <div className="space-y-6">
            <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-12 w-4/5 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-12 w-3/5 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-6 w-full animate-pulse rounded-xl bg-white/10" />
            <div className="h-6 w-2/3 animate-pulse rounded-xl bg-white/10" />
          </div>
          <div className="aspect-[0.88] animate-pulse rounded-3xl bg-white/10" />
        </div>
      </main>
    );
  }

  // غير موجود على هذا الجهاز
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="font-display text-7xl font-extrabold text-white/15">404</p>
        <h1 className="mt-4 font-display text-3xl font-extrabold">هذه الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm text-white/50">
          المنتج الذي تبحث عنه لم يُنشأ بعد على هذا الجهاز.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-white/80"
          >
            العودة إلى الفهرس
          </Link>
          <Link
            href="/studio"
            className="rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            إنشاء صفحة هبوط
          </Link>
        </div>
      </div>
    </main>
  );
}
