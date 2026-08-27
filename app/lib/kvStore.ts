// تخزين مفتاح/قيمة (KV) فوق Supabase Postgres — server only
// يحلّ محل Vercel Blob بطبقة موحّدة: كل سجل = صف في جدول `kv` بمعرّف نصي فريد.
// القراءة/الكتابة/الحذف/الإدراج بالبادئة كلها تتم هنا، فتبقى بقية الملفات
// بسيطة ولا تعرف تفاصيل قاعدة البيانات.

import { getSupabase, hasSupabase } from "./supabase";

const TABLE = "kv";

export function hasKvStore(): boolean {
  return hasSupabase();
}

export async function setKv(key: string, value: unknown): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(TABLE)
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function getKv<T = unknown>(key: string): Promise<T | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function deleteKv(key: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) throw error;
}

// إدراج كل المفاتيح المطابقة لبادئة (ترتيب ثابت) — يُستخدم لقوائم المنشورات والملفات.
export async function listKv(prefix: string): Promise<{ key: string; value: unknown }[]> {
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
