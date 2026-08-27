// اختبار سيناريو «الإعدادات التسويقية تتبع البريد» — ذاتي التنظيف
// السيناريو: جهاز قديم (A) عليه إعدادات ← جهاز جديد (B) يربط نفس البريد
// يجب: 1) ترحيل القيم تلقائياً إلى B عند القراءة  2) تعديل الواتساب من B بلا رمز
//      3) التغيير يظهر فوراً على A أيضاً (مصدر واحد = سجل البريد)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = process.env.BASE || "https://spectre-tau-five.vercel.app";
const pepperHash = (raw) => createHash("sha256").update(raw + "|" + env.DEVICE_PEPPER).digest("hex");

const tag = Date.now().toString(36);
const fpA = `mkta-${tag}-aaaaaaaa`;
const fpB = `mktb-${tag}-bbbbbbbb`;
const EMAIL = `mkt-${tag}@test-spectre.local`;
const hA = pepperHash(fpA), hB = pepperHash(fpB);
const now = () => new Date().toISOString();

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? " | " + extra : ""}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? " | " + extra : ""}`); }
}

async function kvSet(key, value) {
  const { error } = await sb.from("kv").upsert({ key, value, updated_at: now() }, { onConflict: "key" });
  if (error) throw error;
}
async function kvDel(key) {
  await sb.from("kv").delete().eq("key", key);
}

const keys = [
  `studio-auth/devices/${hA}.json`,
  `studio-auth/devices/${hB}.json`,
  `studio-auth/profiles/${hA}.json`,
  `studio-auth/profiles/${hB}.json`,
  `studio-auth/marketing/${EMAIL}.json`,
  `subs/${EMAIL}.json`,
];

try {
  // ── تهيئة: جهازان معتمدان؛ A عليه إعدادات قديمة، B مربوط بنفس البريد بلا إعدادات
  await kvSet(`studio-auth/devices/${hA}.json`, { fingerprint: hA, createdAt: now() });
  await kvSet(`studio-auth/devices/${hB}.json`, { fingerprint: hB, createdAt: now() });
  await kvSet(`studio-auth/profiles/${hA}.json`, {
    fingerprint: hA, email: EMAIL, sheetUrl: null, sheetId: null,
    pixelId: "1234567890", whatsapp: "213555000111",
    storeName: "متجر الاختبار", showNamePublicly: true,
    createdAt: now(), updatedAt: now(),
  });
  await kvSet(`studio-auth/profiles/${hB}.json`, {
    fingerprint: hB, email: EMAIL, sheetUrl: null, sheetId: null,
    createdAt: now(), updatedAt: now(),
  });

  // [1] جهاز B الجديد يقرأ حسابه → يجب أن يجد القيم المُرحَّلة من A
  let r = await fetch(`${BASE}/api/auth/account?fingerprint=${encodeURIComponent(fpB)}`);
  let d = await r.json();
  check("[1] ترحيل تلقائي إلى الجهاز الجديد", r.ok && d.approved && d.profile?.pixelId === "1234567890" && d.profile?.whatsapp === "213555000111",
    `pixel=${d.profile?.pixelId} wa=${d.profile?.whatsapp}`);

  // [2] تعديل الواتساب من B بلا أي رمز → نجاح مباشر
  r = await fetch(`${BASE}/api/auth/profile`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint: fpB, action: "set_marketing", whatsapp: "213555000222" }),
  });
  d = await r.json();
  check("[2] تغيير واتساب من جهاز جديد بلا رمز", r.ok && d.profile?.whatsapp === "213555000222", `wa=${d.profile?.whatsapp}`);

  // [3] التغيير يظهر على الجهاز القديم A أيضاً (مصدر البريد الموحد)
  r = await fetch(`${BASE}/api/auth/account?fingerprint=${encodeURIComponent(fpA)}`);
  d = await r.json();
  check("[3] تزامن فوري على الجهاز القديم", d.profile?.whatsapp === "213555000222" && d.profile?.pixelId === "1234567890",
    `wa=${d.profile?.whatsapp}`);

  // [4] البيكسل لا يتأثر بحفظ الواتساب المنفصل (حفظ جزئي سليم)
  check("[4] الحفظ الجزئي يحفظ بقية الحقول", d.profile?.storeName === "متجر الاختبار");
} catch (e) {
  fail++;
  console.log(`  ✗ استثناء: ${e.message}`);
} finally {
  for (const k of keys) { try { await kvDel(k); } catch {} }
  console.log(`[تنظيف] ${keys.length} مفاتيح اختبار حُذفت`);
}
console.log(`النتيجة: ${pass} نجح / ${fail} فشل`);
process.exit(fail > 0 ? 1 : 0);
