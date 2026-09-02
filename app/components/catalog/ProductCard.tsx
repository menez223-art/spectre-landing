"use client";

import Link from "next/link";
import { formatDZD } from "@/app/data/delivery";
import { useLocale } from "@/app/components/LocaleProvider";

// بطاقة منتج في المتجر العام — حقول عامة فقط تصل من /api/catalog
// (لا بيانات ملكية/اشتراك).
export interface StoreCard {
  id: string;
  name: string;
  image: string | null;
  price: number;
  oldPrice: number | null;
  badge: string | null;
  eyebrow: string | null;
  ownerDisplayName: string | null;
  category: string | null;
}

// ترتيب عرض الكاتيغوري — المعروفة أولاً، ثم «أخرى» لأي قيمة غير معروفة.
// مطابق لقائمة CATEGORIES في autoContent («عام» يُعامَل كتصنيف معروف في الذيل).
export const CATEGORY_ORDER: string[] = [
  "إلكترونيات",
  "ملابس",
  "أحذية",
  "إكسسوارات",
  "منزل ومطبخ",
  "عناية وجمال",
  "عام",
];
export const OTHER_BUCKET = "أخرى";

// تجميع المنتجات حسب الكاتيغوري بترتيب ثابت: المعروفة أولاً، غير المعروفة في «أخرى».
export function groupByCategory(products: StoreCard[]): Array<[string, StoreCard[]]> {
  const buckets = new Map<string, StoreCard[]>();
  for (const p of products) {
    const cat = p.category ?? "عام";
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(p);
  }
  const known: Array<[string, StoreCard[]]> = [];
  const other: StoreCard[] = [];
  buckets.forEach((items, cat) => {
    if (CATEGORY_ORDER.includes(cat)) known.push([cat, items]);
    else other.push(...items);
  });
  known.sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]));
  const result = [...known];
  if (other.length > 0) result.push([OTHER_BUCKET, other]);
  return result;
}

// قائمة التصنيفات الحاضرة فعلياً (لها منتج واحد على الأقل) بالترتيب الثابت.
export function presentCategories(products: StoreCard[]): string[] {
  return groupByCategory(products).map(([cat]) => cat);
}

// بطاقة منتج واحدة — رابطها يفتح صفحة المنتج /p/<id>.
export function ProductCard({ product }: { product: StoreCard }) {
  const { t } = useLocale();
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-navy-900/10 bg-white shadow-sm transition hover:-translate-y-1 hover:border-navy-400/40 hover:shadow-xl hover:shadow-navy-500/10 dark:border-white/10 dark:bg-[#161b22]">
      <Link
        href={`/p/${product.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-ivory-100 dark:bg-white/5"
      >
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
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

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-display text-sm font-bold text-navy-900 sm:text-base dark:text-ivory-50">
              <Link href={`/p/${product.id}`} className="transition hover:text-navy-400">
                {product.name}
              </Link>
            </h4>
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
            <p className="font-display text-base font-extrabold text-navy-900 sm:text-lg dark:text-ivory-50">
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
  );
}
