// اختبار طرف-لطرف شامل لمزايا الجلسة (محلي فقط):
// 1) API: مسار النشر محمي + خانة ?slug= المخصّصة أُزيلت فعلاً (يُتجاهل بأمان).
// 2) استوديو سطح مكتب: نشر ← صندوق نجاح ← قائمة صفوف بأزرار دائمة
//    (✏️ تعديل يحمل المنشور للمحرّر · نسخ · إلغاء) ← تعديل سعر ← تحديث على نفس الرابط.
// 3) إزالة خانة «رابط صفحتك» مؤكدة (نص غير موجود).
// 4) هواتف 375px: الرئيسية بلا فيضان أفقي + 🔑 أيقونة الأدمن + CTA بعرض كامل
//    + الاستوديو بحقول 16px (تكبير iOS) + زر رجوع أيقونة فقط.
// ذاتي التنظيف: يحذف المنشور وصفوف الاختبار من القاعدة بعد الانتهاء.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync } from "fs";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BASE = process.env.BASE || "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const pepper = (raw) => createHash("sha256").update(raw + "|" + (process.env.DEVICE_PEPPER || "")).digest("hex");
const setKv = (key, value) => sb.from("kv").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
const getKv = async (key) => (await sb.from("kv").select("value").eq("key", key).maybeSingle()).data?.value ?? null;
const delKv = (key) => sb.from("kv").delete().eq("key", key);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// تهيئة جهاز اختبار معتمد + ملف شخصي ببريد + اشتراك basic نشط (نمط ban-real-flow).
async function seedDevice(rawFp) {
  const PEP = pepper(rawFp);
  const EMAIL = `feat_e2e_${Date.now()}@example.com`;
  const acc0 = (await getKv("studio-auth/account.json")) ?? { devices: [] };
  await setKv(`studio-auth/devices/${PEP}.json`, { fingerprint: PEP, createdAt: new Date().toISOString() });
  await setKv("studio-auth/account.json", { ...acc0, devices: [...new Set([...(acc0.devices ?? []), PEP])] });
  await setKv(`studio-auth/profiles/${PEP}.json`, {
    fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null,
    adminVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  await setKv(`subs/${EMAIL}.json`, {
    userId: EMAIL, plan: "basic", status: "active",
    maxProducts: 1, maxImages: 2,
    startsAt: new Date().toISOString(), expiresAt: null, reason: null,
    updatedAt: new Date().toISOString(),
  });
  return async () => {
    try {
      const acc = (await getKv("studio-auth/account.json")) ?? { devices: [] };
      await setKv("studio-auth/account.json", { ...acc, devices: (acc.devices ?? []).filter((d) => d !== PEP) });
      await delKv(`studio-auth/devices/${PEP}.json`);
      await delKv(`studio-auth/profiles/${PEP}.json`);
      await delKv(`subs/${EMAIL}.json`);
    } catch {}
  };
}

// ─────────────────────────── [1] فحوص API ───────────────────────────
console.log("\n[1] فحوص API (بلا مصادقة)");
{
  const r1 = await fetch(`${BASE}/api/publish?slug=nonexistent`).then(async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }));
  ok(r1.s === 404 && r1.b.error === "not_found", `GET منشور غير موجود → 404 not_found | ${r1.s}`);
  const r2 = await fetch(`${BASE}/api/publish?slug=my-custom-link&fingerprint=testfp12345`, { method: "POST", body: "{}" })
    .then(async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }));
  ok(r2.s === 401 && r2.b.error === "unauthorized", `POST مع ‎?slug=‎ بلا اعتماد → 401 (المعامل أُزيل والمصادقة أولاً) | ${r2.s} ${JSON.stringify(r2.b)}`);
}

// ─────────────── [2] استوديو سطح المكتب — النشر/التعديل/النسخ ───────────────
console.log("\n[2] الاستوديو (سطح مكتب): نشر ← قائمة دائمة ← تعديل سعر ← تحديث نفس الرابط");
const browser = await chromium.launch();
let publishedSlug = null, desktopFp = null, cleanupDesktop = null;

try {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
    locale: "ar",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // لغة الواجهة الافتراضية en — نفرض العربية قبل أي تحميل.
  await page.addInitScript(() => window.localStorage.setItem("landing-studio-lang", "ar"));

  // اعتراض تسجيل الدخول: التقاط البصمة الخام + تهيئة جهاز معتمد قبل متابعة الطلب.
  await page.route("**/api/auth/login", async (route) => {
    try {
      const body = route.request().postDataJSON?.() || {};
      const fp = String(body.fingerprint || "");
      if (fp && fp.length >= 8 && !cleanupDesktop) {
        desktopFp = fp;
        cleanupDesktop = await seedDevice(fp);
      }
    } catch {}
    await route.continue();
  });

  await page.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("input[autocomplete='username']").first().fill("project");
  await page.locator("input[type='password']").first().fill("SPECTRE");
  await page.getByRole("button", { name: /^(دخول|Sign in)$/i }).first().click();

  // انتظار تحميل المحرّر (قسم «منتجات الصفحة»)
  await page.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 30000 });
  ok(true, "الدخول بالجهاز المُهيّأ → المحرّر ظاهر");

  // انتظر تحميل الملف الشخصي (اختفاء بانر قفل البريد) قبل أي نشر
  await page
    .getByText(/اربط بريدك|Link your email/)
    .first()
    .waitFor({ state: "hidden", timeout: 30000 })
    .catch(() => {});

  // تسخين الدوال الباردة بعد النشر + فحص نقطة الإحصائيات الجديدة
  try {
    const st = await page.request.get(
      `${BASE}/api/my-page-stats?fingerprint=${encodeURIComponent(desktopFp || "x")}`
    );
    console.log("  ℹ my-page-stats:", st.status());
  } catch {}

  // انتظار زوال بانر القفل (حتى يُحمَّل الملف الشخصي بالبريد قبل النشر)
  await page
    .getByText(/اربط بريدك|Link your email/)
    .first()
    .waitFor({ state: "hidden", timeout: 20000 })
    .catch(() => {});

  // تأكيد إزالة خانة «رابط صفحتك»
  ok((await page.getByText(/رابط صفحتك|Your page link/).count()) === 0, "خانة «رابط صفحتك» غير موجودة (أُزيلت)");

  // تعبئة المنتج: اسم + سعر + صورة عبر رابط (محددات ثنائية اللغة)
  const nameInput = page.getByPlaceholder(/سماعات لاسلكية برو|e\.g\. Pro wireless/i).first();
  await nameInput.fill("منتج تجريبي E2E");
  await page.locator("input[placeholder='4500']").first().fill("4500");
  await page.getByRole("button", { name: /رابط صورة|Image URL/ }).first().click();
  await page.locator("input[placeholder='https://example.com/product.jpg']").first().fill(BASE + "/FB.png");
  await page.getByRole("button", { name: /استخدام الرابط|Use URL/ }).first().click();
  await sleep(2500); // مهلة استخراج اللوحة اللونية

  // النشر الأول
  const pubResp = page.waitForResponse((r) => r.url().includes("/api/publish") && r.request().method() === "POST", { timeout: 90000 });
  await page.getByRole("button", { name: /نشر رابط مباشر|Publish direct link/ }).first().click();
  const resp = await pubResp;
  const data = await resp.json().catch(() => ({}));
  ok(resp.ok() && !!data.url, `النشر نجح | ${resp.status()} slug=${data.slug ?? "?"}`);
  publishedSlug = data.slug ?? null;

  await page.getByText(/✓ نُشرت الصفحة|✓ Page published/).first().waitFor({ timeout: 15000 });

  // صندوق النجاح: يحوي زر تعديل أيضاً
  ok(
    (await page.getByRole("button", { name: /تعديل السعر والصور|Edit prices & images/ }).count()) >= 1,
    "صندوق النجاح يعرض زر «✏️ تعديل السعر والصور»"
  );

  // القائمة الدائمة: صف يحوي تعديل/نسخ/إلغاء (تُجلب من الخادم بعد النشر — ننتظرها)
  const row = page.locator("div.flex.flex-wrap.items-center.gap-x-3", { hasText: publishedSlug }).first();
  await row.waitFor({ state: "visible", timeout: 20000 });
  ok(true, "صف الصفحة المنشورة ظاهر في القائمة");
  ok((await row.getByRole("button", { name: /✏️ تعديل|✏️ Edit/ }).count()) === 1, "الصف يحمل زر «✏️ تعديل»");
  ok((await row.getByRole("button", { name: /نسخ الرابط|Copy link/ }).count()) === 1, "الصف يحمل زر «نسخ الرابط»");
  ok((await row.getByRole("button", { name: /إلغاء|Cancel/ }).count()) === 1, "الصف يحمل زر «إلغاء»");
  ok((await page.getByRole("button", { name: /رابط جديد|New link/ }).count()) >= 1, "زر «♻ رابط جديد» ما زال موجوداً");

  // [أ] نسخ رابط الصف من القائمة
  await row.getByRole("button", { name: /نسخ الرابط|Copy link/ }).click();
  await sleep(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  ok(clip === `${BASE}/p/${publishedSlug}`, `نسخ الرابط → الحافظة صحيحة | ${clip}`);

  // [ب] تعديل: يحمل المنشور إلى المحرّر
  await row.getByRole("button", { name: /✏️ تعديل|✏️ Edit/ }).click();
  await page.getByText(/حُمِّلت الصفحة المنشورة إلى المحرّر|loaded into the editor/).first().waitFor({ timeout: 15000 });
  ok(true, "بانر التحميل الإرشادي ظهر");
  await sleep(1200); // مهلة التمرير السلس لأعلى
  const scrollY = await page.evaluate(() => window.scrollY);
  ok(scrollY < 200, `التمرير لأعلى المحرّر | scrollY=${scrollY}`);
  const priceInput = page.locator("input[placeholder='4500']").first();
  ok((await priceInput.inputValue()) === "4500", "السعر حُمِّل من المنشور (4500)");

  // [ج] تغيير السعر ثم التحديث على نفس الرابط
  await priceInput.fill("9999");
  const repubResp = page.waitForResponse((r) => r.url().includes("/api/publish") && r.request().method() === "POST", { timeout: 90000 });
  await page.getByRole("button", { name: /تحديث الرابط|Update link/ }).first().click();
  const resp2 = await repubResp;
  const data2 = await resp2.json().catch(() => ({}));
  ok(resp2.ok() && data2.slug === publishedSlug, `إعادة النشر على نفس الرابط | slug=${data2.slug}`);

  // تحقق خادمي نهائي: السعر تحدّث والمعرّف ثابت
  const after = await fetch(`${BASE}/api/publish?slug=${encodeURIComponent(publishedSlug)}`).then((r) => r.json());
  ok(after.product?.price === 9999 && after.product?.id === publishedSlug, `الخادم يخدم السعر المعدّل (9999) على نفس الرابط | ${after.product?.price}`);

  ok(errors.length === 0, `بلا أخطاء صفحة | ${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
  await ctx.close();
} catch (e) {
  fail++;
  console.log("  ✗ FATAL [2]: " + e.message.split("\n").slice(0, 3).join(" | "));
}

// ─────────────── [3] هواتف 375×812 — الرئيسية + الاستوديو ───────────────
console.log("\n[3] هواتف 375×812: بلا فيضان + 🔑 + CTA بعرض كامل + حقول 16px + رجوع أيقونة");
try {
  const mctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true, hasTouch: true, locale: "ar",
  });
  const mp = await mctx.newPage();
  await mp.addInitScript(() => window.localStorage.setItem("landing-studio-lang", "ar"));

  // الرئيسية
  await mp.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 1, `الرئيسية بلا فيضان أفقي | تفاوت=${overflow}px`);

  const adminBtn = mp.locator("header button", { hasText: "🔑" }).first();
  ok((await adminBtn.count()) === 1, "زر الأدمن أيقونة 🔑 على الهاتف");
  const adminLabelHidden = await adminBtn.evaluate((btn) =>
    Array.from(btn.querySelectorAll("span")).some(
      (s) => getComputedStyle(s).display === "none" && /دخول|Admin/i.test(s.textContent || "")
    )
  );
  ok(adminLabelHidden, "نص «دخول المشرف» مخفي على الهاتف");

  const ctaWidth = await mp.evaluate(() => {
    const els = Array.from(document.querySelectorAll("a[href='/studio'], a[href='#catalog'], button")).filter((el) =>
      /ابدأ|تصفّح|تجربة|Start|Browse|Demo/i.test(el.textContent || "")
    );
    return Math.max(0, ...els.map((el) => el.getBoundingClientRect().width));
  });
  ok(ctaWidth >= 320, `أزرار البطل بعرض كامل تقريباً | العرض=${Math.round(ctaWidth)}px`);

  // الاستوديو على الهاتف (بصمة جديدة بسبب المقاس → تهيئة ثانية)
  let mobileFp = null, cleanupMobile = null;
  await mp.route("**/api/auth/login", async (route) => {
    try {
      const body = route.request().postDataJSON?.() || {};
      const fp = String(body.fingerprint || "");
      if (fp && fp.length >= 8 && !cleanupMobile) {
        mobileFp = fp;
        cleanupMobile = await seedDevice(fp);
      }
    } catch {}
    await route.continue();
  });
  await mp.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await mp.locator("input[autocomplete='username']").first().fill("project");
  await mp.locator("input[type='password']").first().fill("SPECTRE");
  await mp.getByRole("button", { name: /^(دخول|Sign in)$/i }).first().click();
  await mp.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 30000 });

  const fs = await mp
    .getByPlaceholder(/سماعات لاسلكية برو|e\.g\. Pro wireless/i)
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  ok(fs === "16px", `حقول المحرّر 16px على الهاتف (تكبير iOS) | ${fs}`);

  const backLabelHidden = await mp.evaluate(() => {
    const a = document.querySelector("header a[href='/']");
    if (!a) return false;
    return Array.from(a.querySelectorAll("span")).some(
      (s) => getComputedStyle(s).display === "none" && /رجوع|Back/i.test(s.textContent || "")
    );
  });
  ok(backLabelHidden, "زر الرجوع أيقونة فقط (النص مخفي)");

  const hH = await mp.locator("header").first().boundingBox();
  ok(hH && hH.height <= 190, `ترويسة الاستوديو مضغوطة | ارتفاع=${Math.round(hH?.height ?? 0)}px`);

  await cleanupMobile?.();
  await mctx.close();
} catch (e) {
  fail++;
  console.log("  ✗ FATAL [3]: " + e.message.split("\n").slice(0, 3).join(" | "));
}

await browser.close();

// ─────────────── تنظيف ذاتي ───────────────
console.log("\n[تنظيف] حذف المنشور وصفوف الاختبار…");
try {
  if (publishedSlug && desktopFp) {
    const d = await fetch(`${BASE}/api/publish?slug=${encodeURIComponent(publishedSlug)}&fingerprint=${encodeURIComponent(desktopFp)}`, { method: "DELETE" });
    ok(d.ok, `حذف المنشور التجريبي (${publishedSlug})`);
  }
} catch {}
try { await cleanupDesktop?.(); } catch {}

console.log(`\nالنتيجة النهائية: ${pass} نجح / ${fail} فشل`);
process.exit(fail ? 1 : 0);
