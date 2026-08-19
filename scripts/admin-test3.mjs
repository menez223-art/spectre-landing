import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3004";
const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0,200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0,200)));
try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const btn = page.getByText("دخول المشرف", { exact: false });
  const cnt = await btn.count();
  console.log("زر «دخول المشرف» موجود:", cnt > 0);
  if (cnt) {
    await btn.first().click();
    await page.waitForTimeout(1200);
    const emailF = await page.locator("input[type='email']").count();
    const passF = await page.locator("input[type='password']").count();
    console.log("النافذة تفتح بالنقر:", emailF>0 && passF>0, "(email:", emailF, "pass:", passF, ")");
  }
} catch (e) {
  errors.push("FATAL: " + e.message);
} finally {
  await browser.close();
}
console.log("أخطاء:", errors.length);
errors.slice(0,10).forEach(e=>console.log("  ⚠️ "+e));
