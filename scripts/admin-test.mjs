import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3004";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0,200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0,200)));
try {
  // 1) فتح نافذة دخول الأدمن عبر ?admin=1 على الرئيسية
  await page.goto(BASE + "/?admin=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const loginBox = await page.getByText(/للمشرف فقط|دخول المشرف|adminEnter|adminLoginTitle/i).count();
  console.log("نافذة دخول الأدمن تظهر على الرئيسية (?admin=1):", loginBox > 0);
  // هل يوجد حقلا email/password داخل النافذة؟
  const emailField = await page.locator("input[type='email']").count();
  const passField = await page.locator("input[type='password']").count();
  console.log("حقول الدخول (email/password):", emailField, passField);
  // 2) هل /admin يُعيد توجيه (307)؟
  const resp = await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  console.log("زيارة /admin -> status", resp && resp.status(), "final url", page.url());
} catch (e) {
  errors.push("FATAL: " + e.message);
} finally {
  await browser.close();
}
console.log("\nأخطاء:", errors.length);
errors.slice(0,10).forEach(e=>console.log("  ⚠️ "+e));
