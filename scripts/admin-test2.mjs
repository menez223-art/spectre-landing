import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3004";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0,200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0,200)));
try {
  // زر «دخول المشرف» بالنقر (بلا ?admin=1)
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const adminBtn = page.getByRole("button", { name: /دخول المشرف|adminLoginTitle|المشرف/i }).first();
  console.log("زر دخول المشرف موجود:", (await adminBtn.count()) > 0);
  if (await adminBtn.count()) {
    await adminBtn.click();
    await page.waitForTimeout(1200);
    const modal = await page.locator("input[type='email']").count();
    console.log("النافذة تفتح بالنقر على الزر:", modal > 0);
  }
  // هل صفحة /admin تُجمَّع بلا خطأ؟ (status 307 = منطقي لبلا جلسة)
  const resp = await page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  console.log("/admin status:", resp && resp.status(), "-> url:", page.url());
} catch (e) {
  errors.push("FATAL: " + e.message);
} finally {
  await browser.close();
}
console.log("أخطاء:", errors.length);
errors.slice(0,10).forEach(e=>console.log("  ⚠️ "+e));
