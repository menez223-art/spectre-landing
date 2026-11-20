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
  // لفتة تُعرض أسفل زر الإضافة عند بلوغ حدّ الخطة (مثلاً «خطتك تسمح بمنتج واحد»).
  atLimitNote?: string;
  lang: Lang;
  dir: "rtl" | "ltr";
  onSelect: (index: number) => void;
  onChange: (items: ProductItemDraft[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  // عند true لا نرسم الحدود/الظل الخارجي — نُضمَّ مع قسم الصورة/الألوان
  // في لوحة واحدة (دمج بصري لتقليل اللوحات المتناثرة في الستوديو).
  bare?: boolean;
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
  atLimitNote,
  lang,
  dir,
  onSelect,
  onChange,
  onAdd,
  onRemove,
  bare = false,
}: Props) {
  const t = (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars);

  const update = (index: number, patch: Partial<ProductItemDraft>) => {
    const next = items.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const canAdd = items.length < maxProducts;

  return (
    <section className={bare ? "grid gap-4" : "neu-card grid gap-4 p-5"}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{t("productsTitle")}</h2>
        <span className="text-[11px] font-semibold t-muted">
          {t("productsCount", { n: items.length, max: maxProducts })}
        </span>
      </div>
      <p className="text-[11px] leading-5 t-muted">
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
              className={`neu-row flex items-center gap-3 !p-2.5 transition ${
                isActive
                  ? "![box-shadow:var(--shadow-inner-sm)]"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex flex-1 items-center gap-3 text-start"
              >
                <div className="neu-inset relative h-12 w-12 shrink-0 overflow-hidden">
                  {it.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- صورة مصغّرة data:URL محلية */
                    <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-base"><i className="fa-solid fa-box t-muted" aria-hidden="true" /></span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {it.name?.trim() || `#${i + 1}`}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] t-muted">
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
                            className="inline-block h-2.5 w-2.5 rounded-full [box-shadow:var(--shadow-inner-sm)]"
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
                  className="neu-btn neu-btn--danger shrink-0 !px-2.5 !py-1 !text-xs"
                  aria-label={t("remove")}
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
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
        className="w-full rounded-[var(--r-control)] border-[1.5px] border-dashed border-[var(--text-muted)] bg-[var(--bg-color)] px-4 py-2.5 text-xs font-bold t-muted transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        <i className="fa-solid fa-plus" aria-hidden="true" /> {t("addProduct")}
      </button>
      {!canAdd && atLimitNote ? (
        <p
          className="neu-inset px-3 py-2 text-[11px] font-semibold t-warning"
          dir="auto"
        >
          {atLimitNote}
        </p>
      ) : null}

      {/* حقول العنصر النشط */}
      <div className="grid gap-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("productName")}</span>
            <input
              className="neu-input"
              value={items[activeIndex]?.name ?? ""}
              onChange={(e) => update(activeIndex, { name: e.target.value })}
              placeholder={t("productNamePh")}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("nameEn")}</span>
            <input
              dir="ltr"
              className="neu-input"
              value={items[activeIndex]?.nameEn ?? ""}
              onChange={(e) => update(activeIndex, { nameEn: e.target.value })}
              placeholder="Pro Wireless Earbuds"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("price")}</span>
            <input
              className="neu-input"
              value={items[activeIndex]?.price ?? ""}
              onChange={(e) => update(activeIndex, { price: e.target.value })}
              placeholder="4500"
              inputMode="numeric"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>{t("oldPrice")}</span>
            <input
              className="neu-input"
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
