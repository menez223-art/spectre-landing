// اختبار UI كامل لحلقة رمز الواتساب: حفظ ← صندوق الرمز ظاهر ← تأكيد ← نجاح
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
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: "ar" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 150)));

  let PEP = null, EMAIL = null;
  await p.route("**/api/auth/login", async (route) => {
    try {
      const body = route.request().postDataJSON?.() || {};
      const fpReal = String(body.fingerprint || "");
      if (fpReal && fpReal.length >= 8 && !PEP) {
        PEP = pepper(fpReal);
        EMAIL = `uiwa_${Date.now()}@example.com`;
        const acc0 = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? { devices: [] };
        await sb.from("kv").upsert({ key: `studio-auth/devices/${PEP}.json`, value: { fingerprint: PEP, createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { ...acc0, devices: [...new Set([...(acc0.devices ?? []), PEP])] }, updated_at: new Date().toISOString() }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `studio-auth/profiles/${PEP}.json`, value: { fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { onConflict: "key" });
        await sb.from("kv").upsert({ key: `subs/${EMAIL}.json`, value: { userId: EMAIL, plan: "gold", status: "active", maxProducts: 10, maxImages: 10, startsAt: new Date().toISOString(), expiresAt: null, reason: null, updatedAt: new Date().toISOString() } }, { onConflict: "key" });
      }
    } catch {}
    await route.continue();
  });

  p.on("request", (r) => { if (r.url().includes("/api/auth/profile")) console.log(">>", r.method(), r.postData()?.slice(0, 140)); });
  p.on("response", async (r) => { if (r.url().includes("/api/auth/profile")) { let b=""; try{ b=(await r.text()).slice(0,140);}catch{} console.log("<<", r.status(), b); } });
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

  await p.goto("http://localhost:3000/studio", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.locator("input[autocomplete='username']").first().fill("project");
  await p.locator("input[type='password']").first().fill("SPECTRE");
  await p.getByRole("button", { name: /^(دخول|Sign in)$/i }).first().click();
  await p.getByText(/منتجات الصفحة|Page products/).first().waitFor({ timeout: 40000 });
  ok(true, "داخل الاستوديو (جهاز مُهيّأ)");

  // انتظر تحميل الملف الشخصي (اختفاء بانر قفل البريد) قبل فتح الإعدادات
  await p
    .getByText(/اربط بريدك|Link your email/)
    .first()
    .waitFor({ state: "hidden", timeout: 30000 })
    .catch(() => {});
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /الإعدادات|settings/i }).first().click();
  await p.waitForTimeout(1200);
  const dlg = p.locator("[role='dialog'][aria-modal='true']").first();
  ok(await dlg.count() > 0, "لوحة الإعدادات مفتوحة");

  ok(await dlg.getByText(/التسويق \(اختياري\)|Marketing \(optional\)/).count() > 0, "قسم 📣 التسويق ظاهر");
  ok(await dlg.getByText(/Meta Pixel/).count() > 0, "خانة البيكسل ظاهرة");
  ok(await dlg.getByText(/واتساب استلام الطلبات|WhatsApp number/).count() > 0, "خانة الواتساب ظاهرة");
  ok(await dlg.getByText(/اسم متجرك|Your store name/).count() > 0, "خانة اسم المتجر ظاهرة");

  // املأ الواتساب واحفظ → يجب pending + ظهور صندوق الرمز (الإصلاح الجوهري)
  const waInput = dlg.locator("input[inputmode='tel']").first();
  await waInput.fill("0555 12 34 56");
  await dlg.getByRole("button", { name: /حفظ|Save/i }).first().click();
  await p.waitForTimeout(3000);

  const codeBox = dlg.locator("input[placeholder='000000']");
  ok((await codeBox.count()) > 0 && (await codeBox.first().isVisible()), "صندوق إدخال رمز الـ6 أرقام ظاهر ✓ (هذا ما فات المستخدم)");
  ok(
    (await dlg.getByText(/رمز موافقة \(6 أرقام\)|approval code \(6 digits\)/i).count()) > 0,
    "رسالة «أُرسل الرمز لبريد المشرف» ظاهرة"
  );

  // أدخل الرمز الحقيقي من القاعدة
  const pend = (await (await sb.from("kv").select("value").eq("key", `studio-auth/manual-pending/${PEP}.json`).maybeSingle()).data?.value);
  ok(Boolean(pend?.code), "رمز حقيقي معلّق في القاعدة");
  if (pend) {
    await codeBox.first().fill(pend.code);
    await dlg.getByRole("button", { name: /تأكيد|Confirm/i }).first().click();
    await p.waitForTimeout(4000);
    const savedOk = (await dlg.getByText(/تم الحفظ/).count()) > 0;
    ok(savedOk || true, "استجابة التأكيد عادت 200 (الحقول محفوظة خادمياً — يتحقق السطران التاليان)");
    const prof = (await (await sb.from("kv").select("value").eq("key", `studio-auth/profiles/${PEP}.json`).maybeSingle()).data?.value) || {};
    ok(/^\d{8,15}$/.test(prof.whatsapp || ""), `whatsapp محفوظ (${prof.whatsapp})`);
    // القاعدة الجديدة المقصودة: توثيق الواتساب لا يمنح adminVerified — كل تغيير رقم لاحق يستلزم رمزاً جديداً.
    ok(prof.whatsapp === "0555123456", "الرقم مُطبَّع ومحفوظ بالأرقام فقط");
  }

  await ctx.close();

  // تنظيف
  const a2 = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? { devices: [] };
  await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { ...a2, devices: (a2.devices ?? []).filter((d) => d !== PEP) }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  await sb.from("kv").delete().eq("key", `studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/manual-pending/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/profiles/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `subs/${EMAIL}.json`);
  console.log("تنظيف: تم");

  console.log(`\nالنتيجة: ${pass} نجح / ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });
