-- مخطط التخزين لـ Spectre — جدول KV واحد على Supabase Postgres
-- يُستخدم عبر app/lib/kvStore.ts بديلاً عن Vercel Blob.
-- شغّل هذا السكربت في: Supabase Dashboard → SQL Editor → Run.

-- جدول المفتاح/القيمة
create table if not exists public.kv (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- فهرس على البادئة (like 'prefix%') لتسريع قوائم المنشورات والملفات.
create index if not exists kv_key_prefix_idx on public.kv (key text_pattern_ops);

-- صلاحيات: نستخدم مفتاح service_role من الخادم فقط، لكن نمنح حقولاً
-- آمنة للقراءة العامة إن رغبت لاحقاً في جعل الصفحات تُقرأ مباشرةً.
-- (لا يُمنح anonymous أي صلاحيات هنا — كل الوصول عبر الخادم.)
