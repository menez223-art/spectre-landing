// فحص شامل لصفحات Spectre عبر Playwright + Supabase
// 1) يُعتمد جهاز الاختبار الحقيقي (بصمته المُطعَّمة بالـ pepper) عبر اعتراض طلب الدخول
// 2) يدخل الاستوديو فعلياً ويختبر الخصائص + يلتقط أخطاء المتصفح
// 3) يختبر الرئيسية + التسعير + منشور تجريبي
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import { readFileSync } from "fs";

// تحميل .env.local يدوياً
try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const BASE = process.env.BASE || "http://localhost:3002";
const OUT = path.join(process.cwd(), "scripts", "audit-shots");
fs.mkdirSync(OUT, { recursive: true });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEVICE_PEPPER = process.env.DEVICE_PEPPER || "";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const errors = [];
const results = [];
function rec(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function setKv(key, value) {
  await sb.from("kv").upsert({ key, value });
}
async function getKv(key) {
  const { data } = await sb.from("kv").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
async function deleteKv(key) {
  await sb.from("kv").delete().eq("key", key);
}

// مطابقة منطق authStore.pepperFingerprint
function pepper(rawFp) {
  return createHash("sha256").update(rawFp + "|" + DEVICE_PEPPER).digest("hex");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("requestfailed", (r) => { const u = r.url(); if (!u.includes("fonts.g")) errors.push("requestfailed: " + u); });

// سيحمل البصمة الحقيقية عند أول طلب دخول
let realFp = null;
let pepperedFp = null;

// اعتراض طلب الدخول: نستخرج البصمة الحقيقية ونعتمدها قبل أن يصل الطلب للخادم
await page.route("**/api/auth/login", async (route) => {
  try {
    const body = route.request().postDataJSON?.() || {};
    realFp = String(body.fingerprint || "");
    if (realFp && realFp.length >= 8) {
      pepperedFp = pepper(realFp);
      // نكتب صف الجهاز المعتمد بنفس مخطط authStore.addApprovedDevice
      await setKv(`studio-auth/devices/${pepperedFp}.json`, { fingerprint: pepperedFp, createdAt: new Date().toISOString() });
      console.log("  [intercept] كُتب جهاز معتمد: " + pepperedFp.slice(0, 12) + "…");
    } else {
      console.log("  [intercept] بصمة مفقودة/قصيرة: " + JSON.stringify(realFp));
    }
  } catch (e) {
    errors.push("intercept: " + e.message);
    console.log("  [intercept] خطأ: " + e.message);
  }
  await route.continue();
  try {
    const resp = await route.request().response();
    if (resp) {
      const txt = await resp.text();
      console.log("  [login response] " + resp.status() + " :: " + txt.slice(0, 200));
    }
  } catch {}
});

async function shot(name) { await page.screenshot({ path: path.join(OUT, name + ".png"), fullPage: true }); console.log("📸 " + name); }

try {
  // ── 1) الرئيسية ──
  console.log("\n=== الصفحة الرئيسية / ===");
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot("01_home");
  rec("الرئيسية تُحمّل", (await page.locator("text=كيف يعمل").count()) > 0 || (await page.locator("text=How it works").count()) > 0);
  rec("صورة fb.png ظاهرة", (await page.locator("img[src*='fb.png']").count()) > 0);

  // ── 2) التسعير ──
  console.log("\n=== صفحة التسعير /pricing ===");
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot("02_pricing");
  // ننتظر ظهور إحدى الباقتين (عربي/إنجليزي) بمرونة
  const basicAr = await page.locator("text=الأساسية").count();
  const basicEn = await page.locator("text=Basic").count();
  const proAr = await page.locator("text=المحترفة").count();
  const proEn = await page.locator("text=Pro").count();
  rec("خطة الأساسية ظاهرة", basicAr > 0 || basicEn > 0, `AR=${basicAr} EN=${basicEn}`);
  rec("خطة المحترفة ظاهرة", proAr > 0 || proEn > 0, `AR=${proAr} EN=${proEn}`);
  rec("السعر 2000 ظاهر", (await page.locator("text=2000").count()) > 0);
  rec("السعر 4000 ظاهر", (await page.locator("text=4000").count()) > 0);

  // ── 3) الاستوديو (دخول بجهاز معتمد عبر الاعتراض) ──
  console.log("\n=== الاستوديو /studio ===");
  await page.goto(BASE + "/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot("03_studio_login");
  rec("شاشة الدخول ظاهرة", (await page.locator("input[autocomplete='username']").count()) > 0);

  const userField = page.locator("input[autocomplete='username']").first();
  const passField = page.locator("input[type='password']").first();
  await userField.fill("project");
  await passField.fill("SPECTRE");
  // لقطة قبل الضغط
  await shot("03b_before_click");
  await page.getByRole("button", { name: /دخول|login|sign in/i }).first().click();

  // ننتظر إما ظهور الاستوديو أو بقاء شاشة الدخول/الرمز
  await page.waitForTimeout(3500);
  await shot("04_studio_after_login");

  // هل ظهر الاستوديو؟
  const studioShown =
    (await page.locator("input[placeholder='ProSound']").count()) > 0 ||
    (await page.locator("text=نشر").count()) > 0 ||
    (await page.locator("text=المعاينة").count()) > 0 ||
    (await page.locator("text=المنتجات").count()) > 0;
  rec("الاستوديو يظهر بعد الدخول الصحيح", studioShown, realFp ? `fp=${realFp.slice(0, 12)}…` : "no fp");

  if (studioShown) {
    console.log("\n=== اختبار تفاعل الاستوديو ===");
    const brand = page.locator("input[placeholder='ProSound']").first();
    if (await brand.count()) {
      await brand.fill("منتج اختبار");
      rec("حقل العلامة قابل للتعبئة", true);
    }
    const preview =
      (await page.locator(".product-picker").count()) > 0 ||
      (await page.locator("text=اطلب الآن").count()) > 0 ||
      (await page.locator("text=المعاينة").count()) > 0;
    rec("المعاينة الحية محمّلة", preview);
    await shot("05_studio_interactive");
  } else {
    const stillLogin = (await page.locator("input[autocomplete='username']").count()) > 0;
    const codeStage = (await page.locator("text=رمز التفعيل").count()) > 0;
    const denied = (await page.locator("text=تعذّر الدخول").count()) > 0;
    rec("سبب عدم الظهور: شاشة دخول باقية", stillLogin);
    rec("سبب عدم الظهور: مرحلة رمز التفعيل", codeStage);
    rec("سبب عدم الظهور: شاشة منع", denied);
  }
} catch (e) {
  errors.push("FATAL: " + e.message);
  console.log("💥 خطأ فادح: " + e.message);
} finally {
  // تنظيف جهاز الاختبار الحقيقي
  try {
    if (pepperedFp) await deleteKv(`studio-auth/devices/${pepperedFp}.json`);
    // تنظيف بقايا PEP القديمة من الفحص السابق (إن وُجدت)
    await deleteKv(`studio-auth/devices/PEP.json`);
    const acc = (await getKv("studio-auth/account.json")) ?? { devices: [] };
    const cleaned = (acc.devices ?? []).filter((d) => d !== "PEP");
    if (cleaned.length !== (acc.devices ?? []).length) {
      await setKv("studio-auth/account.json", { ...acc, devices: cleaned });
    }
    console.log("\n🧹 تم تنظيف جهاز الاختبار");
  } catch {}
  await browser.close();
}

rec("لا أخطاء runtime في المتصفح", errors.length === 0, errors.length + " أخطاء");
if (errors.length) errors.slice(0, 20).forEach((e) => console.log("  ⚠️ " + e));

const passed = results.filter((r) => r.pass).length;
console.log(`\n📊 النتيجة: ${passed}/${results.length} فحص ناجح`);
const report = { base: BASE, passed, total: results.length, results, errors };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
