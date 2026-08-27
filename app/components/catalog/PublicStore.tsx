"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDZD } from "@/app/data/delivery";
import { useLocale } from "@/app/components/LocaleProvider";

// بطاقة منتج في المتجر العام — حقول عامة فقط تصل من /api/catalog
// (لا بيانات ملكية/اشتراك).
interface StoreCard {
  id: string;
  name: string;
  image: string | null;
  price: number;
  oldPrice: number | null;
  badge: string | null;
  eyebrow: string | null;
  ownerDisplayName: string | null;
}

// المتجر العام — يجلب المنتجات المُدرَجة (Pro/Gold، نشطة، غير مخفاة) من
// ‎/api/catalog ويعرضها شبكة بطاقات. رابط كل بطاقة يفتح صفحة المنتج /p/<id>.
export function PublicStore() {
  const { t } = useLocale();
  const [products, setProducts] = useState<StoreCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        if (alive) setProducts(Array.isArray(data?.products) ? data.products : []);
      })
      .catch(() => {
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // أثناء التحميل — هيكل بديل متناسق مع لمسة الرئيسية.
  if (products === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-navy-900/10 dark:bg-white/10" />
        ))}
      </div>
    );
  }

  // حالة فارغة لطيفة — لا منتجات معروضة للعموم بعد.
  if (products.length === 0) {
    return (
      <div className="grid place-items-center rounded-3xl border border-navy-900/10 bg-white px-6 py-16 text-center shadow-sm dark:border-white/10 dark:bg-[#161b22]">
        <p className="text-4xl">🛍️</p>
        <h2 className="mt-4 font-display text-lg font-extrabold text-navy-900 dark:text-ivory-50">
          {t("storeEmptyTitle")}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-navy-900/60 dark:text-ivory-50/60">
          {t("storeEmptySub")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="group flex flex-col overflow-hidden rounded-3xl border border-navy-900/10 bg-white shadow-sm transition hover:-translate-y-1 hover:border-navy-400/40 hover:shadow-xl hover:shadow-navy-500/10 dark:border-white/10 dark:bg-[#161b22]"
        >
          <Link
            href={`/p/${product.id}`}
            className="relative block aspect-[4/3] overflow-hidden bg-ivory-100 dark:bg-white/5"
          >
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-4xl">🛍️</div>
            )}
            {product.badge && (
              <span className="absolute top-3 start-3 rounded-full bg-navy-900/85 px-3 py-1 text-[10px] font-bold text-ivory-50 backdrop-blur">
                {product.badge}
              </span>
            )}
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="absolute top-3 end-3 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white">
                -{Math.round((1 - product.price / product.oldPrice) * 100)}%
              </span>
            )}
          </Link>

          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold text-navy-900 dark:text-ivory-50">
                  <Link href={`/p/${product.id}`} className="transition hover:text-navy-400">
                    {product.name}
                  </Link>
                </h3>
                {product.eyebrow && (
                  <p className="mt-1 truncate text-[11px] font-semibold text-navy-900/45 dark:text-ivory-50/45">
                    {product.eyebrow}
                  </p>
                )}
                {product.ownerDisplayName && (
                  <p className="mt-1 truncate text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    🛍️ {t("byOwner")} {product.ownerDisplayName}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-end">
                <p className="font-display text-lg font-extrabold text-navy-900 dark:text-ivory-50">
                  {formatDZD(product.price)}
                </p>
                {product.oldPrice && product.oldPrice > product.price && (
                  <p className="text-[11px] text-navy-900/40 line-through dark:text-ivory-50/40">
                    {formatDZD(product.oldPrice)}
                  </p>
                )}
              </div>
            </div>

            <Link
              href={`/p/${product.id}`}
              className="mt-auto rounded-full bg-navy-900 px-4 py-2.5 text-center text-xs font-bold text-ivory-50 transition hover:bg-navy-700 dark:bg-white/10 dark:hover:bg-white/20"
            >
              {t("openPage")}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
