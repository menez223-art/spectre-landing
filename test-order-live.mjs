// Playwright live test: open /p/spectre in real browser profile, fill form, submit, log all network + console
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const CHROME_USER_DATA = path.join(
  process.env.LOCALAPPDATA,
  "Google",
  "Chrome",
  "User Data"
);
const PROFILE_DIR = "Profile 4";
const TARGET = "https://spectre-dz.vercel.app/p/spectre";

(async () => {
  const context = await chromium.launchPersistentContext(
    path.join(CHROME_USER_DATA, PROFILE_DIR),
    {
      headless: false,
      channel: "chrome",
      viewport: { width: 1280, height: 900 },
      args: ["--no-sandbox"],
    }
  );
  const page = context.pages()[0] || (await context.newPage());

  const log = [];
  const logLine = (s) => {
    console.log(s);
    log.push(s);
  };

  page.on("console", (msg) => {
    logLine(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    logLine(`[PAGE ERROR] ${err.message}`);
  });
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/") || u.includes("script.google.com") || u.includes("facebook.com")) {
      logLine(`[REQ] ${req.method()} ${u}`);
    }
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("/api/") || u.includes("script.google.com") || u.includes("facebook.com")) {
      let body = "";
      try { body = await res.text(); } catch {}
      logLine(`[RES] ${res.status()} ${u} :: ${body.slice(0, 300).replace(/\n/g, " ")}`);
    }
  });
  page.on("requestfailed", (req) => {
    logLine(`[REQ FAILED] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`);
  });

  logLine(`\n=== OPENING ${TARGET} ===`);
  await page.goto(TARGET, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: "تأكيد الطلب" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  logLine("\n=== FILLING FORM ===");
  await page.getByLabel("الاسم الكامل", { exact: false }).fill("كريم متصفح حقيقي");
  await page.getByLabel("رقم الهاتف", { exact: false }).fill("0770001122");
  logLine("Filled name + phone");

  await page.selectOption("select", { label: "16 · الجزائر" });
  logLine("Selected wilaya: الجزائر");
  await page.waitForTimeout(2500);

  const allSelects = await page.locator("select").count();
  logLine(`Number of <select> elements: ${allSelects}`);

  logLine("\n=== SUBMITTING ===");

  // Inspect form state before submit
  const formState = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return { found: false };
    const inputs = Array.from(form.querySelectorAll("input, select, textarea")).map((el) => ({
      tag: el.tagName,
      type: el.type,
      name: el.name,
      id: el.id,
      value: el.value,
      disabled: el.disabled,
      required: el.required,
    }));
    return { found: true, inputs };
  });
  logLine("Form state pre-submit:");
  logLine(JSON.stringify(formState, null, 2));

  // Try to pick a commune too
  const communeSelect = page.locator("select").nth(1);
  const communeDisabled = await communeSelect.isDisabled();
  logLine(`Commune select disabled: ${communeDisabled}`);
  if (!communeDisabled) {
    const communeOptions = await communeSelect.locator("option").count();
    logLine(`Commune options: ${communeOptions}`);
    if (communeOptions > 1) {
      await communeSelect.selectOption({ index: 1 });
      logLine("Picked first commune");
    }
  }

  await page.waitForTimeout(1500);

  // Re-check state
  const formState2 = await page.evaluate(() => {
    const form = document.querySelector("form");
    const selects = Array.from(form.querySelectorAll("select")).map((el) => ({
      value: el.value,
      disabled: el.disabled,
    }));
    const inputs = Array.from(form.querySelectorAll("input")).map((el) => ({
      type: el.type,
      value: el.value,
    }));
    return { selects, inputs };
  });
  logLine("Form state pre-submit (after commune attempt):");
  logLine(JSON.stringify(formState2, null, 2));

  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await page.waitForTimeout(10000);

  // Wait + check for any order-related requests
  logLine("Waiting 8s for order submission...");
  await page.waitForTimeout(8000);

  // Check if success message appeared
  const successText = await page.evaluate(() => {
    const success = document.querySelector("[role='status'], [aria-live]");
    return success ? success.innerText : "no aria-live found";
  });
  logLine(`Success/aria-live text: ${successText.slice(0, 200)}`);

  // Check for any submit-blocked UI element
  const blockedText = await page.evaluate(() => {
    return document.body.innerText.includes("محظور") || document.body.innerText.includes("blocked") || document.body.innerText.includes("يرجى");
  });
  logLine(`Has blocked text: ${blockedText}`);

  logLine("\n=== DONE ===");
  const outPath = path.join(process.cwd(), "test-order-live.log");
  fs.writeFileSync(outPath, log.join("\n"), "utf8");
  logLine(`Log saved to: ${outPath}`);
  await page.screenshot({ path: "test-order-live.png", fullPage: true });

  await context.close();
  process.exit(0);
})().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
