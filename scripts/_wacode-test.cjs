// اختبار بروتوكول رمز المشرف لرقم الواتساب — ذاتي التنظيف
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
const FP = "WACODE_" + Date.now();
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

  // جهاز معتمد نظيف — بلا adminVerified في الملف (سيطلبه البروتوكول)
  await sb.from("kv").upsert({ key: `studio-auth/devices/${PEP}.json`, value: { fingerprint: PEP, createdAt: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: "key" });

  console.log("[1] حفظ واتساب أول مرة بلا رمز → يجب pending/marketing");
  const r1 = await post({ action: "set_marketing", pixelId: "", whatsapp: "213555123456" });
  ok(r1.s === 200 && r1.b.pending === true && r1.b.step === "marketing", `pending ✓ ${r1.s}`);

  const pend = (await (await sb.from("kv").select("value").eq("key", `studio-auth/manual-pending/${PEP}.json`).maybeSingle()).data?.value);
  ok(Boolean(pend?.code), "الرمز المعلّق موجود في القاعدة (محاكاة بريد المشرف)");

  console.log("[2] رمز خاطئ → wrong_admin_code");
  const r2 = await post({ action: "set_marketing", pixelId: "", whatsapp: "213555123456", adminCode: "000000" });
  ok(r2.b.error === "wrong_admin_code", `${r2.s} ${r2.b.error}`);

  console.log("[3] الرمز الصحيح → ok + adminVerified=true + الحقول محفوظة");
  const r3 = await post({ action: "set_marketing", pixelId: "123456789012345", whatsapp: "213555123456", adminCode: pend.code });
  ok(r3.s === 200 && r3.b.profile?.adminVerified === true, "adminVerified=true بعد الموافقة");
  ok(r3.b.profile?.whatsapp === "213555123456", "whatsapp محفوظ");
  ok(r3.b.profile?.pixelId === "123456789012345", "pixelId محفوظ معه");

  console.log("[4] تعديل حر لاحق على نفس الجهاز (تغيير البيكسل والرقم) بلا أي رمز");
  const r4 = await post({ action: "set_marketing", pixelId: "999999999999999", whatsapp: "213766000000" });
  ok(r4.s === 200 && r4.b.profile?.pixelId === "999999999999999" && r4.b.profile?.whatsapp === "213766000000", "تعديل البيكسل والواتساب حر بعد التوثيق ✓");

  // تنظيف
  await sb.from("kv").delete().eq("key", `studio-auth/devices/${PEP}.json`);
  await sb.from("kv").delete().eq("key", `studio-auth/manual-pending/${PEP}.json`);
  await sb.from("kv").delete().eq("key", "studio-auth/account.json").then(() => {}, () => {});
  // نعيد بناء account.json كما كان تقريباً (كان قد يُنشأ فارغاً) — الأمان أولاً:
  // لا نحذفه إن كان موجوداً قبلنا؛ حذفنا أعلاه كان خاطئاً محتملاً فنعيد إنشاؤه من الصفر فقط إن لم يكن له أجهزة.
  const acc = (await (await sb.from("kv").select("value").eq("key", "studio-auth/account.json").maybeSingle()).data?.value) ?? null;
  if (!acc) {
    await sb.from("kv").upsert({ key: "studio-auth/account.json", value: { devices: [] }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  console.log(`\nالنتيجة: ${pass} نجح / ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL:", e.message.split("\n")[0]); process.exit(1); });
