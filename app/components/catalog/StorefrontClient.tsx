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
      className={"neu-tab inline-flex items-center gap-2 " + (active ? "is-active" : "")}
    >
      {label}
      <span className="neu-badge px-1.5 py-0.5 text-[10px] font-extrabold">
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

  // أثناء التحميل — هيكل بديل متناسق (ثابت بلا نبض — جهاز ضعيف).
  if (products === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="neu-inset h-72 rounded-3xl" />
        ))}
      </div>
    );
  }

  // حالة فارغة — لا منتجات معروضة للعموم بعد.
  if (products.length === 0) {
    return (
      <div className="neu-card grid place-items-center px-6 py-16 text-center">
        <p className="text-4xl t-primary"><i className="fa-solid fa-store" aria-hidden="true" /></p>
        <h2 className="mt-4 text-lg font-bold">{t("storeEmptyTitle")}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 t-muted">{t("storeEmptySub")}</p>
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
                  className="text-xl font-bold sm:text-2xl"
                >
                  {cat}
                </h2>
                <span className="text-[11px] font-bold t-muted">
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
