"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Product } from "@/app/lib/types";
import {
  deleteProduct,
  getAllProducts,
  getGeneratedProducts,
  purgeLegacySamples,
} from "@/app/lib/storage";
import { formatDZD } from "@/app/data/delivery";
import { useLocale } from "@/app/components/LocaleProvider";

// فهرس المنتجات — يبدأ بالمنتجات الثابتة (SSR) ثم يدمج المولّدة من localStorage
export function CatalogLocal({
  staticProducts,
}: {
  staticProducts: Product[];
}) {
  const { t } = useLocale();
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [generatedIds, setGeneratedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    purgeLegacySamples();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    setProducts(getAllProducts());
    setGeneratedIds(new Set(getGeneratedProducts().map((p) => p.id)));
  }

  function handleDelete(id: string) {
    deleteProduct(id);
    refresh();
  }

  if (products.length === 0) {
    return (
      <div className="grid place-items-center rounded-3xl border border-navy-900/10 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-4xl">🎨</p>
        <h2 className="mt-4 font-display text-lg font-extrabold text-navy-900">{t("emptyTitle")}</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-navy-900/60">
          {t("emptySub")}
        </p>
        <Link
          href="/studio"
          className="mt-6 rounded-full bg-navy-900 px-6 py-3 text-sm font-bold text-ivory-50 transition hover:bg-navy-700"
        >
          {t("createLanding")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="group flex flex-col overflow-hidden rounded-3xl border border-navy-900/10 bg-white shadow-sm transition hover:-translate-y-1 hover:border-navy-400/40 hover:shadow-xl hover:shadow-navy-500/10"
        >
          <Link href={`/p/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-ivory-100">
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
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
                <h3 className="truncate font-display text-base font-bold text-navy-900">
                  <Link href={`/p/${product.id}`} className="transition hover:text-navy-400">
                    {product.name}
                  </Link>
                </h3>
                {product.eyebrow && (
                  <p className="mt-1 truncate text-[11px] font-semibold text-navy-900/45">{product.eyebrow}</p>
                )}
              </div>
              <div className="shrink-0 text-end">
                <p className="font-display text-lg font-extrabold text-navy-900">{formatDZD(product.price)}</p>
                {product.oldPrice && product.oldPrice > product.price && (
                  <p className="text-[11px] text-navy-900/40 line-through">{formatDZD(product.oldPrice)}</p>
                )}
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2">
              <Link
                href={`/p/${product.id}`}
                className="flex-1 rounded-full bg-navy-900 px-4 py-2.5 text-center text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
              >
                {t("openPage")}
              </Link>
              {generatedIds.has(product.id) ? (
                <>
                  <Link
                    href={`/studio?id=${product.id}`}
                    className="rounded-full border border-navy-900/15 px-3 py-2.5 text-xs font-bold text-navy-700 transition hover:border-navy-500"
                    aria-label={`${t("edit")} ${product.name}`}
                  >
                    {t("edit")}
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="rounded-full border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50"
                    aria-label={`${t("deleteItem")} ${product.name}`}
                  >
                    {t("deleteItem")}
                  </button>
                </>
              ) : (
                <span
                  className="rounded-full border border-navy-900/10 px-3 py-2.5 text-[10px] font-bold text-navy-900/40"
                  title={t("permanent")}
                >
                  {t("permanent")}
                </span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
