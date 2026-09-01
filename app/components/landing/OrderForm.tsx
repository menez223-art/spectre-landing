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
import { computeDeviceFingerprint } from "@/app/lib/device";
import { buildMetaUserData, splitFullName } from "@/app/lib/utils/metaHash";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-[16px] outline-none transition sm:text-sm bg-[var(--c-input-bg)] border-[var(--c-input-border)] text-[var(--c-input-text)] placeholder:text-[var(--c-placeholder)] focus:border-[var(--c-primary)] focus:ring-2 focus:ring-[var(--c-primary-soft)]";

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
  // آخر طلب ناجح — يُستخدم لبناء رسالة واتساب الجاهزة في زر الإرسال بعد النجاح.
  const [lastOrder, setLastOrder] = useState<{ text: string } | null>(null);
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
    const form = event.currentTarget;
    const formData = new FormData(form);

    // UTM من URL (تتبع مصدر الزيارة: فيسبوك/إنستغرام/إعلان) — يُسجَّل في الصف.
    const utm = (key: string): string => {
      if (typeof window === "undefined") return "";
      try {
        return new URL(window.location.href).searchParams.get(key) ?? "";
      } catch {
        return "";
      }
    };
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
      utmSource: utm("utm_source"),
      utmMedium: utm("utm_medium"),
      utmCampaign: utm("utm_campaign"),
      // حقول خاصة بـ Meta CAPI — Apps Script سيخزّنها كأعمدة إضافية دون كسر المخطط.
      _landingUrl: typeof window !== "undefined" ? window.location.href : "",
      _productId: product.id,
    };

    // === Meta Advanced Matching prep ===
    // نقسّم الاسم + نحسب بصمة الجهاز + نولّد معرّف حدث ثابت للجلسة.
    // يُستخدم مرة على العميل (fbq) ومرة على الخادم (CAPI) للدمج (dedup).
    const { first, last } = splitFullName(payload.name);
    const fingerprint = await computeDeviceFingerprint().catch(() => "");
    const userData = await buildMetaUserData({
      phone: payload.phone,
      firstName: first,
      lastName: last,
      fingerprint,
    });
    const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // وجهة الطلب: نمرّ عبر نقطة الوكيل الثابتة على نفس نطاقنا (/api/sheet/order)،
    // وهي تبني الرابط الحيّ من FACTORY_URL + المفتاح الثابت (sheetKey) ثم تعيد
    // التوجيه إلى Apps Script من جهة الخادم. سبب حاسم: متصفّح العميل يُعاد توجيهه
    // بـ 302 من Apps Script (صفحة "يتطلب تصريحاً") فيفشل الطلب الصريح، بينما الخادم
    // يتابع إعادة التوجيه بنجاح. فالوكيل يحلّ المشكلة تماماً دون أي عمل يدوي.
    const sheetKey = product.sheetKey ?? "";
    const sheetEmail = product.sheetEmail ?? "";

    // وجهة الطلب: جدول Google أو واتساب صاحب المتجر — واحدة منهما تكفي.
    // واتساب قناة مستقلة: متجر بلا جدول لكن برقم واتساب يستقبل طلباته طبيعياً
    // (زر الإرسال بعد النجاح)، فلا نحجب النموذج إلا إذا لم توجد أيّ جهة.
    const hasSheetDestination = Boolean(sheetKey || sheetEmail);
    const hasWhatsapp = Boolean(product.whatsapp);
    if (!hasSheetDestination && !hasWhatsapp) {
      setBlocked(true);
      setSubmitted(false);
      return;
    }
    setBlocked(false);

    // === META PIXEL + TIKTOK PIXEL: Lead + Purchase tracking ===
    // يُطلقان بالتوازي بعد اجتياز فحص نظام الحظر وقبل تصفير النموذج.
    if (typeof window !== "undefined") {
      // Meta Pixel
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (typeof fbq === "function") {
        try {
          fbq("track", "Lead", {
            content_name: payload.product,
            content_category: payload.deliveryType,
            value: payload.totalPrice,
            currency: "DZD",
            wilaya: payload.wilaya,
            event_id: eventId,
            user_data: userData,
          });
          fbq("track", "Purchase", {
            content_name: payload.product,
            content_type: "product",
            content_ids: [product.id],
            num_items: payload.quantity,
            value: payload.totalPrice,
            currency: "DZD",
            event_id: eventId,
            user_data: userData,
          });
        } catch { /* فشل التتبّع لا يوقف إرسال الطلب */ }
      }
      // TikTok Pixel — CompletePayment = Purchase في تيكتوك.
      const ttq = (window as unknown as { ttq?: { track?: (...args: unknown[]) => void } }).ttq;
      if (ttq && typeof ttq.track === "function") {
        try {
          ttq.track("CompletePayment", {
            content_type: "product",
            content_id: product.id,
            content_name: payload.product,
            num_items: payload.quantity,
            value: payload.totalPrice,
            currency: "DZD",
          });
        } catch { /* فشل التتبّع لا يوقف إرسال الطلب */ }
      }
    }
    // === END META + TIKTOK ===

    // رسالة واتساب الجاهزة — تُبنى قبل تصفير النموذج كي نحتفظ بالقيم.
    // اسم المنتج المطلوب يظهر في سطر مستقل واضح كي يعرف البائع ما المطلوب.
    setLastOrder({
      text: [
        `🛒 طلب جديد`,
        `📦 المنتج المطلوب: ${payload.product}`,
        `🔢 الكمية: ${payload.quantity}`,
        `👤 الاسم: ${payload.name}`,
        `📞 الهاتف: ${payload.phone}`,
        `📍 ${payload.wilaya}${payload.commune ? " — " + payload.commune : ""}`,
        `🚚 التوصيل: ${payload.deliveryType} (${formatDZD(delivery)})`,
        `💰 المجموع: ${formatDZD(payload.totalPrice)}`,
      ].join("\n"),
    });

    setSubmitted(true);
    form.reset();
    setWilayaCode("");
    setCommune("");
    setQuantity(1);
    setDeliveryType("home");

    if (preview) return; // في المعاينة لا يُرسل للـ webhook

    // الإرسال للجدول يحدث فقط عند وجود وجهة جدول؛ متجر واتساب-فقط يعتمد
    // على رسالة الزبون الظاهرة أعلاه ولا يحتاج أي استدعاء شبكي.
    if (!hasSheetDestination) return;

    try {
      console.info("[OrderForm] إرسال الطلب عبر الوكيل مع:", { sheetKey, sheetEmail });
      const res = await fetch("/api/sheet/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetKey,
          sheetEmail,
          order: payload,
          // يُمرَّر للخادم كي يستخدم نفس event_id في طلب CAPI (dedup).
          meta: { eventId, userData },
        }),
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
          <>
            <p className={`rounded-xl border px-4 py-3 text-sm font-medium ${successClass}`}>
              {t("success")}
            </p>
            {/* إرسال الطلب عبر واتساب — يظهر فقط إذا ضبط صاحب المتجر رقمه.
                الرسالة جاهزة بالكامل؛ الزبون يضغط إرسال فقط في واتسابه. */}
            {product.whatsapp ? (
              <a
                href={`https://wa.me/${product.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                  (lastOrder?.text ?? "") + "\n" + t("orderWhatsappTail")
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:brightness-105 active:scale-[0.99]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t("orderSendWhatsapp")}
              </a>
            ) : null}
          </>
        )}
      </div>

      <p className="text-[11px] leading-5 text-[var(--c-muted)] sm:col-span-2">
        {t("consent")}
      </p>
    </form>
  );
}
