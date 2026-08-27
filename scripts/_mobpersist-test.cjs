// محاكاة موبايل: جلسة ← إغلاق المتصفح ← فتح جديد بنفس التخزين ← يجب الدخول مباشرة
// وبقاء حقول التسويق (واتساب/بيكسل/اسم المتجر) من الخادم
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
const BASE = process.env.BASE || "https://spectre-tau-five.vercel.app";

(async () => {
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

  const b = await chromium.launch();
  // ── الجلسة الأولى: جهاز "جديد" يسجّل دخوله أول مرة ──
  const c1 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar" });
  const p1 = await c1.newPage();
  // رصد استجابات حفظ التسويق تحديدًا
  p1.on("response", async (r) => {
    if (r.request().method() === "POST" && r.url().includes("/api/auth/profile")) {
      let body = "";
      try { body = (await r.text()).slice(0, 160); } catch {}
      console.log("  [net]", r.status(), body);
    }
  });
  let PEP = null, EMAIL = null;
  await p1.route("**/api/auth/login", async (route) => {
    try {
      const body = route.request().postDataJSON?.() || {};
      const fpReal = String(body.fingerprint || "");
      if (fpReal && fpReal.length >= 8 && !PEP) {
        PEP = pepper(fpReal);
        EMAIL = `mobpersist_${Date.now()}@example.com`;
        const acc0 = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? { devices: [] };
        await sb.from("kv").upsert({ key: `studio-auth/devices/${PEP}.json`, value: { fingerprint: PEP, createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { ...acc0, devices: [...new Set([...(acc0.devices ?? []), PEP])] }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `studio-auth/profiles/${PEP}.json`, value: { fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: true, pixelId: "123456789012345", whatsapp: "213661223344", storeName: "متجر الموبايل التجريبي", showNamePublicly: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `subs/${EMAIL}.json`, value: { userId: EMAIL, plan: "gold", status: "active", maxProducts: 10, maxImages: 10, startsAt: new Date().toISOString(), expiresAt: null, reason: null, updatedAt: new Date().toISOString() } }, { onConflict: "key" });
      }
    } catch {}
    await route.continue();
  });

  await p1.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p1.locator("input[autocomplete='username']").first().fill("project");
  await p1.locator("input[type='password']").first().fill("SPECTRE");
  await p1.getByRole("button", { name: /^(دخول|Sign in)$/i }).first().click();
  await p1.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 40000 });
  ok(true, "[جلسة1] دخول أول مرة على الجهاز الجديد");

  // حفظ رقم واتساب من قسم التسويق (زر التغيير المستقل)
  await p1.getByText(/اربط بريدك|Link your email/).first().waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
  await p1.getByRole("button", { name: /الإعدادات|settings/i }).first().click();
  await p1.waitForTimeout(1200);
  const d1 = p1.locator("[role='dialog'][aria-modal='true']").first();
  const waInput = d1.locator("input[inputmode='tel']").first();
  await waInput.fill("0661223344");
  await d1.getByRole("button", { name: /تغيير رقم الواتساب|Change WhatsApp number/i }).first().click();
  await p1.waitForTimeout(2000);
  const codeBox = d1.locator("input[placeholder='000000']");
  // القاعدة النهائية: الجهاز موثَّق مسبقاً ← الحفظ مباشر بلا رمز (سلوك مقصود)
  // استطلاع ظهور رسالة النجاح حتى 8 ثوانٍ (زمن استجابة الإنتاج)
  let savedDirect = 0;
  for (let i = 0; i < 10 && !savedDirect; i++) { await p1.waitForTimeout(800); savedDirect = await d1.getByText(/تم الحفظ/).count(); }
  ok(savedDirect > 0 || (await d1.getByText(/Saved/i).count()) > 0, "[جلسة1] تغيير الرقم حُفظ مباشرة بلا رمز (القاعدة النهائية)");
  if (!savedDirect) {
    const t1 = await d1.innerText().catch(() => "");
    console.log("DUMP:", t1.replace(/\s+/g, " ").slice(0, 350));
  }

  // استخراج مفاتيح التخزين لمحاكاة إعادة الفتح لاحقاً
  const storedFp = await p1.evaluate(() => localStorage.getItem("studio-device-fingerprint-v1"));
  const sessionRaw = await p1.evaluate(() => localStorage.getItem("landing-studio-session") || localStorage.getItem("generated-landing-session") || "");
  console.log("  ℹ storedFp:", storedFp ? storedFp.slice(0, 12) + "…" : "null", "| session:", Boolean(sessionRaw));
  ok(Boolean(storedFp), "البصمة مُثبَّتة في localStorage");
  await c1.close();

  // ── الجلسة الثانية: متصفح «أُغلق ثم فُتح» بنفس التخزين ──
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar" });
  const p2 = await c2.newPage();
  await p2.addInitScript(
    ({ fp, sess }) => {
      try {
        if (fp) window.localStorage.setItem("studio-device-fingerprint-v1", fp);
        if (sess) {
          for (const k of ["landing-studio-session"]) {
            // نجرّب المفتاحين المعروفين للجلسة
          }
          window.localStorage.setItem("landing-studio-session", sess);
          window.localStorage.setItem("generated-landing-session", sess);
        }
      } catch {}
    },
    { fp: storedFp, sess: sessionRaw }
  );

  await p2.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p2.waitForTimeout(2500);
  const loginVisible2 = await p2.locator("input[autocomplete='username']").first().isVisible().catch(() => false);
  ok(!loginVisible2, "[جلسة2] لا شاشة دخول — الجلسة استمرت بعد «إغلاق المتصفح»");
  await p2.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 20000 }).catch(() => {});
  const editor2 = (await p2.getByText(/منتجات الصفحة|Page products/).count()) > 0;
  ok(editor2, "المحرّر ظاهر مباشرة في الجلسة الثانية");

  // الإعدادات تعرض الواتساب المحفوظ سابقاً من الخادم
  await p2.getByRole("button", { name: /الإعدادات|settings/i }).first().click();
  await p2.waitForTimeout(1500);
  const d2 = p2.locator("[role='dialog'][aria-modal='true']").first();
  await d2.getByText(/واتساب استلام الطلبات|WhatsApp number/).first().waitFor({ timeout: 8000 }).catch(() => {});
  const waVal = await d2.locator("input[inputmode='tel']").first().inputValue().catch(() => "");
  ok(/661223344$/.test(waVal || ""), `[جلسة2] رقم الواتساب المحفوظ ظاهر (${waVal})`);
  const pxVal = await d2.locator("input[inputmode='numeric'][maxlength='30']").first().inputValue().catch(() => "");
  ok(pxVal === "123456789012345", `[جلسة2] البيكسل المحفوظ ظاهر (${pxVal})`);
  const snVal = await d2.locator("input[maxlength='40']").first().inputValue().catch(() => "");
  ok(snVal.includes("الموبايل"), `[جلسة2] اسم المتجر ظاهر (${snVal})`);

  await c2.close();

  // تنظيف كامل
  const a2 = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? { devices: [] };
  await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { ...a2, devices: (a2.devices ?? []).filter((d) => d !== PEP) }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  await sb.from("kv").delete().eq("key", `studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/manual-pending/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/profiles/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `subs/${EMAIL}.json`);
  console.log("تنظيف: تم");

  console.log(`\nالنتيجة: ${pass} نجح / ${fail} فشل`);
  await b.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });
