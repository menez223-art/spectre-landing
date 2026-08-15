// محرك بناء ملف HTML المستقل — يحوّل Product إلى مستند واحد يعمل خارج التطبيق
// الأنماط مدمجة (نفس buildCssVars المستخدم في المعاينة)، الصور مضمّنة كـ data URL،
// ونموذج الطلب يعمل بـ JS أصلي مع بيانات 58 ولاية مدمجة.

import type { Product, WilayaPrices } from "./types";
import { buildCssVars } from "./theme";
import {
  COMMUNES,
  DELIVERY_PRICES,
  DELIVERY_TYPES,
  WILAYAS,
  formatDZD,
  isWilayaMode,
  normalizeWilayaEntry,
} from "../data/delivery";

// تهريب النصوص قبل وضعها في HTML
function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// تهريب نص ليُكتب داخل سلسلة JS (يمنع كسر <script>)
function jsStr(value: unknown): string {
  return JSON.stringify(value == null ? "" : String(value)).replace(/</g, "\\u003c");
}

// حلّ مسار صورة إلى data URL — data: تُترك كما هي، والمسارات تُحوَّل عبر fetch
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return src;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src; // سقوط هادئ — نحتفظ بالمسار الأصلي
  }
}

const STAR_SVG =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5 12.6 7l6 .6-4.5 4.1 1.3 5.9L10 14.6l-5.4 3 1.3-5.9L1.4 7.6l6-.6L10 1.5Z"/></svg>';

const ORDER_BENEFITS = ["دفع آمن عند الاستلام", "توصيل سريع لباب منزلك", "منتج أصلي بضمان الجودة"];

export async function generateLandingHtml(product: Product, sheetWebhook?: string): Promise<string> {
  const theme = product.theme;
  const webhook = sheetWebhook ?? product.sheetWebhook ?? "";
  // أسعار التوصيل المدمجة — قيم المنتج المخصصة تُغلب القيم الافتراضية
  const deliveryPrices = product.delivery
    ? { home: product.delivery.home, office: product.delivery.office }
    : { home: DELIVERY_PRICES.home, office: DELIVERY_PRICES.office };
  // وضع التوصيل حسب الولاية — إن وُجد تُؤخذ الأسعار من خريطة wilayaPrices
  // (تُطبَّع إلى أزواج {home,office} لدعم القيم القديمة المفردة).
  const wilayaMode = isWilayaMode(product);
  const wilayaPrices: Record<number, { home: number; office: number }> = wilayaMode
    ? Object.fromEntries(
        Object.entries(product.wilayaPrices ?? {}).map(([code, entry]) => [
          Number(code),
          normalizeWilayaEntry(entry as WilayaPrices[number], DELIVERY_PRICES.office),
        ])
      )
    : {};
  const vars = buildCssVars(theme);
  const varsString = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");

  const featuresLayout = theme.featuresLayout === "list" ? "list" : "grid";
  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const discountPct =
    hasDiscount && product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const brand = (product.brand ?? product.name.trim().split(/\s+/)[0] ?? "").trim();

  // حلّ كل الصور إلى data URL قبل البناء
  const images = [product.image, ...(product.images ?? [])].filter(Boolean) as string[];
  const resolvedImages = await Promise.all(images.map(toDataUrl));
  const mainImage = resolvedImages[0] ?? "";
  const extrasImage = product.extras?.image ? await toDataUrl(product.extras.image) : undefined;

  // ---------------------------------------------------------------- TopBar
  const topBarHtml = `
    <div class="topbar">${esc(product.name)} · التوصيل لـ 58 ولاية · الدفع عند الاستلام</div>`;

  // ---------------------------------------------------------------- Header
  const navItems: { label: string; href: string }[] = [{ label: "المنتج", href: "#top" }];
  if (product.features?.length) {
    navItems.push({ label: featuresLayout === "list" ? "المواصفات" : "المميزات", href: "#features" });
  }
  if (product.testimonials?.length) {
    navItems.push({ label: "آراء الزبائن", href: "#testimonials" });
  }
  if (product.extras) {
    navItems.push({ label: product.extras.eyebrow, href: `#${product.extras.id}` });
  }
  navItems.push({ label: "الطلب", href: "#order" });

  const headerHtml = `
    <header class="container-landing site-header">
      <a href="#top" class="brand">${esc(brand)}<span>.</span></a>
      <nav class="nav" aria-label="التنقل الرئيسي">
        ${navItems.map((item) => `<a href="${esc(item.href)}">${esc(item.label)}</a>`).join("")}
      </nav>
      <a href="#order" class="header-cta">اطلب الآن</a>
    </header>`;

  // ---------------------------------------------------------------- Showcase
  const eyebrowHtml =
    product.eyebrow || product.badge
      ? `<p class="eyebrow"><span class="eyebrow-dot"></span>${esc(product.eyebrow ?? product.badge)}</p>`
      : "";
  const nameEnHtml = product.nameEn
    ? `<p class="name-en l-text-gradient">${esc(product.nameEn)}</p>`
    : "";
  const discountHtml =
    hasDiscount && product.oldPrice
      ? `<span class="price-old">${formatDZD(product.oldPrice)}</span>
         <span class="discount-badge">-${discountPct}%</span>`
      : "";
  const tagsHtml = product.tags?.length
    ? `<div class="tags-row">${product.tags.map((t) => `<span class="tag-pill">${esc(t)}</span>`).join("")}</div>`
    : "";
  const statsHtml = product.stats?.length
    ? `<div class="stats-row">${product.stats
        .map(
          (s, i) =>
            `${i > 0 ? `<span class="stats-divider"></span>` : ""}<span class="stat"><strong>${esc(
              s.value
            )}</strong> ${esc(s.label)}</span>`
        )
        .join("")}</div>`
    : "";

  const badgeChipHtml = product.badge ? `<span class="badge-chip">${esc(product.badge)}</span>` : "";
  const mainImgHtml = mainImage
    ? `<img id="jsMainImg" src="${esc(mainImage)}" alt="${esc(product.name)}" class="media-img">`
    : "";
  const galleryThumbsHtml = resolvedImages
    .map(
      (src, i) => `
      <button type="button" class="gallery-thumb${i === 0 ? " active" : ""}" data-src="${esc(src)}" aria-label="لقطة ${i + 1}">
        <img src="${esc(src)}" alt="لقطة ${i + 1}" class="media-img">
      </button>`
    )
    .join("");

  const showcaseHtml = `
    <section id="top" class="container-landing showcase">
      <div class="showcase-text">
        ${eyebrowHtml}
        ${nameEnHtml}
        <h1 class="showcase-title">${esc(product.tagline ?? product.name)}</h1>
        ${product.description ? `<p class="showcase-desc">${esc(product.description)}</p>` : ""}
        <div class="showcase-cta-row">
          <a href="#order" class="btn-primary">اطلب الآن <span>←</span></a>
          <div class="price-row">
            <span class="price-now">${formatDZD(product.price)}</span>
            ${discountHtml}
          </div>
        </div>
        ${tagsHtml}
        ${statsHtml}
      </div>
      <div class="showcase-media">
        <div class="glow-halo"></div>
        <div class="dashed-frame"></div>
        <div class="main-figure animate-float-slow">
          ${mainImgHtml}
          <div class="img-overlay"></div>
          ${badgeChipHtml}
          <div class="media-caption">
            <div>
              ${product.nameEn ? `<p class="sub">${esc(product.nameEn)}</p>` : ""}
              <p class="name">${esc(product.name)}</p>
            </div>
          </div>
        </div>
        ${resolvedImages.length > 1
          ? `<div class="gallery" style="grid-template-columns:repeat(${Math.min(resolvedImages.length, 4)}, minmax(0,1fr))">${galleryThumbsHtml}</div>`
          : ""}
      </div>
    </section>`;

  // ---------------------------------------------------------------- Features
  const featuresHtml = product.features?.length
    ? featuresLayout === "list"
      ? `
      <section id="features" class="section features-band">
        <div class="container-landing">
          <div class="features-list-grid">
            <div>
              <p class="features-intro-kicker">المواصفات</p>
              <h2 class="features-intro-title">تفاصيل ${esc(product.name)}.</h2>
              <p class="features-intro-desc">${esc(product.description ?? "كل المواصفات التقنية كما تظهر على العبوة.")}</p>
            </div>
            <div class="spec-list">
              ${product.features
                .map(
                  (f, i) => `
                <article class="spec-row${i === product.features!.length - 1 ? " last" : ""}">
                  <span class="spec-index">0${i + 1}</span>
                  <h3 class="spec-title">${esc(f.title)}</h3>
                  <p class="spec-copy">${esc(f.copy)}</p>
                </article>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </section>`
      : `
      <section id="features" class="section rel">
        <div class="top-divider"></div>
        <div class="container-landing">
          <div class="features-head">
            <p class="features-kicker">لماذا ${esc(product.name)}؟</p>
            <h2 class="features-title">مميزات <span class="accent">تصنع الفرق.</span></h2>
          </div>
          <div class="features-grid">
            ${product.features
              .map(
                (f, i) => `
              <article class="feature-card">
                <span class="feature-num">0${i + 1}</span>
                <h3 class="feature-title">${esc(f.title)}</h3>
                <p class="feature-copy">${esc(f.copy)}</p>
              </article>`
              )
              .join("")}
          </div>
        </div>
      </section>`
    : "";

  // ---------------------------------------------------------------- Extras
  const extrasHtml = product.extras
    ? `
    <section id="${esc(product.extras.id)}" class="section">
      <div class="container-landing">
        <div class="extras-grid">
          <div>
            <p class="extras-kicker">${esc(product.extras.eyebrow)}</p>
            <h2 class="extras-title">${esc(product.extras.heading)}</h2>
            <div class="extras-copy">
              ${product.extras.copy.map((p) => `<p>${esc(p)}</p>`).join("")}
            </div>
            ${product.extras.chips?.length
              ? `<div class="extras-chips">${product.extras.chips.map((c) => `<span class="tag-pill">${esc(c)}</span>`).join("")}</div>`
              : ""}
          </div>
          ${extrasImage
            ? `
          <div class="extras-media">
            <div class="extras-figure">
              <img src="${esc(extrasImage)}" alt="${esc(product.extras.heading)}" class="media-img">
            </div>
            ${product.extras.imageCaption ? `<p class="extras-caption">${esc(product.extras.imageCaption)}</p>` : ""}
          </div>`
            : ""}
        </div>
      </div>
    </section>`
    : "";

  // ---------------------------------------------------------------- Testimonials
  const testimonialsHtml = product.testimonials?.length
    ? `
    <section id="testimonials" class="section rel">
      <div class="top-divider"></div>
      <div class="container-landing">
        <div class="testim-head">
          <div>
            <p class="testim-kicker">آراء الزبائن</p>
            <h2 class="testim-title">ماذا يقول من جرّبه؟</h2>
          </div>
          <p class="testim-sub">تجارب حقيقية من زبائننا عبر الولايات.</p>
        </div>
        <div class="testim-grid">
          ${product.testimonials
            .map(
              (t) => `
            <figure class="testim-card">
              <div class="stars">${STAR_SVG.repeat(5)}</div>
              <blockquote class="testim-quote">«${esc(t.quote)}»</blockquote>
              <figcaption class="testim-author">
                <span class="testim-avatar">${esc(t.name.charAt(0))}</span>
                <span><span class="testim-author-name">${esc(t.name)}</span> · ${esc(t.city)}</span>
              </figcaption>
            </figure>`
            )
            .join("")}
        </div>
      </div>
    </section>`
    : "";

  // ---------------------------------------------------------------- Order form
  const deliveryOptionsHtml = DELIVERY_TYPES.map(
    (t, i) => `
      <label class="delivery-option${i === 0 ? " checked" : ""}">
        <input type="radio" name="deliveryType" value="${esc(t.value)}"${i === 0 ? " checked" : ""}>
        <span class="delivery-label">${esc(t.label)} <span class="delivery-hint">${esc(t.hint)}</span></span>
        <span class="delivery-price">${formatDZD(deliveryPrices[t.value])}</span>
      </label>`
  ).join("");

  // في وضع الولاية: خيارات توصيل (للمنزل/للمكتب) تظهر بعد اختيار الولاية،
  // وتُحدَّث أسعارها ديناميكياً من WILAYA_PRICES حسب إعداد الستوديو.
  const deliveryOptionsWilaya = DELIVERY_TYPES.map(
    (t, i) => `
      <label class="delivery-option${i === 0 ? " checked" : ""}" id="wilayaOpt-${esc(t.value)}" hidden>
        <input type="radio" name="deliveryType" value="${esc(t.value)}"${i === 0 ? " checked" : ""}>
        <span class="delivery-label">${esc(t.label)} <span class="delivery-hint">${esc(t.hint)}</span></span>
        <span class="delivery-price" id="wilayaPrice-${esc(t.value)}">—</span>
      </label>`
  ).join("");
  const wilayaDeliveryHtml = `
      <div class="delivery-wilaya" id="wilayaBlock" hidden>
        <div class="delivery-options" id="wilayaOptions">${deliveryOptionsWilaya}</div>
        <p class="delivery-wilaya-hint" id="oWilayaHint">اختر ولايتك من القائمة ليظهر خيارا التوصيل وأسعارهما.</p>
      </div>`;

  // خيارات ألوان المنتج — للعرض فقط (لا تُرسل للجدول)
  const validColors = (product.colors ?? []).filter(
    (c) => c && c.name && /^#[0-9a-fA-F]{6}$/.test(c.hex)
  );
  const colorOptionsHtml = validColors
    .map(
      (c, i) => `
        <label class="color-option${i === 0 ? " checked" : ""}">
          <input type="radio" name="color" value="${esc(c.name)}"${i === 0 ? " checked" : ""}>
          <span class="color-swatch" style="background:${esc(c.hex)}"></span>
          <span class="color-name">${esc(c.name)}</span>
        </label>`
    )
    .join("");
  const colorFieldsetHtml =
    validColors.length > 0
      ? `<fieldset class="span-2"><legend class="field">اللون</legend><div class="color-options">${colorOptionsHtml}</div></fieldset>`
      : "";

  const orderFormHtml = `
    <form id="orderForm" class="order-form" novalidate>
      <label class="field">الاسم الكامل
        <input required id="fName" class="input" type="text" name="name" placeholder="اكتب اسمك الكامل">
      </label>
      <label class="field">رقم الهاتف
        <input required id="fPhone" class="input" type="tel" name="phone" placeholder="05 xx xx xx xx">
      </label>
      <label class="field">الولاية
        <select required id="oWilaya" class="input" name="wilaya">
          <option value="" disabled selected>اختر ولايتك</option>
        </select>
      </label>
      <label class="field">البلدية
        <select required id="oCommune" class="input" name="commune" disabled>
          <option value="" disabled selected>اختر الولاية أولاً</option>
        </select>
      </label>
      ${
        wilayaMode
          ? `<fieldset class="span-2"><legend class="field">سعر التوصيل حسب ولايتك</legend>${wilayaDeliveryHtml}</fieldset>`
          : `<fieldset class="span-2">
        <legend class="field">طريقة الاستلام</legend>
        <div class="delivery-options">${deliveryOptionsHtml}</div>
      </fieldset>`
      }
      ${colorFieldsetHtml}
      <label class="field">الكمية
        <div class="qty-box">
          <button type="button" class="qty-btn" id="oMinus" aria-label="إنقاص الكمية">−</button>
          <input type="number" id="oQty" class="qty-input" value="1" min="1" max="10" name="quantity">
          <button type="button" class="qty-btn" id="oPlus" aria-label="زيادة الكمية">+</button>
        </div>
      </label>
      <div class="totals span-2">
        <div class="totals-row"><span id="oBaseLabel"></span><strong id="oBase"></strong></div>
        <div class="totals-row"><span id="oDeliveryLabel"></span><strong id="oDelivery"></strong></div>
        <div class="totals-divider"><span class="total-label">المجموع الكلي</span><span id="oTotal" class="total-value l-text-gradient"></span></div>
      </div>
      <button type="submit" class="btn-submit span-2">تأكيد الطلب ←</button>
      <div class="span-2"><p id="oSuccess" class="form-success" hidden></p></div>
      <p class="form-note span-2">بإرسال هذا النموذج، أنت توافق على التواصل معك بخصوص طلبك. بياناتك تبقى خاصة.</p>
    </form>`;

  const orderSectionHtml = `
    <section id="order" class="section order-section">
      <div class="container-landing">
        <div class="order-grid">
          <div>
            <p class="order-kicker">اطلبه الآن</p>
            <h2 class="order-title">احصل على ${esc(product.name)} بتوصيل سريع.</h2>
            <p class="order-desc">اترك بياناتك وسيتصل بك فريقنا لتأكيد الطلب وعنوان التوصيل. الدفع عند الاستلام.</p>
            <p class="order-summary">${esc(product.name)} · ${formatDZD(product.price)} · التوصيل لـ 58 ولاية</p>
            <div class="benefits">
              ${ORDER_BENEFITS.map((b) => `<span class="benefit"><span class="benefit-check">✓</span>${b}</span>`).join("")}
            </div>
          </div>
          ${orderFormHtml}
        </div>
      </div>
    </section>`;

  // ---------------------------------------------------------------- Footer
  const footerHtml = `
    <footer class="site-footer container-landing">
      <p>© 2026 ${esc(product.brand ?? product.name)}. صفحة مخصصة لـ ${esc(product.name)}.</p>
      <p>التوصيل لـ 58 ولاية · الدفع عند الاستلام</p>
    </footer>`;

  // ---------------------------------------------------------------- Sticky CTA
  const stickyHtml = `
    <div class="sticky-cta cta-rise">
      <div class="container-landing sticky-inner">
        <div class="sticky-text">
          <p class="sticky-name">${esc(product.name)}</p>
          <p class="sticky-price">${formatDZD(product.price)}<span class="sticky-delivery">التوصيل لـ 58 ولاية</span></p>
        </div>
        <a href="#order" class="sticky-btn">اطلب الآن ←</a>
      </div>
    </div>`;

  // ---------------------------------------------------------------- Scripts
  const wilayasJson = JSON.stringify(WILAYAS.map((w) => [w.code, w.name])).replace(/</g, "\\u003c");
  const communesJson = JSON.stringify(COMMUNES).replace(/</g, "\\u003c");
  const deliveryTypesJson = JSON.stringify(DELIVERY_TYPES).replace(/</g, "\\u003c");
  const deliveryPricesJson = JSON.stringify(deliveryPrices).replace(/</g, "\\u003c");
  const wilayaPricesJson = JSON.stringify(wilayaPrices).replace(/</g, "\\u003c");

  const scriptsHtml = `
<script>
(function () {
  "use strict";
  var WILAYAS = ${wilayasJson};
  var COMMUNES = ${communesJson};
  var DELIVERY_TYPES = ${deliveryTypesJson};
  var DELIVERY_PRICES = ${deliveryPricesJson};
  var WILAYA_PRICES = ${wilayaPricesJson};
  var WILAYA_MODE = ${wilayaMode ? "true" : "false"};
  var WEBHOOK = ${jsStr(webhook)};
  var SHEET_KEY = ${jsStr(product.sheetKey ?? "")};
  var SHEET_EMAIL = ${jsStr(product.sheetEmail ?? "")};
  var PRICE = ${product.price};
  var PRODUCT = ${jsStr(product.name)};
  var MODE = ${jsStr(theme.mode)};

  function fmt(v) {
    try { return v.toLocaleString("fr-DZ") + " دج"; }
    catch (e) { return v.toLocaleString() + " دج"; }
  }

  var form = document.getElementById("orderForm");
  var wilayaSel = document.getElementById("oWilaya");
  var communeSel = document.getElementById("oCommune");
  var qtyInput = document.getElementById("oQty");
  var baseLabelEl = document.getElementById("oBaseLabel");
  var baseEl = document.getElementById("oBase");
  var deliveryLabelEl = document.getElementById("oDeliveryLabel");
  var deliveryEl = document.getElementById("oDelivery");
  var totalEl = document.getElementById("oTotal");
  var successEl = document.getElementById("oSuccess");
  var deliveryInputs = form.querySelectorAll("input[name=deliveryType]");
  var priceEls = form.querySelectorAll(".delivery-price");
  var wilayaHintEl = document.getElementById("oWilayaHint");

  function wilayaName() {
    var code = Number(wilayaSel.value);
    for (var i = 0; i < WILAYAS.length; i++) {
      if (WILAYAS[i][0] === code) return WILAYAS[i][1];
    }
    return null;
  }
  function deliveryType() {
    for (var i = 0; i < deliveryInputs.length; i++) {
      if (deliveryInputs[i].checked) return deliveryInputs[i].value;
    }
    return "home";
  }
  function deliveryLabel() {
    var t = deliveryType();
    for (var i = 0; i < DELIVERY_TYPES.length; i++) {
      if (DELIVERY_TYPES[i].value === t) return DELIVERY_TYPES[i].label;
    }
    return "";
  }
  // السعر الفعلي للتوصيل — في وضع الولاية يُؤخذ سعر الولاية المختارة لنوع التوصيل،
  // وإلا سعر النوع من القيم الافتراضية/المخصّصة للمنتج.
  function deliveryPrice() {
    if (WILAYA_MODE) {
      var code = Number(wilayaSel.value);
      var type = deliveryType();
      var entry = WILAYA_PRICES[code];
      if (entry && typeof entry === "object") {
        return type === "office" ? (entry.office || DELIVERY_PRICES.office) : (entry.home || DELIVERY_PRICES.home);
      }
      if (typeof entry === "number") {
        // قيمة legacy: الرقم هو سعر المنزل؛ المكتب يسقط للافتراضي
        return type === "office" ? DELIVERY_PRICES.office : entry;
      }
      return DELIVERY_PRICES[type]; // سقوط للافتراضي
    }
    return DELIVERY_PRICES[deliveryType()];
  }
  function qty() {
    return Math.min(10, Math.max(1, parseInt(qtyInput.value, 10) || 1));
  }

  // تعبئة قائمة الولايات وأسعار التوصيل
  WILAYAS.forEach(function (w) {
    var o = document.createElement("option");
    o.value = String(w[0]);
    o.textContent = w[0] + " · " + w[1];
    wilayaSel.appendChild(o);
  });
  DELIVERY_TYPES.forEach(function (t, i) {
    if (priceEls[i]) priceEls[i].textContent = fmt(DELIVERY_PRICES[t.value]);
  });

  function updateTotals() {
    var q = qty();
    var d = deliveryPrice();
    var w = wilayaSel.value ? wilayaName() : "";
    var code = Number(wilayaSel.value);
    var entry = WILAYA_PRICES[code];
    baseLabelEl.textContent = "سعر " + PRODUCT + " (" + q + " × " + fmt(PRICE) + ")";
    baseEl.textContent = fmt(PRICE * q);
    if (WILAYA_MODE) {
      // إظهار/إخفاء خيارات التوصيل حسب وجود ولاية مختارة
      var block = document.getElementById("wilayaBlock");
      if (block) block.hidden = !w;
      DELIVERY_TYPES.forEach(function (t) {
        var opt = document.getElementById("wilayaOpt-" + t.value);
        if (opt) {
          opt.hidden = !w;
          var priceEl = document.getElementById("wilayaPrice-" + t.value);
          if (priceEl) {
            var p = entry && typeof entry === "object"
              ? (t.value === "office" ? (entry.office || DELIVERY_PRICES.office) : (entry.home || DELIVERY_PRICES.home))
              : (typeof entry === "number" && t.value === "home" ? entry : DELIVERY_PRICES[t.value]);
            priceEl.textContent = w ? fmt(p) : "—";
          }
        }
      });
      if (wilayaHintEl) wilayaHintEl.textContent = w
        ? "اختر طريقة التوصيل (للمنزل أو للمكتب) حسب سعر ولايتك."
        : "اختر ولايتك من القائمة ليظهر خيارا التوصيل وأسعارهما.";
      deliveryLabelEl.textContent = "التوصيل (" + (w || "اختر ولايتك") + (w ? " · " + deliveryLabel() : "") + ")";
    } else {
      deliveryLabelEl.textContent = "التوصيل " + (w ? w + " · " : "") + deliveryLabel();
    }
    deliveryEl.textContent = fmt(d);
    totalEl.textContent = fmt(PRICE * q + d);
  }

  wilayaSel.addEventListener("change", function () {
    communeSel.innerHTML = "";
    var code = Number(wilayaSel.value);
    var first = document.createElement("option");
    first.value = "";
    first.disabled = true;
    first.selected = true;
    first.textContent = COMMUNES[code] ? "اختر البلدية" : "اختر الولاية أولاً";
    communeSel.appendChild(first);
    (COMMUNES[code] || []).forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      communeSel.appendChild(o);
    });
    communeSel.disabled = !wilayaSel.value;
    updateTotals();
  });

  qtyInput.addEventListener("input", function () { qtyInput.value = qty(); updateTotals(); });
  document.getElementById("oMinus").addEventListener("click", function () {
    qtyInput.value = Math.max(1, qty() - 1); updateTotals();
  });
  document.getElementById("oPlus").addEventListener("click", function () {
    qtyInput.value = Math.min(10, qty() + 1); updateTotals();
  });
  for (var i = 0; i < deliveryInputs.length; i++) {
    deliveryInputs[i].addEventListener("change", function () {
      var options = document.querySelectorAll(".delivery-option");
      for (var j = 0; j < options.length; j++) options[j].classList.remove("checked");
      var parent = this.closest(".delivery-option");
      if (parent) parent.classList.add("checked");
      updateTotals();
    });
  }

  // اللون — للعرض فقط (لا يُرسل للجدول)
  var colorInputs = form.querySelectorAll("input[name=color]");
  function syncColor() {
    var options = document.querySelectorAll(".color-option");
    for (var j = 0; j < options.length; j++) options[j].classList.remove("checked");
    for (var k = 0; k < colorInputs.length; k++) {
      if (colorInputs[k].checked) {
        var parent = colorInputs[k].closest(".color-option");
        if (parent) parent.classList.add("checked");
        break;
      }
    }
  }
  for (var ci = 0; ci < colorInputs.length; ci++) {
    colorInputs[ci].addEventListener("change", syncColor);
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var w = wilayaName();
    if (!w) return;
    var hasIdentity = !!(SHEET_KEY || SHEET_EMAIL);
    if (!WEBHOOK && !hasIdentity) {
      successEl.hidden = false;
      successEl.className = "form-blocked " + (MODE === "dark" ? "dark" : "light");
      successEl.textContent = "⚠ الطلبات موقوفة حالياً — اربط جدول Google Sheets لتسجيل الطلبات.";
      return;
    }
    var q = qty();
    var payload = {
      timestamp: new Date().toISOString(),
      name: document.getElementById("fName").value.trim(),
      phone: document.getElementById("fPhone").value.trim(),
      wilaya: w,
      commune: communeSel.value.trim(),
      quantity: q,
      deliveryType: deliveryLabel(),
      totalPrice: PRICE * q + deliveryPrice(),
      product: PRODUCT
    };
    try {
      // نمرّ عبر نقطة الوكيل الثابتة على نفس النطاق (/api/sheet/order) التي تبني
      // الرابط الحيّ من FACTORY_URL + المفتاح الثابت ثم تعيد التوجيه إلى Apps Script
      // من جهة الخادم. سبب حاسم: متصفّح العميل يُعاد توجيهه بـ 302 من Apps Script
      // (صفحة "يتطلب تصريحاً") فيفشل الطلب الصريح، بينما الخادم يتابع التوجيه بنجاح.
      if (!SHEET_KEY && !SHEET_EMAIL) {
        console.warn("[order] لا وجهة للطلب — لم يُرسَل (افتح الملف عبر الموقع أو اربط جدولاً).");
        return;
      }
      console.info("[order] إرسال الطلب عبر الوكيل");
      try {
        var res = await fetch("/api/sheet/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheetKey: SHEET_KEY, sheetEmail: SHEET_EMAIL, order: payload })
        });
        var txt = await res.text().catch(function () { return ""; });
        console.info("[order] رد الوكيل:", res.status, txt.slice(0, 120));
      } catch (e) {
        console.warn("[order] فشل الوكيل، محاولة مباشرة نحو Apps Script:", e);
        // احتياط: إن تعذّر الوكيل (مثل فتح الملف خارج الموقع) نرسل مباشرةً للرابط المخبّأ
        var direct = WEBHOOK;
        if (!direct && SHEET_KEY) {
          try {
            var fr = await fetch("/api/sheet/factory-base", { cache: "no-store" });
            var fd = await fr.json().catch(function () { return null; });
            if (fd && fd.base) direct = fd.base + "?key=" + encodeURIComponent(SHEET_KEY);
          } catch (e2) { /* تجاهل */ }
        }
        if (direct) {
          fetch(direct, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify(payload)
          });
        }
      }
    } catch (e) {
      console.error("تعذر إرسال الطلب إلى Google Sheets:", e);
    }
    form.reset();
    wilayaSel.value = "";
    communeSel.innerHTML = "";
    var first = document.createElement("option");
    first.value = "";
    first.disabled = true;
    first.selected = true;
    first.textContent = "اختر الولاية أولاً";
    communeSel.appendChild(first);
    communeSel.disabled = true;
    qtyInput.value = 1;
    successEl.hidden = false;
    successEl.className = "form-success " + (MODE === "dark" ? "dark" : "light");
    successEl.textContent = "تم تسجيل طلبك بنجاح ✅ سنتصل بك لتأكيد الطلب.";
    updateTotals();
  });

  updateTotals();
})();
</script>
<script>
(function () {
  var main = document.getElementById("jsMainImg");
  if (!main) return;
  var thumbs = document.querySelectorAll(".gallery-thumb");
  for (var i = 0; i < thumbs.length; i++) {
    (function (th) {
      th.addEventListener("click", function () {
        main.src = th.getAttribute("data-src");
        for (var j = 0; j < thumbs.length; j++) thumbs[j].classList.remove("active");
        th.classList.add("active");
      });
    })(thumbs[i]);
  }
})();
</script>`;

  // ---------------------------------------------------------------- Meta
  const ogImage = /^https?:\/\//.test(mainImage)
    ? `<meta property="og:image" content="${esc(mainImage)}">`
    : "";
  const metaDescription = product.description ?? product.tagline ?? product.name;

  return `<!-- Generated by studio.landing -->
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(product.name)} — اطلب الآن</title>
<meta name="description" content="${esc(metaDescription)}">
<meta name="theme-color" content="${esc(theme.primary)}">
<meta property="og:title" content="${esc(product.name)}">
<meta property="og:description" content="${esc(metaDescription)}">
<meta property="og:type" content="product">
<meta property="og:locale" content="ar_DZ">
${ogImage}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
  color-scheme: ${theme.mode};
${varsString}
  --font-display: "Cairo", "Segoe UI", Tahoma, system-ui, sans-serif;
  --font-body: "Tajawal", "Segoe UI", Tahoma, system-ui, sans-serif;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font-body);
  background: var(--c-bg);
  color: var(--c-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  line-height: 1.5;
}
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
input, select, textarea { font-family: inherit; }
[hidden] { display: none !important; }

.font-display { font-family: var(--font-display); }
.container-landing { max-width: 1152px; margin-inline: auto; padding-inline: 1rem; }
@media (min-width: 640px) { .container-landing { padding-inline: 1.5rem; } }
@media (min-width: 1024px) { .container-landing { padding-inline: 2rem; } }

.l-text-gradient {
  background-image: linear-gradient(to left, var(--c-accent), var(--c-text));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

@keyframes cta-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
.cta-rise { animation: cta-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
.animate-float-slow { animation: float-slow 7s ease-in-out infinite; }
@keyframes glow-pulse { 0%, 100% { opacity: 0.45; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
.glow-halo {
  position: absolute; inset: -2.5rem; border-radius: 9999px;
  background: radial-gradient(circle, var(--c-glow) 0%, transparent 70%);
  filter: blur(22px);
  animation: glow-pulse 8s ease-in-out infinite;
}
.img-overlay { position: absolute; inset: 0; background-image: var(--c-img-overlay); }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}

/* ---- TopBar ---- */
.topbar { padding: 0.625rem 0; text-align: center; font-size: 0.75rem; font-weight: 600; background: var(--c-promo-bg); color: var(--c-promo-text); }

/* ---- Header ---- */
.site-header { display: flex; align-items: center; justify-content: space-between; padding-top: 1.75rem; padding-bottom: 1.75rem; }
.brand { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; color: var(--c-text); }
.brand span { color: var(--c-accent); }
.nav { display: none; align-items: center; gap: 2rem; font-size: 0.875rem; color: var(--c-muted); }
@media (min-width: 768px) { .nav { display: flex; } }
.nav a { transition: color 0.2s; }
.nav a:hover { color: var(--c-accent); }
.header-cta {
  border-radius: 9999px; border: 1px solid var(--c-border-strong); background: var(--c-surface);
  padding: 0.625rem 1.25rem; font-size: 0.75rem; font-weight: 700; color: var(--c-text);
  transition: background 0.2s, color 0.2s;
}
.header-cta:hover { background: var(--c-primary); color: var(--c-primary-text); }

/* ---- Showcase ---- */
.section { padding-top: 5rem; padding-bottom: 5rem; }
@media (min-width: 640px) { .section { padding-top: 7rem; padding-bottom: 7rem; } }
.rel { position: relative; }
.top-divider { position: absolute; top: 0; inset-inline: 0; height: 1px; background: linear-gradient(to right, transparent, var(--c-border-strong), transparent); }

.showcase {
  position: relative; display: grid; gap: 3.5rem; align-items: center;
  padding-top: 1.5rem; padding-bottom: 5rem;
}
@media (min-width: 1024px) { .showcase { grid-template-columns: 1fr 0.95fr; gap: 5rem; padding-top: 3rem; padding-bottom: 7rem; } }
.showcase-text { position: relative; z-index: 10; }
.eyebrow {
  display: inline-flex; align-items: center; gap: 0.75rem; border-radius: 9999px;
  border: 1px solid var(--c-border-strong); background: var(--c-primary-soft);
  padding: 0.375rem 1rem; font-size: 0.75rem; font-weight: 700; color: var(--c-accent);
}
.eyebrow-dot { width: 0.375rem; height: 0.375rem; border-radius: 9999px; background: var(--c-accent); }
.name-en { margin: 0.5rem 0; font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; }
.showcase-title { margin: 0; max-width: 36rem; font-family: var(--font-display); font-size: 2.25rem; font-weight: 800; line-height: 1.12; color: var(--c-text); }
@media (min-width: 640px) { .showcase-title { font-size: 3rem; } }
@media (min-width: 1024px) { .showcase-title { font-size: 3.4rem; } }
.showcase-desc { margin: 1.5rem 0 0; max-width: 28rem; font-size: 1rem; line-height: 1.75; color: var(--c-muted); }
.showcase-cta-row { margin-top: 2.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 0.75rem; border-radius: 9999px;
  background-image: linear-gradient(to left, var(--c-primary), var(--c-primary-strong));
  padding: 1rem 1.75rem; font-size: 0.875rem; font-weight: 700; color: var(--c-primary-text);
  box-shadow: 0 10px 15px -3px var(--c-glow), 0 4px 6px -4px var(--c-glow);
  transition: transform 0.2s;
}
.btn-primary:hover { transform: translateY(-0.125rem); }
.price-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.price-now { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; color: var(--c-text); }
.price-old { font-size: 0.875rem; font-weight: 700; color: var(--c-muted); text-decoration: line-through; }
.discount-badge { border-radius: 9999px; background: var(--c-primary-soft); padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 700; color: var(--c-accent); }
.tags-row { margin-top: 1.75rem; display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--c-muted); }
.tag-pill { border-radius: 9999px; border: 1px solid var(--c-border); background: var(--c-surface-2); padding: 0.5rem 1rem; }
.stats-row {
  margin-top: 3rem; display: flex; flex-wrap: wrap; align-items: center; gap: 1.75rem;
  border-top: 1px solid var(--c-border); padding-top: 1.5rem; font-size: 0.75rem; color: var(--c-muted);
}
.stats-divider { display: none; width: 1px; height: 2rem; background: var(--c-border); }
@media (min-width: 640px) { .stats-divider { display: block; } }
.stat strong { display: block; font-size: 1.125rem; color: var(--c-text); }

.showcase-media { position: relative; width: 100%; max-width: 28rem; margin-inline: auto; }
@media (min-width: 1024px) { .showcase-media { max-width: none; } }
.dashed-frame { position: absolute; inset: -1rem; border-radius: 3.5rem; border: 1px dashed var(--c-border-strong); }
.main-figure { position: relative; aspect-ratio: 0.88; overflow: hidden; border-radius: 1.5rem; box-shadow: 0 0 0 1px var(--c-border); }
.media-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.badge-chip {
  position: absolute; top: 1rem; inset-inline-end: 1rem; border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0.75rem; font-size: 0.625rem; font-weight: 700; color: #fff; backdrop-filter: blur(4px);
}
.media-caption { position: absolute; bottom: 1.5rem; inset-inline-start: 1.5rem; inset-inline-end: 1.5rem; color: #fff; }
.media-caption .sub { margin: 0; font-size: 0.625rem; color: rgba(255, 255, 255, 0.75); }
.media-caption .name { margin: 0.25rem 0 0; font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; }
.gallery { margin-top: 1rem; display: grid; gap: 0.75rem; }
.gallery-thumb { position: relative; aspect-ratio: 1; overflow: hidden; border-radius: 1rem; box-shadow: 0 0 0 1px var(--c-border); transition: box-shadow 0.2s; }
.gallery-thumb.active { box-shadow: 0 0 0 2px var(--c-primary); }

/* ---- Features (grid) ---- */
.features-head { margin-inline: auto; max-width: 42rem; text-align: center; }
.features-kicker { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.025em; color: var(--c-accent); }
.features-title { margin: 1rem 0 0; font-family: var(--font-display); font-size: 1.875rem; font-weight: 800; line-height: 1.3; color: var(--c-text); }
@media (min-width: 640px) { .features-title { font-size: 2.25rem; } }
.features-title .accent { color: var(--c-accent); }
.features-grid { margin-top: 3.5rem; display: grid; gap: 1.25rem; grid-template-columns: 1fr; }
@media (min-width: 640px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .features-grid { grid-template-columns: repeat(4, 1fr); } }
.feature-card {
  position: relative; border-radius: 1.5rem; border: 1px solid var(--c-border);
  background: var(--c-surface); padding: 1.5rem; transition: border-color 0.2s, box-shadow 0.2s;
}
.feature-card:hover { border-color: var(--c-border-strong); box-shadow: 0 10px 15px -3px var(--c-glow); }
.feature-num { font-family: var(--font-display); font-size: 0.75rem; font-weight: 700; color: var(--c-muted); }
.feature-card:hover .feature-num { color: var(--c-accent); }
.feature-title { margin: 1.25rem 0 0; font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; line-height: 1.4; color: var(--c-text); }
.feature-copy { margin: 0.75rem 0 0; font-size: 0.875rem; line-height: 1.5; color: var(--c-muted); }

/* ---- Features (list) ---- */
.features-band { background: var(--c-band-bg); color: var(--c-band-text); }
.features-list-grid { display: grid; gap: 2.5rem; }
@media (min-width: 1024px) { .features-list-grid { grid-template-columns: 0.7fr 1.3fr; } }
.features-intro-kicker { margin: 0; font-size: 0.75rem; font-weight: 700; color: var(--c-accent); }
.features-intro-title { margin: 1.25rem 0 0; max-width: 24rem; font-family: var(--font-display); font-size: 1.875rem; font-weight: 700; line-height: 1.4; color: var(--c-band-text); }
@media (min-width: 640px) { .features-intro-title { font-size: 2.25rem; } }
.features-intro-desc { margin: 1.5rem 0 0; max-width: 24rem; font-size: 0.875rem; line-height: 1.5; color: var(--c-band-muted); }
.spec-list { display: grid; border-top: 1px solid var(--c-band-border); }
.spec-row { display: grid; gap: 0.5rem; border-bottom: 1px solid var(--c-band-border); padding: 1.5rem 0; }
@media (min-width: 640px) { .spec-row { grid-template-columns: 70px 0.8fr 1.2fr; align-items: center; } }
.spec-row.last { border-bottom: 0; }
.spec-index { font-size: 0.75rem; color: var(--c-band-muted); }
.spec-title { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; color: var(--c-band-text); }
.spec-copy { font-size: 0.875rem; line-height: 1.5; color: var(--c-band-muted); }

/* ---- Extras ---- */
.extras-grid { display: grid; align-items: center; gap: 2.5rem; }
@media (min-width: 1024px) { .extras-grid { grid-template-columns: 1.08fr 0.92fr; } }
.extras-kicker { margin: 0; font-size: 0.75rem; font-weight: 700; color: var(--c-accent); }
.extras-title { margin: 1rem 0 0; font-family: var(--font-display); font-size: 1.875rem; font-weight: 800; color: var(--c-text); }
@media (min-width: 640px) { .extras-title { font-size: 2.25rem; } }
.extras-copy { margin-top: 1.5rem; display: grid; gap: 1.25rem; font-size: 0.875rem; line-height: 1.75; color: var(--c-muted); }
.extras-chips { margin-top: 2rem; display: flex; flex-wrap: wrap; gap: 0.75rem; }
.extras-media { position: relative; width: 100%; max-width: 32rem; margin-inline: auto; }
@media (min-width: 1024px) { .extras-media { max-width: none; } }
.extras-figure {
  position: relative; aspect-ratio: 0.86; overflow: hidden;
  border-radius: 1.5rem 1.5rem 10rem 10rem; background: var(--c-surface-2);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--c-border);
}
.extras-caption { margin-top: 1rem; text-align: center; font-size: 0.625rem; color: var(--c-muted); }

/* ---- Testimonials ---- */
.testim-head { display: flex; flex-direction: column; justify-content: space-between; gap: 1.5rem; }
@media (min-width: 640px) { .testim-head { flex-direction: row; align-items: flex-end; } }
.testim-kicker { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.025em; color: var(--c-accent); }
.testim-title { margin: 1rem 0 0; font-family: var(--font-display); font-size: 1.875rem; font-weight: 800; color: var(--c-text); }
@media (min-width: 640px) { .testim-title { font-size: 2.25rem; } }
.testim-sub { margin: 0; max-width: 20rem; font-size: 0.875rem; line-height: 1.5; color: var(--c-muted); }
.testim-grid { margin-top: 3rem; display: grid; gap: 1.25rem; }
@media (min-width: 768px) { .testim-grid { grid-template-columns: repeat(3, 1fr); } }
.testim-card { position: relative; border-radius: 1.5rem; border: 1px solid var(--c-border); background: var(--c-surface); padding: 1.75rem; }
.stars { display: flex; gap: 0.25rem; }
.stars svg { width: 1rem; height: 1rem; fill: #fcd34d; }
.testim-quote { margin: 1.25rem 0 0; font-size: 1rem; font-weight: 500; line-height: 1.625; color: var(--c-text); }
.testim-author { margin-top: 1.5rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.75rem; color: var(--c-muted); }
.testim-avatar {
  display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 9999px;
  background: var(--c-primary); color: var(--c-primary-text); font-family: var(--font-display);
  font-weight: 700; box-shadow: 0 0 0 1px var(--c-border);
}
.testim-author-name { font-weight: 700; color: var(--c-text); }

/* ---- Order section ---- */
.order-section { background: var(--c-bg-alt); }
.order-grid { display: grid; gap: 3rem; }
@media (min-width: 1024px) { .order-grid { grid-template-columns: 0.85fr 1.15fr; align-items: start; } }
.order-kicker { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.025em; color: var(--c-accent); }
.order-title { margin: 1.25rem 0 0; max-width: 28rem; font-family: var(--font-display); font-size: 1.875rem; font-weight: 800; line-height: 1.4; color: var(--c-text); }
@media (min-width: 640px) { .order-title { font-size: 2.25rem; } }
.order-desc { margin: 1.5rem 0 0; max-width: 24rem; font-size: 0.875rem; line-height: 1.5; color: var(--c-muted); }
.order-summary { margin-top: 2rem; font-size: 0.875rem; font-weight: 700; color: var(--c-text); }
.benefits { margin-top: 2.5rem; display: grid; gap: 1rem; font-size: 0.75rem; color: var(--c-muted); }
.benefit { display: flex; align-items: center; gap: 0.5rem; }
.benefit-check { display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 9999px; background: var(--c-primary); color: var(--c-primary-text); }

/* ---- Order form ---- */
.order-form { display: grid; gap: 1rem; border-radius: 1.5rem; border: 1px solid var(--c-border); background: var(--c-surface); padding: 1.5rem; }
@media (min-width: 640px) { .order-form { grid-template-columns: 1fr 1fr; padding: 2rem; } }
.field { display: grid; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--c-label); }
.input {
  width: 100%; border-radius: 0.75rem; border: 1px solid var(--c-input-border);
  background: var(--c-input-bg); color: var(--c-input-text);
  padding: 0.75rem 1rem; font-size: 0.875rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.input::placeholder { color: var(--c-placeholder); }
.input:focus { border-color: var(--c-primary); box-shadow: 0 0 0 2px var(--c-primary-soft); }
.input:disabled { opacity: 0.5; cursor: not-allowed; }
.span-2 { grid-column: 1 / -1; }
.delivery-options { margin-top: 0.75rem; display: grid; gap: 0.75rem; }
@media (min-width: 640px) { .delivery-options { grid-template-columns: 1fr 1fr; } }
.delivery-option {
  position: relative; display: grid; gap: 0.25rem; cursor: pointer; border-radius: 1rem;
  border: 1px solid var(--c-border); background: var(--c-surface-2); padding: 1rem;
  transition: border-color 0.2s, background 0.2s;
}
.delivery-option:hover { border-color: var(--c-border-strong); }
.delivery-option.checked { border-color: var(--c-border-strong); background: var(--c-primary-soft); }
.delivery-option input { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.delivery-label { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.875rem; font-weight: 700; color: var(--c-text); }
.delivery-hint { font-size: 0.75rem; font-weight: 400; color: var(--c-muted); }
.delivery-price { font-size: 0.875rem; font-weight: 800; color: var(--c-accent); }
.delivery-wilaya { margin-top: 0.75rem; border-radius: 1rem; border: 1px solid var(--c-border-strong); background: var(--c-primary-soft); padding: 1rem; }
.delivery-wilaya-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-size: 0.875rem; font-weight: 700; color: var(--c-text); }
.delivery-wilaya-hint { margin-top: 0.25rem; font-size: 0.75rem; color: var(--c-muted); }
.color-options { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
.color-option { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; border-radius: 9999px; border: 1px solid var(--c-border); background: var(--c-surface-2); padding: 0.5rem 0.875rem; font-size: 0.875rem; font-weight: 700; color: var(--c-muted); transition: border-color 0.2s, background 0.2s; }
.color-option:hover { border-color: var(--c-border-strong); }
.color-option.checked { border-color: var(--c-border-strong); background: var(--c-primary-soft); color: var(--c-text); }
.color-swatch { width: 1rem; height: 1rem; border-radius: 9999px; border: 1px solid rgba(0,0,0,0.1); }
.qty-box { display: flex; align-items: center; justify-content: space-between; border-radius: 0.75rem; border: 1px solid var(--c-border); background: var(--c-input-bg); padding: 0.25rem; }
.qty-btn { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 0.5rem; font-size: 1.125rem; color: var(--c-muted); transition: background 0.2s; }
.qty-btn:hover { background: var(--c-primary-soft); }
.qty-input { width: 4rem; background: transparent; text-align: center; font-size: 1rem; font-weight: 700; color: var(--c-input-text); outline: none; -moz-appearance: textfield; appearance: textfield; }
.qty-input::-webkit-outer-spin-button, .qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.totals { border-radius: 1rem; background: var(--c-surface-2); padding: 1rem; font-size: 0.875rem; }
.totals-row { display: flex; align-items: center; justify-content: space-between; color: var(--c-muted); }
.totals-row strong { color: var(--c-text); }
.totals-divider { margin-top: 0.75rem; border-top: 1px solid var(--c-border); padding-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; }
.total-label { font-weight: 700; color: var(--c-text); }
.total-value { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; }
.btn-submit {
  border-radius: 0.75rem; background-image: linear-gradient(to left, var(--c-primary), var(--c-primary-strong));
  padding: 1rem 1.25rem; font-size: 0.875rem; font-weight: 700; color: var(--c-primary-text);
  box-shadow: 0 10px 15px -3px var(--c-glow); transition: transform 0.2s, filter 0.2s;
}
.btn-submit:hover { filter: brightness(1.06); transform: translateY(-1px); }
.form-success { border-radius: 0.75rem; border: 1px solid; padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 500; }
.form-success.dark { border-color: rgba(52, 211, 153, 0.3); background: rgba(16, 185, 129, 0.15); color: #a7f3d0; }
.form-success.light { border-color: rgba(5, 150, 105, 0.3); background: #ecfdf5; color: #047857; }
.form-blocked { border-radius: 0.75rem; border: 1px solid; padding: 0.75rem 1rem; font-size: 0.875rem; font-weight: 500; }
.form-blocked.dark { border-color: rgba(251, 191, 36, 0.35); background: rgba(217, 119, 6, 0.15); color: #fcd34d; }
.form-blocked.light { border-color: rgba(245, 158, 11, 0.4); background: #fffbeb; color: #b45309; }
.form-note { font-size: 0.6875rem; line-height: 1.25rem; color: var(--c-muted); }

/* ---- Footer ---- */
.site-footer { display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--c-border); padding-top: 2rem; padding-bottom: 2rem; font-size: 0.75rem; color: var(--c-muted); }
@media (min-width: 640px) { .site-footer { flex-direction: row; } }

/* ---- Sticky CTA ---- */
.sticky-cta {
  position: fixed; inset-inline: 0; bottom: 0; z-index: 50; border-top: 1px solid var(--c-border);
  background: var(--c-sticky-bg); backdrop-filter: blur(12px); padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 1024px) { .sticky-cta { display: none; } }
.sticky-inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 0.75rem; padding-bottom: 0.75rem; }
.sticky-text { min-width: 0; }
.sticky-name { margin: 0; font-size: 0.6875rem; font-weight: 600; color: var(--c-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sticky-price { margin: 0; font-family: var(--font-display); font-size: 1.125rem; font-weight: 800; color: var(--c-text); }
.sticky-delivery { margin-inline-start: 0.5rem; font-size: 0.625rem; font-weight: 700; color: var(--c-muted); vertical-align: middle; }
.sticky-btn {
  flex-shrink: 0; border-radius: 9999px; background-image: linear-gradient(to left, var(--c-primary), var(--c-primary-strong));
  padding: 0.875rem 1.75rem; font-size: 0.875rem; font-weight: 700; color: var(--c-primary-text);
  box-shadow: 0 10px 15px -3px var(--c-glow);
}
</style>
</head>
<body>
<main style="min-height: 100vh; overflow: hidden; background: var(--c-bg); color: var(--c-text);">
  ${topBarHtml}
  ${headerHtml}
  ${showcaseHtml}
  ${featuresHtml}
  ${extrasHtml}
  ${testimonialsHtml}
  ${orderSectionHtml}
  ${footerHtml}
</main>
${stickyHtml}
${scriptsHtml}
</body>
</html>`;
}
