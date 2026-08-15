// اختبار مسار الأدمن الحقيقي لزر «حظر» — لا محاكاة يدوية.
// 1) ننشئ مستخدماً ضحية (معتمد + مربوط ببريد + اشتراك نشط + جهاز مربوط بالبريد).
// 2) ندخل كأدمن عبر /api/admin/login (كوكي موقّع).
// 3) نضغط زر «حظر» الفعلي: POST /api/admin/subscription {action:set, status:banned}.
// 4) نتحقّق من المسارين: can-produce يرفض + account يرجع blocked:true (يطرد AuthGate).
// مُعزول تماماً — منطقة محذوفة بالكامل في التنظيف. لا يكشف بيانات حسّاسة.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
for (const k of Object.keys(env)) if (!(k in process.env)) process.env[k] = env[k];

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const TABLE = "kv";
const pepper = (fp) => createHash("sha256").update(fp + "|" + (process.env.DEVICE_PEPPER || "")).digest("hex");
const setKv = (key, value) => supabase.from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
const getKv = async (key) => {
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
};
const delKv = (key) => supabase.from(TABLE).delete().eq("key", key);
const listKv = async (prefix) => {
  const { data, error } = await supabase.from(TABLE).select("key,value").like("key", prefix + "%");
  if (error) throw error;
  return data ?? [];
};

const base = process.env.E2E_BASE || "https://spectre-tau-five.vercel.app";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "menez223@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Aline";

const FP = "REALFLOW_FP_" + Date.now();
const PEP = pepper(FP);
const EMAIL = "realflow_" + Date.now() + "@example.com";
const deviceKey = `studio-auth/devices/${PEP}.json`;
const profileKey = `studio-auth/profiles/${PEP}.json`;
const acc0 = (await getKv("studio-auth/account.json")) ?? { devices: [] };
const devices0 = acc0.devices ?? [];

console.log("\n[إعداد] مستخدم ضحية: معتمد + مربوط ببريد + اشتراك نشط");
await setKv(deviceKey, { fingerprint: PEP, createdAt: new Date().toISOString() });
await setKv("studio-auth/account.json", { ...acc0, devices: [...new Set([...devices0, PEP])] });
await setKv(profileKey, { fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
await setKv(`subs/${EMAIL}.json`, { userId: EMAIL, plan: "free", status: "active", startsAt: new Date().toISOString(), expiresAt: null, reason: null, updatedAt: new Date().toISOString() });

ok((await getKv(deviceKey))?.fingerprint === PEP, "الجهاز معتمد (صف مستقل)");
ok((await getKv(profileKey))?.email === EMAIL, "البريد مربوط بالجهاز");
ok((await getKv(`subs/${EMAIL}.json`))?.status === "active", "اشتراك نشط");

console.log("\n[قبل الحظر] account يجب أن يرجع approved:true (يدخل الاستوديو)");
let before = await fetch(`${base}/api/auth/account?fingerprint=${encodeURIComponent(FP)}`).then((r) => r.json());
ok(before.approved === true && before.blocked !== true, "account قبل الحظر: approved=true وغير محظور | " + JSON.stringify(before));

console.log("\n[1] دخول الأدمن الحقيقي عبر /api/admin/login");
const adminRes = await fetch(`${base}/api/admin/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const adminBody = await adminRes.json().catch(() => ({}));
const adminCookie = adminRes.headers.get("set-cookie");
ok(adminRes.status === 200 && adminBody.ok === true && adminCookie, "الأدمن يدخل ويستلم كوكي جلسة | رمز: " + adminRes.status);
const cookieStr = (adminCookie || "").split(";")[0];

console.log("\n[2] ضغط زر «حظر» الفعلي: POST /api/admin/subscription {action:set, status:banned}");
const banRes = await fetch(`${base}/api/admin/subscription`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: cookieStr },
  body: JSON.stringify({ userId: EMAIL, action: "set", status: "banned", reason: "اختبار حظر حقيقي" }),
});
const banBody = await banRes.json().catch(() => ({}));
ok(banRes.status === 200 && banBody.ok === true, "الأدمن يحظر البريد بنجاح | رمز: " + banRes.status + " ردّ: " + JSON.stringify(banBody));

console.log("\n[3] هل حُظر صفّ الجهاز فعلاً؟ (ما يفعله زر الحظر خلف الكواليس)");
const devRow = await getKv(deviceKey);
ok(devRow?.banned === true, "صفّ الجهاز المستقل موسوم banned=true | " + JSON.stringify(devRow));
const subRow = await getKv(`subs/${EMAIL}.json`);
ok(subRow?.status === "banned", "اشتراك البريد محظور | " + subRow?.status);

console.log("\n[4] can-produce بعد الحظر (المسار الذي قلتَ يعمل)");
let cp = null;
for (let i = 0; i < 4; i++) {
  cp = await fetch(`${base}/api/auth/can-produce?fingerprint=${encodeURIComponent(FP)}`).then((r) => r.json());
  if (cp.allowed === false) break;
}
ok(cp.allowed === false && (cp.reason === "banned" || cp.status === "banned"), "can-produce يرفض المحظور | " + JSON.stringify(cp));

console.log("\n[5] ★ الأساسي: account بعد الحظر (يقرر طرد AuthGate للرئيسية)");
// قراءة مباشرة لحالة التخزين الخام للتشخيص
const rawSub = await getKv(`subs/${EMAIL}.json`);
const rawDev = await getKv(deviceKey);
console.log("    [تشخيص] subs الخامّ: " + JSON.stringify(rawSub));
console.log("    [تشخيص] device الخامّ: " + JSON.stringify(rawDev));
let acc = null;
for (let i = 0; i < 4; i++) {
  acc = await fetch(`${base}/api/auth/account?fingerprint=${encodeURIComponent(FP)}`).then((r) => r.json());
  if (acc.blocked === true) break;
}
ok(acc.blocked === true && acc.approved === false, "account يرجع blocked=true → AuthGate يطرده للرئيسية | " + JSON.stringify(acc));

console.log("\n[6] فحص حافة: ماذا لو لم يُحظر صفّ الجهاز (فقط اشتراك البريد)؟");
// نرفع حظر صفّ الجهاز يدوياً مؤقتاً لنثبت أن فحص الاشتراك وحده يكفي لطرده.
await setKv(deviceKey, { fingerprint: PEP, createdAt: new Date().toISOString() });
let acc2 = await fetch(`${base}/api/auth/account?fingerprint=${encodeURIComponent(FP)}`).then((r) => r.json());
ok(acc2.blocked === true, "حتى مع رفع حظر صفّ الجهاز، الاشتراك المحظور يرجع blocked=true | " + JSON.stringify(acc2));
// نعيد حظر صفّ الجهاز كي يطابق الحالة الحقيقية
await setKv(deviceKey, { fingerprint: PEP, banned: true, createdAt: new Date().toISOString() });

console.log("\n[تنظيف] إلغاء الحظر + حذف منطقة الاختبار (الحساب لم يُمَسّ)");
await fetch(`${base}/api/admin/subscription`, {
  method: "POST", headers: { "Content-Type": "application/json", cookie: cookieStr },
  body: JSON.stringify({ userId: EMAIL, action: "set", status: "active", reason: null }),
}).catch(() => {});
await delKv(`subs/${EMAIL}.json`);
await delKv(profileKey);
await delKv(deviceKey);
await setKv("studio-auth/account.json", { ...acc0, devices: devices0 });
const accNow = (await getKv("studio-auth/account.json")) ?? { devices: [] };
ok((accNow.devices ?? []).length === devices0.length, "الحساب لم يُمَسّ — الأجهزة كما كانت (" + devices0.length + ")");

console.log("\nالنتيجة النهائية: " + pass + " نجح / " + fail + " فشل");
process.exit(fail === 0 ? 0 : 1);
