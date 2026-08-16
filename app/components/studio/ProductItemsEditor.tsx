"use client";

import type { Lang } from "@/app/lib/i18n";
import { translate, type I18nKey } from "@/app/lib/i18n";

interface ColorDraft {
  name: string;
  hex: string;
}

export interface ProductItemDraft {
  name: string;
  nameEn: string;
  price: string;
  oldPrice: string;
  image: string;
  images: string[];
  colors: ColorDraft[];
}

interface Props {
  items: ProductItemDraft[];
  activeIndex: number;
  remainingImages: number;
  maxProducts: number;
  lang: Lang;
  dir: "rtl" | "ltr";
  onSelect: (index: number) => void;
  onChange: (items: ProductItemDraft[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

function fmtPrice(raw: string): string {
  const n = Number(raw);
  if (!raw.trim() || Number.isNaN(n) || n <= 0) return "—";
  return `${n.toLocaleString("en-US")} DA`;
}

export function ProductItemsEditor({
  items,
  activeIndex,
  remainingImages,
  maxProducts,
  lang,
  dir,
  onSelect,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  const t = (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const update = (index: number, patch: Partial<ProductItemDraft>) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const canAdd = items.length < maxProducts;

  return (
    <section className="grid gap-4 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#11161d]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">{t("productsTitle")}</h2>
        <span className="text-[11px] font-semibold text-navy-900/45">
          {t("productsCount", { n: items.length, max: maxProducts })}
        </span>
      </div>
      <p className="text-[11px] leading-5 text-navy-900/45">
        {t("productsHint")} {t("imagesRemaining", { n: remainingImages })}
      </p>

      {/* قائمة العناصر */}
      <div className="grid gap-2">
        {items.map((it, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={i}
              dir={dir}
              className={`flex items-center gap-3 rounded-2xl border p-2.5 transition ${
                isActive
                  ? "border-navy-500 bg-ivory-50 dark:border-navy-400 dark:bg-[#161b22]"
                  : "border-navy-900/10 bg-transparent hover:border-navy-500/40 dark:border-white/10"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex flex-1 items-center gap-3 text-start"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ivory-100 ring-1 ring-navy-900/10">
                  {it.image ? (
                    <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-base">📦</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-navy-900 dark:text-ivory-50">
                    {it.name?.trim() || `#${i + 1}`}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-navy-900/50">
                    <span>{fmtPrice(it.price)}</span>
                    {(it.images.length > 0 || it.image) && (
                      <span>
                        · {t("imagesN", { n: (it.image ? 1 : 0) + it.images.length })}
                      </span>
                    )}
                    {it.colors.length > 0 && (
                      <span className="flex items-center gap-1">
                        ·{" "}
                        {it.colors.slice(0, 4).map((c, k) => (
                          <span
                            key={k}
                            className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                            style={{ background: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#888" }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="shrink-0 rounded-full border border-red-400/30 px-2.5 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                  aria-label={t("remove")}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* إضافة عنصر */}
      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        className="rounded-full border border-dashed border-navy-900/25 px-4 py-2.5 text-xs font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:text-ivory-50"
      >
        + {t("addProduct")}
      </button>

      {/* حقول العنصر النشط */}
      <div className="grid gap-3 border-t border-navy-900/10 pt-4 dark:border-white/10">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
            <span>{t("productName")}</span>
            <input
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
              value={items[activeIndex]?.name ?? ""}
              onChange={(e) => update(activeIndex, { name: e.target.value })}
              placeholder={t("productNamePh")}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
            <span>{t("nameEn")}</span>
            <input
              dir="ltr"
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
              value={items[activeIndex]?.nameEn ?? ""}
              onChange={(e) => update(activeIndex, { nameEn: e.target.value })}
              placeholder="Pro Wireless Earbuds"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
            <span>{t("price")}</span>
            <input
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
              value={items[activeIndex]?.price ?? ""}
              onChange={(e) => update(activeIndex, { price: e.target.value })}
              placeholder="4500"
              inputMode="numeric"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-navy-700">
            <span>{t("oldPrice")}</span>
            <input
              className="w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
              value={items[activeIndex]?.oldPrice ?? ""}
              onChange={(e) => update(activeIndex, { oldPrice: e.target.value })}
              placeholder="5000"
              inputMode="numeric"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
