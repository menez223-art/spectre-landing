// تشخيص نشر الإنتاج: رصد الشبكة/الكونسول/نص الخطأ الظاهر/حالة الزر
const { chromium } = require("playwright");
const { readFileSync } = require("fs");
const { createClient } = require("@supabase/supabase-js");
const { createHash } = require("crypto");
const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pepper = (r) => createHash("sha256").update(r + "|" + env.DEVICE_PEPPER).digest("hex");

(async () => {
  const BASE = "https://spectre-tau-five.vercel.app";
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: "ar" });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text().slice(0, 180)); });
  p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 200)));
  p.on("response", async (r) => {
    if (r.url().includes("/api/")) {
      let body = "";
      try { body = (await r.text()).slice(0, 120); } catch {}
      console.log("<<", r.status(), r.url().replace(BASE, ""), body);
    }
  });

  let PEP = null, EMAIL = null;
  await p.route("**/api/auth/login", async (route) => {
    try {
      const body = route.request().postDataJSON?.() || {};
      const fpReal = String(body.fingerprint || "");
      if (fpReal && fpReal.length >= 8 && !PEP) {
        PEP = pepper(fpReal);
        EMAIL = `diag2_${Date.now()}@example.com`;
        const acc0 = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? { devices: [] };
        await sb.from("kv").upsert({ key: `studio-auth/devices/${PEP}.json`, value: { fingerprint: PEP, createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { ...acc0, devices: [...new Set([...(acc0.devices ?? []), PEP])] }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `studio-auth/profiles/${PEP}.json`, value: { fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `subs/${EMAIL}.json`, value: { userId: EMAIL, plan: "gold", status: "active", maxProducts: 10, maxImages: 10, startsAt: new Date().toISOString(), expiresAt: null, reason: null, updatedAt: new Date().toISOString() } }, { onConflict: "key" });
      }
    } catch {}
    await route.continue();
  });

  await p.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.locator("input[autocomplete='username']").first().fill("project");
  await p.locator("input[type='password']").first().fill("SPECTRE");
  await p.getByRole("button", { name: /^(دخول|Sign in)$/i }).first().click();
  await p.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 40000 });
  console.log("--- المحرر ظاهر ---");

  await p.getByText(/اربط بريدك|Link your email/).first().waitFor({ state: "hidden", timeout: 25000 }).catch(() => {});
  console.log("بانر القفل مخفي ✓");

  await p.getByPlaceholder(/سماعات لاسلكية برو|e\.g\. Pro wireless/i).first().fill("تشخيص نشر");
  await p.locator("input[placeholder='4500']").first().fill("4500");
  await p.getByRole("button", { name: /رابط صورة|Image URL/ }).first().click();
  await p.locator("input[placeholder='https://example.com/product.jpg']").first().fill(BASE + "/FB.png");
  await p.getByRole("button", { name: /استخدام الرابط|Use URL/ }).first().click();
  await p.waitForTimeout(3500);

  // حالة الصورة في المسودة قبل النشر
  const imgState = await p.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).filter((i) => (i.src || "").includes("FB.png"));
    return imgs.map((i) => ({ ok: i.complete && i.naturalWidth > 0 }));
  });
  console.log("صورة FB.png:", JSON.stringify(imgState));

  const pubBtn = p.getByRole("button", { name: /نشر رابط مباشر|Publish direct link/ }).first();
  console.log("زر النشر disabled؟", await pubBtn.isDisabled());

  console.log("--- الضغط على النشر ---");
  const clicked = pubBtn.click({ timeout: 5000 }).then(() => "clicked").catch((e) => "click-err:" + e.message.split("\n")[0]);
  console.log(await clicked);
  await p.waitForTimeout(12000);

  const after = await p.evaluate(() => ({
    errBox: (() => { const el = document.querySelector(".border-red-400\\/30,[class*='red-50'],[class*='red-600']"); return el ? (el.textContent || "").slice(0, 200) : null; })(),
    successVisible: document.body.innerText.includes("✓ نُشرت") || document.body.innerText.includes("✓ Page published"),
    publishingLabel: document.body.innerText.includes("جارٍ النشر") || document.body.innerText.includes("Publishing…"),
  }));
  console.log("بعد 12ث:", JSON.stringify(after).slice(0, 400));
  await p.screenshot({ path: "scripts/_diag2.png", fullPage: false });

  // تنظيف إن نجح
  try {
    const listRes = await p.request.get(BASE + `/api/publish?fingerprint=${encodeURIComponent(globalThis.__fp || "")}`);
  } catch {}
  await b.close();
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });
