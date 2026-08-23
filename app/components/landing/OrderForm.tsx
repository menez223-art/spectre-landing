"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  COMMUNES,
  DELIVERY_TYPES,
  WILAYAS,
  deliveryPricesFor,
  formatDZD,
  getWilaya,
  isWilayaMode,
  normalizeWilayaEntry,
  wilayaPriceFor,
  type DeliveryType,
} from "@/app/data/delivery";
import type { Product } from "@/app/lib/types";
import { useLandingLang } from "./LandingLang";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 bg-[var(--c-input-bg)] border-[var(--c-input-border)] text-[var(--c-input-text)] placeholder:text-[var(--c-placeholder)] focus:border-[var(--c-primary)] focus:ring-[var(--c-primary-soft)]";

const labelClass = "grid gap-2 text-xs font-semibold text-[var(--c-label)]";

// نموذج الطلب الموحّد — محل النسختين المكررتين في الصفحتين القديمتين
export function OrderForm({ product, preview = false }: { product: Product; preview?: boolean }) {
  const { t } = useLandingLang();
  const [wilayaCode, setWilayaCode] = useState("");
  const [commune, setCommune] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("home");
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [colorName, setColorName] = useState("");

  // يستبعد الألوان غير الصالحة (اسم فارغ أو كود لون باطل) للعرض فقط
  const colors = (product.colors ?? []).filter(
    (c) => c.name.trim() && /^#[0-9a-fA-F]{6}$/.test(c.hex)
  );

  // يضبط اللون المختار افتراضياً على أول لون متاح
  useEffect(() => {
    if (colors.length && !colors.some((c) => c.name === colorName)) {
      setColorName(colors[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors]);

  const wilayaMode = isWilayaMode(product);
  const wilaya = getWilaya(wilayaCode);
  const communes = wilayaCode ? COMMUNES[Number(wilayaCode)] ?? [] : [];
  const prices = deliveryPricesFor(product);

  // في وضع الولاية: نوع التوصيل (منزل/مكتب) يُختار ديناميكياً من خيارات
  // التوصيل التي تظهر بعد اختيار الولاية، وتُؤخذ أسعارها من إعداد الستوديو.
  const wilayaDelivery =
    wilayaMode && wilaya
      ? wilayaPriceFor(product, Number(wilayaCode), deliveryType, prices.home)
      : undefined;
  const delivery = wilayaMode ? (wilayaDelivery ?? 0) : prices[deliveryType];

  // السعر = سعر المنتج العادي × الكمية + التوصيل (لا عروض خاصة).
  const unitPrice = product.price;
  const base = unitPrice * quantity;
  const total = base + delivery;

  function onWilayaChange(value: string) {
    setWilayaCode(value);
    setCommune("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wilaya) return;
    const formData = new FormData(event.currentTarget);

    const payload = {
      timestamp: new Date().toISOString(),
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      wilaya: wilaya.name,
      commune: commune.trim(),
      quantity,
      deliveryType: wilayaMode
        ? "التوصيل للمنزل"
        : DELIVERY_TYPES.find((t) => t.value === deliveryType)?.label ?? deliveryType,
      totalPrice: total,
      product: product.name,
    };

    // وجهة الطلب: نمرّ عبر نقطة الوكيل الثابتة على نفس نطاقنا (/api/sheet/order)،
    // وهي تبني الرابط الحيّ من FACTORY_URL + المفتاح الثابت (sheetKey) ثم تعيد
    // التوجيه إلى Apps Script من جهة الخادم. سبب حاسم: متصفّح العميل يُعاد توجيهه
    // بـ 302 من Apps Script (صفحة "يتطلب تصريحاً") فيفشل الطلب الصريح، بينما الخادم
    // يتابع إعادة التوجيه بنجاح. فالوكيل يحلّ المشكلة تماماً دون أي عمل يدوي.
    const sheetKey = product.sheetKey ?? "";
    const sheetEmail = product.sheetEmail ?? "";

    // لا وجهة للطلب — الطلبات موقوفة، دون فقدان بيانات النموذج
    if (!(sheetKey || sheetEmail)) {
      setBlocked(true);
      setSubmitted(false);
      return;
    }
    setBlocked(false);

    setSubmitted(true);
    event.currentTarget.reset();
    setWilayaCode("");
    setCommune("");
    setQuantity(1);
    setDeliveryType("home");

    if (preview) return; // في المعاينة لا يُرسل للـ webhook

    try {
      console.info("[OrderForm] إرسال الطلب عبر الوكيل مع:", { sheetKey, sheetEmail });
      const res = await fetch("/api/sheet/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetKey, sheetEmail, order: payload }),
      });
      const txt = await res.text().catch(() => "");
      console.info("[OrderForm] رد الوكيل:", res.status, txt.slice(0, 120));
    } catch (error) {
      console.error("تعذر إرسال الطلب إلى Google Sheets:", error);
    }
  }

  const successClass =
    product.theme.mode === "dark"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
      : "border-emerald-600/30 bg-emerald-50 text-emerald-700";

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 sm:grid-cols-2 sm:p-8"
    >
      <label className={labelClass}>
        {t("fullName")}
        <input required name="name" type="text" placeholder={t("fullNamePh")} className={inputClass} />
      </label>

      <label className={labelClass}>
        {t("phone")}
        <input required name="phone" type="tel" placeholder={t("phonePh")} className={inputClass} />
      </label>

      <label className={labelClass}>
        {t("wilaya")}
        <select
          required
          name="wilaya"
          value={wilayaCode}
          onChange={(e) => onWilayaChange(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            {t("wilayaPh")}
          </option>
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.code}>
              {w.code} · {w.name}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClass}>
        {t("commune")}
        <select
          required
          name="commune"
          value={commune}
          onChange={(e) => setCommune(e.target.value)}
          disabled={!wilayaCode}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="" disabled>
            {wilayaCode ? t("communePhWilaya") : t("communePhWait")}
          </option>
          {communes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="sm:col-span-2" disabled={wilayaMode && !wilaya}>
        <legend className={labelClass}>
          {wilayaMode ? t("deliveryMethodFor", { name: wilaya ? wilaya.name : t("wilayaPh") }) : t("deliveryMethod")}
        </legend>
        {wilayaMode ? (
          wilaya ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DELIVERY_TYPES.map((dt) => {
                const checked = deliveryType === dt.value;
                const price = wilayaPriceFor(product, Number(wilayaCode), dt.value, prices[dt.value]);
                return (
                  <label
                    key={dt.value}
                    className={`grid cursor-pointer gap-1 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-[var(--c-primary-soft)] ${
                      checked
                        ? "border-[var(--c-border-strong)] bg-[var(--c-primary-soft)]"
                        : "border-[var(--c-border)] bg-[var(--c-surface-2)] hover:border-[var(--c-border-strong)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryType"
                      value={dt.value}
                      checked={checked}
                      onChange={() => setDeliveryType(dt.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2 text-sm font-bold text-[var(--c-text)]">
                      {dt.value === "home" ? t("home") : t("office")}
                      <span className="text-xs font-normal text-[var(--c-muted)]">
                        {dt.value === "home" ? t("homeHint") : t("officeHint")}
                      </span>
                    </span>
                    <span className="text-sm font-extrabold text-[var(--c-accent)]">{formatDZD(price)}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-primary-soft)] p-4">
              <p className="text-xs text-[var(--c-muted)]">
                {t("deliveryPick")}
              </p>
            </div>
          )
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {DELIVERY_TYPES.map((dt) => {
              const checked = deliveryType === dt.value;
              const price = prices[dt.value];
              return (
                <label
                  key={dt.value}
                  className={`grid cursor-pointer gap-1 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-[var(--c-primary-soft)] ${
                    checked
                      ? "border-[var(--c-border-strong)] bg-[var(--c-primary-soft)]"
                      : "border-[var(--c-border)] bg-[var(--c-surface-2)] hover:border-[var(--c-border-strong)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryType"
                    value={dt.value}
                    checked={checked}
                    onChange={() => setDeliveryType(dt.value)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2 text-sm font-bold text-[var(--c-text)]">
                    {dt.value === "home" ? t("home") : t("office")}
                    <span className="text-xs font-normal text-[var(--c-muted)]">
                      {dt.value === "home" ? t("homeHint") : t("officeHint")}
                    </span>
                  </span>
                  <span className="text-sm font-extrabold text-[var(--c-accent)]">{formatDZD(price)}</span>
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      {colors.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>اللون</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {colors.map((c) => {
              const checked = colorName === c.name;
              return (
                <label
                  key={c.name}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition focus-within:ring-2 focus-within:ring-[var(--c-primary-soft)] ${
                    checked
                      ? "border-[var(--c-border-strong)] bg-[var(--c-primary-soft)] text-[var(--c-text)]"
                      : "border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)] hover:border-[var(--c-border-strong)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c.name}
                    checked={checked}
                    onChange={() => setColorName(c.name)}
                    className="sr-only"
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <label className={labelClass}>
        {t("qty")}
        <div className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-input-bg)] px-1 py-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="grid h-9 w-9 place-items-center rounded-lg text-lg text-[var(--c-muted)] transition hover:bg-[var(--c-primary-soft)]"
            aria-label="إنقاص الكمية"
          >
            −
          </button>
          <input
            type="number"
            name="quantity"
            value={quantity}
            min={1}
            max={10}
            onChange={(e) => setQuantity(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            className="w-16 bg-transparent text-center text-base font-bold text-[var(--c-input-text)] outline-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            className="grid h-9 w-9 place-items-center rounded-lg text-lg text-[var(--c-muted)] transition hover:bg-[var(--c-primary-soft)]"
            aria-label="زيادة الكمية"
          >
            +
          </button>
        </div>
      </label>

      <div className="rounded-2xl bg-[var(--c-surface-2)] p-4 text-sm sm:col-span-2">
        <div className="flex items-center justify-between text-[var(--c-muted)]">
          <span>
            {t("priceLine", { name: product.name, qty: quantity, price: formatDZD(unitPrice) })}
          </span>
          <span className="font-bold text-[var(--c-text)]">{formatDZD(base)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[var(--c-muted)]">
          <span>
            {t("deliveryLine")}{" "}
            {wilayaMode
              ? wilaya
                ? `(${wilaya.name} · ${
                    deliveryType === "home" ? t("home") : t("office")
                  })`
                : `(${t("wilayaPh")})`
              : `(${wilaya ? `${wilaya.name} · ` : ""}${
                  deliveryType === "home" ? t("home") : t("office")
                })`}
          </span>
          <span className="font-bold text-[var(--c-text)]">{formatDZD(delivery)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--c-border)] pt-3">
          <span className="font-bold text-[var(--c-text)]">{t("total")}</span>
          <span className="font-display text-2xl font-extrabold l-text-gradient">{formatDZD(total)}</span>
        </div>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-gradient-to-l from-[var(--c-primary)] to-[var(--c-primary-strong)] px-5 py-4 text-sm font-bold text-[var(--c-primary-text)] shadow-lg shadow-[var(--c-glow)] transition sm:col-span-2"
      >
        {t("confirm")}
      </button>

      <div aria-live="polite" className="sm:col-span-2">
        {blocked && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {t("blocked")}
          </p>
        )}
        {submitted && (
          <p className={`rounded-xl border px-4 py-3 text-sm font-medium ${successClass}`}>
            {t("success")}
          </p>
        )}
      </div>

      <p className="text-[11px] leading-5 text-[var(--c-muted)] sm:col-span-2">
        {t("consent")}
      </p>
    </form>
  );
}
