// اختبار زر إعدادات الاستوديو (⚙) — يضغط الزر ويفحص ظهور اللوحة + أخطاء الكونسول
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { createHash } from "crypto";
import { readFileSync } from "fs";

try {
  const envText = readFileSync(".env.local", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BASE = process.env.BASE || "http://localhost:3003";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEVICE_PEPPER = process.env.DEVICE_PEPPER || "";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const pepper = (raw) => createHash("sha256").update(raw + "|" + DEVICE_PEPPER).digest("hex");

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

let realFp = null, pepperedFp = null;
await page.route("**/api/auth/login", async (route) => {
  try {
    const body = route.request().postDataJSON?.() || {};
    realFp = String(body.fingerprint || "");
    if (realFp && realFp.length >= 8) {
      pepperedFp = pepper(realFp);
      await sb.from("kv").upsert({ key: `studio-auth/devices/${pepperedFp}.json`, value: { fingerprint: pepperedFp, createdAt: new Date().toISOString() } });
    }
  } catch (e) { errors.push("intercept: " + e.message); }
  await route.continue();
});

try {
  await page.goto(BASE + "/studio", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator("input[autocomplete='username']").first().fill("project");
  await page.locator("input[type='password']").first().fill("SPECTRE");
  await page.getByRole("button", { name: /دخول|login|sign in/i }).first().click();
  await page.waitForTimeout(5000);

  const studioShown = (await page.locator(".product-picker").count()) > 0 || (await page.locator("text=المعاينة").count()) > 0;
  console.log("الاستوديو يظهر:", studioShown);

  // ابحث عن زر الإعدادات (⚙)
  const settingsBtn = page.getByRole("button", { name: /الإعدادات|settings/i }).first();
  const hasBtn = await settingsBtn.count();
  console.log("زر الإعدادات موجود:", hasBtn > 0);

  // قبل الضغط: اللوحة يجب ألا تكون ظاهرة (عنوان اللوحة = settingsTitle)
  const beforePanel = await page.locator("[role='dialog'][aria-modal='true']").count();
  console.log("اللوحة قبل الضغط:", beforePanel);

  if (hasBtn) {
    await settingsBtn.click();
    await page.waitForTimeout(2000);
    const afterPanel = await page.locator("[role='dialog'][aria-modal='true']").count();
    console.log("اللوحة بعد الضغط:", afterPanel);
    console.log("نتيجة زر الإعدادات:", afterPanel > beforePanel ? "✅ يعمل" : "❌ لا يفتح اللوحة");
  }
} catch (e) {
  errors.push("FATAL: " + e.message);
  console.log("💥 خطأ:", e.message);
} finally {
  try {
    if (pepperedFp) await sb.from("kv").delete().eq("key", `studio-auth/devices/${pepperedFp}.json`);
    await sb.from("kv").delete().eq("key", "studio-auth/devices/PEP.json");
  } catch {}
  await browser.close();
}

console.log("\nأخطاء الكونسول/الصفحة:", errors.length);
errors.slice(0, 20).forEach((e) => console.log("  ⚠️ " + e));
