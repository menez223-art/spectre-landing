// تحقق: كل تغيير لرقم الواتساب يستلزم رمز موافقة جديد — حتى على جهاز موثَّق
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
const BASE = "http://localhost:3000";
const FP = "WAREV_" + Date.now();
const PEP = pepper(FP);

(async () => {
  const post = async (body) => {
    const r = await fetch(BASE + "/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: FP, ...body }),
    });
    return { s: r.status, b: await r.json().catch(() => ({})) };
  };
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

  // جهاز موثَّق مسبقاً برقم واتساب قائم
  await sb.from("kv").upsert({ key: `studio-auth/devices/${PEP}.json`, value: { fingerprint: PEP, createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  await sb.from("kv").upsert({ key: `studio-auth/profiles/${PEP}.json`, value: { fingerprint: PEP, email: "warev@example.com", sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: true, whatsapp: "213555111222", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, { onConflict: "key" });

  console.log("[1] تغيير الرقم على جهاز موثَّق بلا رمز → يجب pending رغم التوثيق");
  const r1 = await post({ action: "set_marketing", pixelId: "", whatsapp: "213766000000" });
  ok(r1.b.pending === true && r1.b.step === "marketing", `pending/marketing ✓ ${r1.s}`);

  const pend1 = (await (await sb.from("kv").select("value").eq("key", `studio-auth/manual-pending/${PEP}.json`).maybeSingle()).data?.value);
  ok(Boolean(pend1?.code), "رمز جديد معلّق ✓");

  console.log("[2] الرمز الصحيح → الحفظ يتم ولا يُكتب adminVerified من هنا");
  const r2 = await post({ action: "set_marketing", pixelId: "123456789012345", whatsapp: "213766000000", adminCode: pend1.code });
  ok(r2.s === 200 && r2.b.profile?.whatsapp === "213766000000", "الرقم الجديد محفوظ ✓");
  ok(r2.b.profile?.adminVerified === true, "adminVerified كما كان (true سابقاً — لم نمسّه)");
  const pendGone = !(await (await sb.from("kv").select("value").eq("key", `studio-auth/manual-pending/${PEP}.json`).maybeSingle()).data?.value);
  ok(pendGone, "الرمز المعلّق مُسح بعد النجاح ✓");

  console.log("[3] تعديل البيكسل فقط (بلا تغيير الرقم) → يُحفظ فوراً بلا رمز");
  const r3 = await post({ action: "set_marketing", pixelId: "999999999999999", whatsapp: "213766000000" });
  ok(r3.s === 200 && !r3.b.pending && r3.b.profile?.pixelId === "999999999999999", "تعديل البيكسل حر ✓");

  // تنظيف
  await sb.from("kv").delete().eq("key", `studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/profiles/${PEP}.json`);

  console.log(`\nالنتيجة: ${pass} نجح / ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });
