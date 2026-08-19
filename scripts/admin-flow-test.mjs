// اختبار تدفق دخول الأدمن الكامل: نقر الزر → تعبئة → إرسال → فحص /admin
import { chromium } from "playwright";

// بيانات الدخول من البيئة (دون كشف) — تُقرأ من .env.local
import { readFileSync } from "fs";
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const BASE = process.env.BASE || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL || "menez223@gmail.com";
const PASS = process.env.ADMIN_PASSWORD || "Aline";

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 240)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 240)));

try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // الزر يظهر بـ«Admin login» (كرش إنجليزي افتراضيًا)
  const trigger = page.getByRole("button", { name: /Admin login|دخول المشرف/i }).first();
  console.log("زر الدخول موجود:", (await trigger.count()) > 0);
  await trigger.click();
  await page.waitForTimeout(1200);

  const emailF = await page.locator("input[type='email']").count();
  const passF = await page.locator("input[type='password']").count();
  console.log("نافذة الدخول تفتح (email/pass):", emailF, passF);

  if (emailF && passF) {
    await page.locator("input[type='email']").fill(EMAIL);
    await page.locator("input[type='password']").fill(PASS);
    // زر الإرسال داخل النموذج (type=submit)
    const submit = page.locator("form button[type='submit']").first();
    console.log("زر الإرسال موجود:", (await submit.count()) > 0);
    await submit.click();
    await page.waitForTimeout(3000);

    // هل صار التوجيه إلى /admin؟
    const url = page.url();
    console.log("الرابط بعد الإرسال:", url);

    // هل ظهرت لوحة الأدمن (عنوان)؟
    const panelTitle = await page.getByText(/subscriptions|الاشتراكات|لوحة|admin/i, { exact: false }).count();
    console.log("محتوى لوحة الأدمن ظاهر:", panelTitle > 0);

    // فحص الكوكي
    const cookies = await ctx.cookies();
    const adminCookie = cookies.find((c) => c.name === "spectre_admin");
    console.log("كوكي spectre_admin موجود:", !!adminCookie, adminCookie ? `(secure=${adminCookie.secure}, httpOnly=${adminCookie.httpOnly})` : "");
  }
} catch (e) {
  errors.push("FATAL: " + e.message);
  console.log("💥 خطأ:", e.message);
} finally {
  await browser.close();
}
console.log("\nأخطاء الكونسول/الصفحة:", errors.length);
errors.slice(0, 15).forEach((e) => console.log("  ⚠️ " + e));
