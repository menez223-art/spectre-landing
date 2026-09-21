// تخزين مفتاح/قيمة (KV) — server only
// مصدران للبيانات بترتيب أولوية صارم:
//   1. Supabase Postgres (جدول kv) — الإنتاج وأي بيئة فيها SUPABASE_URL + SERVICE_ROLE_KEY.
//   2. devKvStore — ملف JSON محلي للتجربة على localhost فقط، يُفعَّل حصرياً
//      حين لا يكون Supabase مُهيّأً (مفاتيح غائبة) — كي يعمل دخول الاستوديو
//      وربط الإيميل محلياً دون الحاجة لمفاتيح الإنتاج. محصور بالبيئة غير
//      Vercel (`process.env.VERCEL !== "1"`) كي لا يسكت عن ضياع بيانات في
//      الإنتاج الحقيقي حين تُفقد متغيرات Supabase — السلوك: رمي خطأ واضح
//      بدل الكتابة على ملف JSON محلي يختفي مع كل نشر.

import { getSupabase, getSupabaseCached, hasSupabase } from "./supabase";
import {
  getDevKv,
  setDevKv,
  deleteDevKv,
  listDevKv,
  listDevKvKeys,
  deleteDevKvMany,
  initDevKv,
  insertDevKvMany,
} from "./devKvStore";

const TABLE = "kv";

// هل نحن على Vercel؟ تُعرَّف VERCEL=1 تلقائياً في كل بيئة Vercel (preview + prod).
const isVercel = process.env.VERCEL === "1";

// مصدر البيانات الفعلي: Supabase إن وُفِّر، وإلا مخزن التطوير المحلي بشرط
// ألّا نكون على Vercel (فشل صريح في الإنتاج بدلاً من صمت كارثي).
const useDevStore = !hasSupabase() && !isVercel;

// ⚠️ تحذير صريح عند العمل على المخزن المحلي: غياب SUPABASE_SERVICE_ROLE_KEY
// كان يمرّ صامتاً فيسبّب «لا أرى المشتركين» و«ربط الإيميل لا يعمل» بلا أي أثر
// يشرح السبب. تحذير واحد يكفي لئلا يتكرر التشخيص من الصفر كل جلسة.
if (useDevStore) {
  console.warn(
    "[kvStore] ⚠️ Supabase غير مُهيَّأ (SUPABASE_SERVICE_ROLE_KEY غائب) — " +
      "البيانات تُقرأ وتُكتب في مخزن التطوير المحلي .dev-kv/kv.json، " +
      "وهو **لا يعكس الإنتاج**: لن يظهر المشتركون ولن يعمل ربط الإيميل كما في الموقع الرسمي. " +
      "أضف SUPABASE_SERVICE_ROLE_KEY إلى .env.local ليعود المحلي ليعكس نفس البيانات."
  );
}

// بذرة أولى للأجهزة المعتمدة في وضع التطوير المحلي — تُكتب مرة واحدة عند
// أول تهيئة، كي لا يعلق دخول الاستوديو في حلقة «أول جهاز يُعتمد تلقائياً»
// الرامز البريدي المقابل لبصمة الاختبار يُنشأ عند أول دخول، فلا حاجة لبذرة.
initDevKv();

export function hasKvStore(): boolean {
  return hasSupabase() || useDevStore;
}

// ── قفل «القراءة فقط» للمحلي ──────────────────────────────────────────────
// متى وُضع SUPABASE_SERVICE_ROLE_KEY محلياً، يصبح المحلي متصلاً بقاعدة
// الإنتاج: أي نشر/حظر/حذف/تعديل يجريه المالك أثناء التجربة يقع **فعلاً** على
// الإنتاج. هذا القفل الاختياري (KV_READ_ONLY=1) يمنع كل الكتابات من بيئة
// غير Vercel، فيصير المحلي مرآةً آمنة للإنتاج: يرى المشتركين والصفحات ويجرّب
// الواجهة، بلا أي أثر على البيانات الحقيقية.
// لا يُفعَّل على Vercel أبداً (حماية من إساءة الضبط).
const readOnly = process.env.KV_READ_ONLY === "1" && !isVercel;
if (readOnly) {
  console.warn(
    "[kvStore] 🔒 KV_READ_ONLY=1 — كل الكتابات معطّلة في هذه البيئة (قراءة فقط). " +
      "الإنتاج في أمان؛ احذف المتغير من .env.local للسماح بالكتابة."
  );
}

function assertWritable(op: string): void {
  if (!readOnly) return;
  throw new Error(
    `[kvStore] ${op} مرفوض: KV_READ_ONLY=1 مفعّل (حماية الإنتاج من الكتابة المحلية).`
  );
}

export async function setKv(key: string, value: unknown): Promise<void> {
  if (useDevStore) {
    await setDevKv(key, value);
    return;
  }
  assertWritable("setKv");
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

// إدراج مجموعة كاملة أو رفضها كلها عند تعارض أي مفتاح (قيد PRIMARY KEY).
// لا نستخدم upsert هنا: استبدال سجل تجربة سابقة يُبطل شرط «مرة واحدة».
export async function insertKvMany(rows: { key: string; value: unknown }[]): Promise<boolean> {
  if (!rows.length) return true;
  assertWritable("insertKvMany");
  if (useDevStore) return insertDevKvMany(rows);
  const { error } = await getSupabase().from(TABLE).insert(rows);
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}


export async function getKv<T = unknown>(key: string): Promise<T | null> {
  if (useDevStore) {
    return getDevKv<T>(key);
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

// قراءة مخزَّنة — للاستعمال **داخل `unstable_cache` حصراً** (انظر
// `getSupabaseCached`): نفس `getKv` لكن عبر عميل بلا `no-store`، لأن
// `no-store` داخل `unstable_cache` يرمي دائماً. مخصصة لقراءات العرض
// غير الحساسة (نصوص الواجهة) — لا تُستعمل لمسارات الحظر/الاشتراك أبداً.
export async function getKvCached<T = unknown>(key: string): Promise<T | null> {
  if (useDevStore) {
    return getDevKv<T>(key);
  }
  const supabase = getSupabaseCached();
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function deleteKv(key: string): Promise<void> {
  if (useDevStore) {
    await deleteDevKv(key);
    return;
  }
  assertWritable("deleteKv");
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) throw error;
}

// إدراج كل المفاتيح المطابقة لبادئة (ترتيب ثابت) — يُستخدم لقوائم المنشورات والملفات.
export async function listKv(prefix: string): Promise<{ key: string; value: unknown }[]> {
  if (useDevStore) {
    return listDevKv(prefix);
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, value")
    .like("key", `${prefix}%`)
    .order("key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ key: row.key as string, value: row.value }));
}

// يسرد مفاتيح بادئة فقط دون تحميل القيم — حاسم للأداء: المتاجر المنشورة
// تحمل صوراً base64 ثقيلة، وسرد المفاتيح وحده يمنع سحب محتوى كل المتجر
// من القاعدة في كل استدعاء (كانت ثغرة توسّع في /api/catalog).
export async function listKvKeys(prefix: string): Promise<string[]> {
  if (useDevStore) {
    return listDevKvKeys(prefix);
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("key")
    .like("key", `${prefix}%`)
    .order("key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => row.key as string);
}

export async function deleteKvMany(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (useDevStore) {
    await deleteDevKvMany(keys);
    return;
  }
  assertWritable("deleteKvMany");
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().in("key", keys);
  if (error) throw error;
}

// زيادة عددية ذرّية لمفتاح قيمته رقماً صرفاً — عبر دالة SQL (RPC).
// تحل مشكلة السباق في نمط «اقرأ←اجمع←اكتب»: زيارتان متزامنتان كانت
// إحداهما تُفقد، فالعديدار ينقص تراكمياً وقد لا يبلغ حده أبداً.
// تعتمد على الدالة bump_kv_num في supabase/0003_atomic_counters.sql —
// إن غابت الدالة (لم تُشغَّل بعد) نُرجع null فيسقط النداء للنمط القديم.
export async function incrementKvNumber(key: string, addend: number): Promise<number | null> {
  if (useDevStore) {
    // وضع التطوير: زيادة محلية بسيطة — التزامن ليس هماً في localhost
    return null;
  }
  assertWritable("incrementKvNumber");
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("bump_kv_num", {
      p_key: key,
      p_addend: addend,
    });
    if (error) return null;
    const n = typeof data === "number" ? data : Number(data);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
