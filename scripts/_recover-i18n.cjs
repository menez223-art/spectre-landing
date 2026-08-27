// استرجاع قيم القاموس الإنجليزي من حزم JS المنشورة على الإنتاج + إعادة بناء قسم EN في i18n.ts
const { readFileSync, writeFileSync } = require("fs");

// 1) استخراج مفاتيح ومفاتيح AR الحالية (الترتيب محفوظ)
const src = readFileSync("app/lib/i18n.ts", "utf8");
const arBlock = src.slice(src.indexOf("const AR"), src.indexOf("} as const"));
const keyRe = /^ {2}([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/gm;
const arEntries = [];
let m;
while ((m = keyRe.exec(arBlock)) !== null) {
  arEntries.push({ key: m[1], arValue: JSON.parse('"' + m[2] + '"') });
}
console.log("مفاتيح AR:", arEntries.length);
const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);

(async () => {
  // 2) جلب صفحة الرئيسية من الإنتاج واستخراج روابط chunks
  const base = "https://spectre-tau-five.vercel.app";
  const html = await (await fetch(base + "/", { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  const chunkUrls = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((x) => x[0]))];
  console.log("chunks:", chunkUrls.length);

  const enMap = {};
  let targetChunk = null;
  const cands = {};
  for (const path of chunkUrls) {
    const url = base + path;
    let js;
    try { js = await (await fetch(url)).text(); } catch { continue; }
    if (!js.includes("heroTitle1")) continue;
    targetChunk = path;
    console.log("chunk الهدف:", path.split("/").pop());
    const pairRe = /([A-Za-z0-9_]+)\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let pm;
    while ((pm = pairRe.exec(js)) !== null) {
      const k = pm[1];
      let v;
      try { v = JSON.parse('"' + pm[2] + '"'); } catch { continue; }
      (cands[k] = cands[k] || []).push(v);
    }
    break;
  }
  if (!targetChunk) { console.error("لم يُعثر على chunk i18n!"); process.exit(1); }

  // اختيار أفضل مرشح: يفضَّل غير العربي؛ ثم الأطول (أغنى)
  const hasArabic = (s) => /[\u0600-\u06FF]/.test(s);
  for (const k of Object.keys(cands)) {
    const list = cands[k];
    const scored = list.map((v) => ({ v, score: (hasArabic(v) ? 0 : 2) + Math.min(v.length / 40, 1) }));
    scored.sort((a, b) => b.score - a.score);
    enMap[k] = scored[0].v;
  }

  // قيم إنجليزية صريحة لمفاتيح اليوم + مفاتيح طويلة مقسومة نصياً في الحزمة
  const OVERRIDES = {
    marketingSection: "📣 Marketing (optional)",
    marketingGuideBtn: "How to create a Pixel?",
    pixelLabel: "Meta Pixel ID",
    whatsappLabel: "WhatsApp number for orders",
    whatsappPlaceholder: "0555 12 34 56 or 213555123456",
    marketingHint:
      "The Pixel measures Facebook ads on your page. Orders arrive as a ready WhatsApp message on your number — changing that number requires a fresh admin approval code each time.",
    marketingSaved: "✓ Saved — applied to your page on next publish",
    marketingErrPixel: "Invalid Pixel ID — digits only (usually 15 digits)",
    marketingErrWhatsapp: "Invalid WhatsApp number — enter a valid number",
    guideTitle: "Create a Meta Pixel step by step",
    guideSub: "No code needed — just two minutes",
    guideStep1: "Open business.facebook.com and sign in with your normal Facebook account.",
    guideStep2: 'From the tools menu choose "Events Manager".',
    guideStep3: 'Click "Connect a Data Source" ← "Web" ← "Get Started".',
    guideStep4: "Name it after your store, then copy the number shown next to it (about 15 digits).",
    guideStep5: "Paste that number in the Pixel field here, press Save, then republish your page to activate it.",
    guideNote: "You never need any code or page edits — the platform injects the script automatically on publish.",
    editProductsBtn: "Edit prices & images",
    editProductsHint: "Loads the published page into the editor to change every product's price and images.",
    editBtn: "Edit",
    copiedShort: "Copied",
    editLoadingBtn: "Loading…",
    editLoadedHint:
      "The published page was loaded into the editor — change prices and images, then press «Update link» to publish on the same link, or «♻ New link» for a different one.",
    errEditLoad: "Could not load the published page — check your connection and try again.",
    orderSendWhatsapp: "Send your order via WhatsApp",
    orderWhatsappTail: "✅ I confirm my order above.",
    storeNameLabel: "Your store name",
    storeNamePlaceholder: "e.g. Sara Fashion Store",
    showNameLabel: "Show my name in the public store",
    byOwner: "By:",
    changeWhatsappBtn: "Change WhatsApp number",
    waVerifyPending: "Awaiting approval code…",
    myVisitsLabel: "Your page visits this month",
    mktWhatsappCodeSent:
      "🔒 An approval code (6 digits) was sent to the admin email to authorize this WhatsApp number — enter it here.",
    mktWhatsappCodeInfo:
      "To protect orders, adding or changing the WhatsApp number always requires a fresh approval code sent to the admin email.",
    footer1: "© 2026 Landing Pages Studio — Algeria.",
    footer2: "Delivery to 58 wilayas · Cash on delivery",
    testSent: "Test row sent — open your sheet and confirm a row with «true» in the test column",
    deliveryModeHint: "Fixed: one price for all wilayas · By wilaya: custom price per wilaya",
    uploadImageHint: "Color palette extracted automatically · or use the «Image URL» tab",
    fourWays:
      "💡 Four ways to publish: «🌍 Publish direct link» puts the page online with a link you can paste into ads, «⬇ Download HTML» gives you a single standalone file to host anywhere, «Generate page» saves it in this browser, and «Copy JSON» then paste the output into app/data/products.ts to make it a static page for all visitors at build time.",
    errPublishLarge:
      "The product is too large to publish (data:URL images) — use the «Image URL» tab then publish again.",
  };

  // 3) فحص تغطية القيم الإنجليزية (بلا أحرف عربية) لكل مفتاح AR
  let recovered = 0;
  const missing = [];
  const missingKeys = new Set();
  const entries = arEntries.map(({ key, arValue }) => {
    const cand = enMap[key];
    const isEn = typeof cand === "string" && cand.length > 0 && !hasArabic(cand);
    if (isEn) { recovered++; return { key, value: cand }; }
    missing.push(key); missingKeys.add(key);
    return { key, value: arValue }; // احتياط: القيمة العربية إن غابت الترجمة
  });

  // تطبيق القيم الصريحة على الناقصة (مفاتيح اليوم + الطويلة المقسومة نصياً)
  for (const [k, v] of Object.entries(OVERRIDES)) {
    if (missingKeys.has(k)) {
      enMap[k] = v;
      recovered++;
      const i = missing.indexOf(k);
      if (i >= 0) missing.splice(i, 1);
      const e = entries.find((x) => x.key === k);
      if (e) e.value = v;
    }
  }
  console.log("استُرجعت EN:", recovered, "| تحتاج override:", missing.length);
  writeFileSync("scripts/_missing-en.txt", missing.join("\n"), "utf8");

  // 4) إعادة بناء قسم EN بالكامل بنفس ترتيب مفاتيح AR
  const enStart = src.indexOf("const EN: Record<keyof typeof AR, string> = {");
  if (enStart < 0) { console.error("لم أجد بداية EN!"); process.exit(1); }
  const enBodyStart = src.indexOf("{", enStart) + 1;
  const closeIdx = src.indexOf("\n};", enBodyStart);
  const enEnd = closeIdx + "\n};".length;
  const enNew =
    "const EN: Record<keyof typeof AR, string> = {\n" +
    entries.map((e) => "  " + e.key + ": " + JSON.stringify(e.value) + ",").join("\n") +
    "\n};";
  const out = src.slice(0, enStart) + enNew + src.slice(enEnd);
  writeFileSync("app/lib/i18n.ts", out, "utf8");
  console.log("✓ تمت إعادة بناء قسم EN:", entries.length, "مفتاحاً");
})();
