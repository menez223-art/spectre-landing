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

// بطاقة منتج واحدة — رابطها يفتح صفحة المنتج /p/<id>. هوية Neumorphism.
export function ProductCard({ product }: { product: StoreCard }) {
  const { t } = useLocale();
  return (
    <article className="neu-card group flex flex-col overflow-hidden">
      <Link
        href={`/p/${product.id}`}
        className="neu-inset relative block aspect-[4/3] overflow-hidden rounded-3xl"
      >
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl t-muted">
            <i className="fa-solid fa-store" aria-hidden="true" />
          </div>
        )}
        {product.badge && (
          <span className="neu-badge absolute top-3 start-3">
            {product.badge}
          </span>
        )}
        {product.oldPrice && product.oldPrice > product.price && (
          <span className="neu-badge neu-badge--danger absolute top-3 end-3">
            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-bold sm:text-base">
              <Link href={`/p/${product.id}`} className="neu-link">
                {product.name}
              </Link>
            </h4>
            {product.eyebrow && (
              <p className="mt-1 truncate text-[11px] font-semibold t-muted">
                {product.eyebrow}
              </p>
            )}
            {product.ownerDisplayName && (
              <p className="mt-1 truncate text-[11px] font-bold t-success">
                <i className="fa-solid fa-store" aria-hidden="true" /> {t("byOwner")} {product.ownerDisplayName}
              </p>
            )}
          </div>
          <div className="shrink-0 text-end">
            <p className="text-base font-bold sm:text-lg">
              {formatDZD(product.price)}
            </p>
            {product.oldPrice && product.oldPrice > product.price && (
              <p className="text-[11px] t-muted line-through">
                {formatDZD(product.oldPrice)}
              </p>
            )}
          </div>
        </div>

        <Link
          href={`/p/${product.id}`}
          className="neu-btn neu-btn--block mt-auto"
        >
          {t("openPage")}
        </Link>
      </div>
    </article>
  );
}
