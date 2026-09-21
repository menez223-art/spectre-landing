// عميل Supabase (Postgres) — server only
// البديل المجاني والثابت عن Vercel Blob: لا فواتير ولا تعليق تلقائي.
// المتغيرات المطلوبة (بيئة Vercel + .env.local):
//   SUPABASE_URL                — رابط المشروع (مثل https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   — مفتاح service_role (يتجاوز RLS)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // تعطيل كاش fetch في Next.js Data Cache: قراءات Supabase (SELECT) تمرّ
    // عبر fetch التي يكاشفها Next.js افتراضياً (force-cache)، مما يجعل
    // تغييرات الحظر/الاشتراك تظهر متأخرة جداً (أو أبداً) في مسار الحساب
    // والنشر — فيبقى المستخدم المحظور داخل الاستوديو رغم حظره.
    // global: { fetch } يفرض cache: "no-store" على كل طلب صادر من العميل.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return cached;
}

// عميل مخزَّن (cached) — للاستعمال **داخل `unstable_cache` حصراً**.
// ⚠️ لماذا نسخة منفصلة؟ `fetch` بـ`cache: "no-store"` **محظور داخل نطاق
//    `unstable_cache`** في Next.js 14: يرمي خطأً في كل استدعاء، فيُبتلع في
//    `try/catch` القارئ ويُرجَع فراغ دائم (عُلّة «الإعدادات المتقدمة لا تظهر
//    أبداً» — 2026-09-21: الرئيسية كانت تستقبل `overrides` فارغة رغم وجودها
//    في القاعدة، محلياً وعلى الإنتاج معاً). هذه النسخة تستعمل `fetch`
//    الافتراضي فيسمح لها `unstable_cache` بتخزين نتيجتها — وهو المطلوب هنا.
// ⛔ ممنوع خارج `unstable_cache`: أي قراءة حساسة (حظر/اشتراك/أجهزة) تبقى على
//    `getSupabase()` بـ`no-store` كي لا تتجمد حالة أمنية في الكاش أبداً.
let cachedReadable: SupabaseClient | null = null;

export function getSupabaseCached(): SupabaseClient {
  if (cachedReadable) return cachedReadable;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  cachedReadable = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedReadable;
}
