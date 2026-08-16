// سكربت معزول لاختبار منطق التدوير (المقترح 1):
// رابط واحد لكل مستخدم، وعند طلب تغييره يُحرَق القديم تلقائياً ويُولَّد جديد.
// يعمل على حساب وهمي "rotate-test-owner" — لا يلمس حساب المستخدم الحقيقي
// ولا نظام الحظر/المصادقة. يقرأ أسرار Supabase من .env.local داخلياً (لا تُطبع).
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── قراءة الأسرار من .env.local دون طباعتها ──
function loadEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const TABLE = "kv";

// محاكاة دوال التخزين في kvStore.ts
async function setKv(key, value) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
async function getKv(key) {
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}
async function deleteKvMany(keys) {
  if (!keys.length) return;
  const { error } = await supabase.from(TABLE).delete().in("key", keys);
  if (error) throw error;
}

// ── منطق التدوير المنسوخ من app/api/publish/route.ts (rotateOwnerSlug) ──
const ownerSlugKey = (owner) => `owner-slug/${owner}`;
async function rotateOwnerSlug(owner) {
  const old = await getKv(ownerSlugKey(owner));
  if (typeof old === "string" && old.length > 0) {
    await deleteKvMany([`published/${old}.json`, `published-meta/${old}.json`]);
  }
  const fresh = "rotate-test-" + Math.random().toString(36).slice(2, 10);
  await setKv(ownerSlugKey(owner), fresh);
  return fresh;
}

const OWNER = "rotate-test-owner";
const slugA = "rotate-test-aaa";
const product = { id: slugA, name: "منتج اختبار التدوير", price: 1000 };
const meta = { owner: OWNER, createdAt: new Date().toISOString() };

// 1) نثبّت رابطاً أولياً للحساب الوهمي مع منشور
await setKv(ownerSlugKey(OWNER), slugA);
await setKv(`published/${slugA}.json`, product);
await setKv(`published-meta/${slugA}.json`, meta);

const before = await getKv(ownerSlugKey(OWNER));
const existsBefore = (await getKv(`published/${slugA}.json`)) !== null;
console.log("قبل التدوير:");
console.log("  رابط الحساب =", before);
console.log("  المنشور القديم موجود؟", existsBefore);

// 2) نطلب تدوير الرابط (نفس منطق ?newLink=1)
const slugB = await rotateOwnerSlug(OWNER);

// 3) نتحقق
const after = await getKv(ownerSlugKey(OWNER));
const oldGone = (await getKv(`published/${slugA}.json`)) === null; // يحترق القديم
const newExists = (await getKv(`published/${slugB}.json`)) === null; // بعده ننشئه
await setKv(`published/${slugB}.json`, { ...product, id: slugB });
const newNowExists = (await getKv(`published/${slugB}.json`)) !== null;
const newLinkPointsToNew = after === slugB;

console.log("\nبعد التدوير:");
console.log("  رابط الحساب الآن =", after);
console.log("  المنشور القديم احترق (404)؟", oldGone);
console.log("  الرابط الجديد مولّد ومربوط؟", newLinkPointsToNew && newNowExists);

// 4) تنظيف القطع الوهمية
await deleteKvMany([ownerSlugKey(OWNER), `published/${slugA}.json`, `published-meta/${slugA}.json`, `published/${slugB}.json`, `published-meta/${slugB}.json`]);
console.log("\n✅ تم تنظيف الحساب الوهمي من التخزين.");

const pass = before === slugA && existsBefore && oldGone && newLinkPointsToNew && newNowExists;
console.log("\nالنتيجة:", pass ? "✅ ناجح — التدوير يحرق القديم ويولّد جديداً كما طُلب" : "❌ فشل");
process.exit(pass ? 0 : 1);
