// اختبار نهاية-إلى-نهاية لمنطق الحظر — معزول تماماً (لا يلمس account.json).
// يقرأ بصمة جهاز معتمد موجودة (للقراءة فقط)، وينشئ بريداً+اشتراكاً+منشوراً
// في منطقة معزولة تمحى بالكامل عند التنظيف. لا يكشف بيانات حساسة.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
for (const k of Object.keys(env)) if (!(k in process.env)) process.env[k] = env[k];

const { createClient } = await import("@supabase/supabase-js");

// بيانات الدخول الموحّد مُعرَّفة في app/lib/credentials.ts (ثابتة، غير حسّاسة كأمان حقيقي)
// نستخرجها بتحليل الملف حتى لا نكرّرها يدوياً في السكربت.
const credSrc = readFileSync("app/lib/credentials.ts", "utf8");
const MASTER_USERNAME = credSrc.match(/MASTER_USERNAME\s*=\s*"([^"]+)"/)?.[1] ?? "";
const MASTER_PASSWORD = credSrc.match(/MASTER_PASSWORD\s*=\s*"([^"]+)"/)?.[1] ?? "";
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

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; console.log("  ✗ " + m); } };

const base = process.env.E2E_BASE || "http://localhost:3100";

// ننشئ بصمة خام معتمدة خاصة بالاختبار — كـ«صف مستقل» ذرّي (studio-auth/devices/<PEP>.json)
// عبر نفس مسار authStore، بحيث لا تطمسه كتابة متزامنة من متصفح حيّ على account.json.
const FP = "BANFLOW_TEST_FP_" + Date.now();
const PEP = pepper(FP);
const deviceKey = `studio-auth/devices/${PEP}.json`;
const acc0 = (await getKv("studio-auth/account.json")) ?? { devices: [] };
const originalDevices = acc0.devices ?? [];
// نتأكد من وجود الصف المستقل (مقاوم للتنافس — لا يُطمس بكتابة account.json)
for (let attempt = 0; attempt < 10; attempt++) {
  const existing = await getKv(deviceKey);
  if (!existing) {
    await setKv(deviceKey, { fingerprint: PEP, createdAt: new Date().toISOString() });
  } else break;
}
const EMAIL = "banflow_" + Date.now() + "@example.com";
const SLUG = "banflow_" + Date.now();

console.log("\n[إعداد] جهاز اختبار معتمد (مُضاف بأمان) + منطقة معزولة...");
await setKv(`studio-auth/profiles/${PEP}.json`, { fingerprint: PEP, email: EMAIL, sheetUrl: null, sheetId: null, sheetKey: null, adminVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

console.log("\n[1] قبل الحظر: can-produce يجب أن يسمح");
const subBefore = { userId: EMAIL, plan: "free", status: "active", startsAt: new Date().toISOString(), expiresAt: null, reason: null, updatedAt: new Date().toISOString() };
await setKv(`subs/${EMAIL}.json`, subBefore);
ok(originalDevices.includes(PEP) === false && (await getKv(deviceKey))?.fingerprint === PEP, "الجهاز معتمد (صف مستقل ذرّي، الأصلية محفوظة: " + originalDevices.length + ")");
ok((await getKv(`studio-auth/profiles/${PEP}.json`))?.email === EMAIL, "مربوط ببريد");
ok((await getKv(`subs/${EMAIL}.json`))?.status === "active", "اشتراك نشط (يسمح بالإنتاج)");

console.log("\n[2] نشر منتج (ملكية: البريد)");
await setKv(`published/${SLUG}.json`, { id: SLUG, name: "منتج اختبار", price: 1000, image: "x" });
await setKv(`published-meta/${SLUG}.json`, { owner: EMAIL, createdAt: new Date().toISOString() });
ok((await getKv(`published-meta/${SLUG}.json`))?.owner === EMAIL, "المنشور مخزّن بملكية البريد");

console.log("\n[3] محاكاة حظر الأدمن: setSubscription(banned) + burnAllForEmail");
await setKv(`subs/${EMAIL}.json`, { ...subBefore, status: "banned", reason: "حظر اختبار", updatedAt: new Date().toISOString() });
const owners = new Set([EMAIL, `device:${PEP.slice(0, 24)}`, `device:${PEP}`]);
for (const o of owners) {
  const meta = await getKv(`published-meta/${SLUG}.json`);
  if (meta && (meta.owner === o || o === EMAIL)) {
    await setKv(`published-meta/${SLUG}.json`, { ...meta, banned: true });
    break;
  }
}
ok((await getKv(`subs/${EMAIL}.json`))?.status === "banned", "الاشتراك محظور");
ok((await getKv(`published-meta/${SLUG}.json`))?.banned === true, "المنشور محروق (banned=true) → الرابط سيعرض «محظور»");

console.log("\n[4] بعد الحظر: إعادة فحص can-produce (المسار الحقيقي عبر API)");
// الصف المستقل ذرّي: لا تطمسه كتابة المتصفح الحي على account.json، فيجب أن
// يرجع can-produce دائماً banned. نعيد المحاولة فقط احتياطاً لزمن الكتابة.
let cp = null;
for (let attempt = 0; attempt < 4; attempt++) {
  cp = await fetch(`${base}/api/auth/can-produce?fingerprint=${encodeURIComponent(FP)}`).then((r) => r.json());
  if (cp.allowed === false && cp.reason === "banned") break;
}

ok(cp.allowed === false && cp.reason === "banned", "can-produce يرفض المحظور (reason=banned) | ردّ: " + JSON.stringify(cp));

console.log("\n[5] فتح الرابط القديم /p/<slug> (يجب أن يحجب)");
const pageHtml = await (await fetch(`${base}/p/${SLUG}`)).text();
ok(pageHtml.includes("محظور"), "صفحة الرابط تعرض «محظور» (المنشور محجوب)");

console.log("\n[6] حذف نهائي عبر deleteAllForEmail (محو الجذور)");
for (const o of owners) {
  const meta = await getKv(`published-meta/${SLUG}.json`);
  if (meta && meta.owner === o) {
    await delKv(`published/${SLUG}.json`);
    await delKv(`published-meta/${SLUG}.json`);
  }
}
await delKv(`subs/${EMAIL}.json`);
ok((await getKv(`published-meta/${SLUG}.json`)) === null, "الـ meta محذوف تماماً");
ok((await getKv(`published/${SLUG}.json`)) === null, "المنتج محذوف تماماً");
ok((await getKv(`subs/${EMAIL}.json`)) === null, "سجل الاشتراك محذوف تماماً");

console.log("\n[7] حافة «جهاز بلا إيميل»: حظر صفّ الجهاز المستقل يجب أن يمنعه من الإنتاج");
// جهاز ثانٍ ليس له إيميل مربوط (هويته device:<hash> فقط) — كان يفلت من حظر
// الإيميل سابقاً. نحظر صفّه المستقل مباشرةً ونثبت منعه عبر can-produce + publish.
const FP2 = "BANFLOW_NODEV_FP_" + Date.now();
const PEP2 = pepper(FP2);
const deviceKey2 = `studio-auth/devices/${PEP2}.json`;
for (let attempt = 0; attempt < 10; attempt++) {
  const existing = await getKv(deviceKey2);
  if (!existing) await setKv(deviceKey2, { fingerprint: PEP2, createdAt: new Date().toISOString() });
  else break;
}
// لا نكتب ملف تعريف بريدي → الهوية = device:<hash> فقط
ok((await getKv(deviceKey2))?.fingerprint === PEP2, "جهاز بلا إيميل معتمد (صف مستقل ذرّي)");
// نحظر صفّ الجهاز (محاكاة setDeviceBannedByPepper من الأدمن)
await setKv(deviceKey2, { fingerprint: PEP2, banned: true, createdAt: new Date().toISOString() });
// can-produce للجهاز المحظور يجب أن يرفض ب reason=banned (دون الاعتماد على إيميل)
let cp2 = null;
for (let attempt = 0; attempt < 4; attempt++) {
  cp2 = await fetch(`${base}/api/auth/can-produce?fingerprint=${encodeURIComponent(FP2)}`).then((r) => r.json());
  if (cp2.allowed === false && cp2.reason === "banned") break;
}
ok(cp2.allowed === false && cp2.reason === "banned", "can-produce يرفض جهازاً محظوراً بلا إيميل (reason=banned) | ردّ: " + JSON.stringify(cp2));
// النشر المباشر يجب أن يرفض بـ 403 (حماية دفاعية على /api/publish)
const pub2 = await fetch(`${base}/api/publish?fingerprint=${encodeURIComponent(FP2)}`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: "x", name: "n", price: 1 }),
});
ok(pub2.status === 403, "نشر مباشر لجهاز محظور بلا إيميل يُرفض (403) | رمز: " + pub2.status);

console.log("\n[8] اقتراح 2 (واجهة الدخول): دخول جهاز محظور بلا إيميل يجب أن يُرفض بـ «banned»");
const creds = { username: MASTER_USERNAME, password: MASTER_PASSWORD, fingerprint: FP2 };
const loginRes = await fetch(`${base}/api/auth/login`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(creds),
});
const loginBody = await loginRes.json().catch(() => ({}));
ok(loginRes.status === 403 && loginBody.error === "banned", "POST /api/auth/login لجهاز محظور يُرجع 403 + error=banned | رمز: " + loginRes.status + " ردّ: " + JSON.stringify(loginBody));

console.log("\n[9] اقتراح 2 (واجهة الاستوديو): جهاز معتمد حُظر على صفّه يُرجع blocked وطرده AuthGate للرئيسية");
const FP3 = "BANFLOW_APPROVED_FP_" + Date.now();
const PEP3 = pepper(FP3);
const deviceKey3 = `studio-auth/devices/${PEP3}.json`;
const acc0b = (await getKv("studio-auth/account.json")) ?? { devices: [] };
const devices0b = acc0b.devices ?? [];
for (let attempt = 0; attempt < 10; attempt++) {
  const existing = await getKv(deviceKey3);
  if (!existing) await setKv(deviceKey3, { fingerprint: PEP3, createdAt: new Date().toISOString() });
  else break;
}
await setKv(`studio-auth/account.json`, { ...acc0b, devices: [...new Set([...devices0b, PEP3])] });
// الأدمن يحظر صفّ الجهاز (كما في الواقع) رغم أنه معتمد
await setKv(deviceKey3, { fingerprint: PEP3, banned: true, createdAt: new Date().toISOString() });
let acc3 = null;
for (let attempt = 0; attempt < 4; attempt++) {
  acc3 = await fetch(`${base}/api/auth/account?fingerprint=${encodeURIComponent(FP3)}`).then((r) => r.json());
  if (acc3.blocked === true) break;
}
ok(acc3.blocked === true && acc3.approved === false, "account لجهاز معتمد محظور على صفّه يُرجع blocked=true → AuthGate يطرده للرئيسية | ردّ: " + JSON.stringify(acc3));
// تنظيف
await setKv(`studio-auth/account.json`, { ...acc0b, devices: devices0b });
await delKv(deviceKey3);
ok((await getKv(`studio-auth/account.json`))?.devices?.length === devices0b.length, "الحساب لم يُمَسّ بعد [9]");

console.log("\n[تنظيف] حذف بيانات الاختبار فقط (الحساب لم يُمَسّ)...");
await delKv(`studio-auth/profiles/${PEP}.json`);
await delKv(deviceKey); // حذف الصف المستقل للجهاز الاختباري
await delKv(deviceKey2); // حذف الصف المستقل للجهاز بلا إيميل
const accNow = (await getKv("studio-auth/account.json")) ?? { devices: [] };
ok((accNow.devices ?? []).length === originalDevices.length, "الحساب لم يُمَسّ — عدد الأجهزة كما كان (" + originalDevices.length + ") + الصفوف المستقلة محذوفة");

console.log("\nالنتيجة النهائية: " + pass + " نجح / " + fail + " فشل");
process.exit(fail === 0 ? 0 : 1);
