"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";
import {
  ProductCard,
  groupByCategory,
  presentCategories,
  type StoreCard,
} from "./ProductCard";

// قيمة التبويب «الكل» — رمز داخلي لا يصطدم بأي اسم تصنيف حقيقي.
const ALL = "__all__";

// شريحة تصفية واحدة (تبويب تصنيف) — مع عدّاد المنتجات.
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition " +
        (active
          ? "bg-navy-900 text-ivory-50 shadow-sm dark:bg-white/15"
          : "border border-navy-900/12 text-navy-700 hover:border-navy-500 hover:text-navy-900 dark:border-white/12 dark:text-ivory-50/70 dark:hover:text-ivory-50")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[10px] font-extrabold " +
          (active ? "bg-white/20 text-ivory-50" : "bg-navy-900/8 text-navy-700/70 dark:bg-white/10 dark:text-ivory-50/60")
        }
      >
        {count}
      </span>
    </button>
  );
}

// المتجر العام القابل للتصفية — يجلب المنتجات المُدرَجة من /api/catalog.
// «الكل» يعرض كل الأقسام مجمّعة حسب التصنيف؛ اختيار تصنيف يفلتر شبكته وحده.
export function StorefrontClient() {
  const { t } = useLocale();
  const [products, setProducts] = useState<StoreCard[] | null>(null);
  const [active, setActive] = useState<string>(ALL);

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

  const grouped = useMemo(() => (products ? groupByCategory(products) : []), [products]);
  const cats = useMemo(() => (products ? presentCategories(products) : []), [products]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    grouped.forEach(([cat, items]) => m.set(cat, items.length));
    return m;
  }, [grouped]);

  // إن اختفى التصنيف النشط بعد تحديث البيانات — نعود إلى «الكل».
  useEffect(() => {
    if (active !== ALL && !cats.includes(active)) setActive(ALL);
  }, [active, cats]);

  // أثناء التحميل — هيكل بديل متناسق.
  if (products === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-3xl bg-navy-900/10 dark:bg-white/10" />
        ))}
      </div>
    );
  }

  // حالة فارغة — لا منتجات معروضة للعموم بعد.
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

  const activeItems =
    active === ALL ? [] : grouped.find(([cat]) => cat === active)?.[1] ?? [];

  return (
    <div className="grid gap-8">
      {/* شريط التصنيفات — «الكل» ثم كل تصنيف حاضر فعلياً */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label={t("storeFilterAll")}
          count={products.length}
          active={active === ALL}
          onClick={() => setActive(ALL)}
        />
        {cats.map((c) => (
          <FilterChip
            key={c}
            label={c}
            count={counts.get(c) ?? 0}
            active={active === c}
            onClick={() => setActive(c)}
          />
        ))}
      </div>

      {active === ALL ? (
        // «الكل» — أقسام متتابعة، كل تصنيف عنوان وتحته شبكته.
        <div className="grid gap-10 sm:gap-12">
          {grouped.map(([cat, items]) => (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
                <h2
                  id={`cat-${cat}`}
                  className="font-display text-xl font-extrabold text-navy-900 sm:text-2xl dark:text-ivory-50"
                >
                  {cat}
                </h2>
                <span className="text-[11px] font-bold text-navy-900/45 dark:text-ivory-50/45">
                  {t("catalogSectionCount", { n: items.length })}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        // تصنيف واحد — شبكة مفلترة لهذا التصنيف وحده.
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {activeItems.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
