-- ============================================================
-- 0003_atomic_counters.sql — عدّادات ذرّية لجدول kv (البند: موثوقية bandwidth)
-- ------------------------------------------------------------
-- التنفيذ: Supabase Dashboard > SQL Editor > الصق ثم Run (~30 ثانية)
-- الغرض:
--   نمط «اقرأ←اجمع←اكتب» في statsStore يخسر تحديثات تحت التزامن
--   (زيارتان متزامنتان = إحداهما تضيع)، فالعّداد ينقص تراكمياً وقد لا
--   يبلغ حد 3GB الشهري أبداً — أي أن التحول التلقائي لوضع الاحتياط
--   لن يعمل لحظة الحاجة الحقيقية. هذه الدالة تجعل الزيادة ذرّية داخل
--   PostgreSQL نفسه (INSERT ... ON CONFLICT DO UPDATE ... RETURNING).
--
-- الأثر على الكود:
--   kvStore.incrementKvNumber() تستدعيها تلقائياً (rpc bump_kv_num) —
--   قبل تشغيل هذا الملف ترجع null ويسقط الكود للنمط القديم بهدوء.
--   بعد تشغيله تصبح الزيادة ذرّية بلا أي تغيير آخر.
-- ============================================================

create or replace function public.bump_kv_num(p_key text, p_addend numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  insert into public.kv (key, value, updated_at)
  values (p_key, to_jsonb(p_addend), now())
  on conflict (key) do update
    set value = to_jsonb( ((public.kv.value #>> '{}')::numeric) + p_addend ),
        updated_at = now()
  returning (value #>> '{}')::numeric;
$$;

-- security definer + مالك الدالة = postgres ⇒ تتجاوز RLS المفعّل على kv،
-- فتعمل من الخادم (service_role) بينما يبقى العموم مرفوضاً.

-- اختبار سريع بعد التشغيل (اختياري):
--   select public.bump_kv_num('stats/test-atomic', 5);   -- => 5
--   select public.bump_kv_num('stats/test-atomic', 7);   -- => 12
--   delete from public.kv where key = 'stats/test-atomic';
