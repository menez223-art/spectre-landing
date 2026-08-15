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
