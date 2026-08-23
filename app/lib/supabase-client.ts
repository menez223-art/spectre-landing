// عميل Supabase للعميل (Browser) — يستخدم للـ Realtime فقط
// لا يفوّض صلاحيات service_role — يعتمد على anon key مع RLS
// المتغيرات المطلوبة:
//   NEXT_PUBLIC_SUPABASE_URL        — رابط المشروع
//   NEXT_PUBLIC_SUPABASE_ANON_KEY   — مفتاح anon العام

import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;
let cachedChannel: RealtimeChannel | null = null;

export function hasSupabaseClient(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase client env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return cachedClient;
}

// يشترك في تغييرات جدول kv بمفاتيح تبدأ بـ prefix (مثلاً "subs/")
// callback يُستدعى مع (payload) عند INSERT/UPDATE/DELETE
export function subscribeToKvPrefix(
  prefix: string,
  callback: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => void
): () => void {
  if (!hasSupabaseClient()) {
    return () => {}; // no-op إن لم تكن متغيرات العميل مضبوطة
  }
  const client = getSupabaseClient();
  if (cachedChannel) {
    client.removeChannel(cachedChannel);
  }
  cachedChannel = client
    .channel(`kv-${prefix.replace(/\//g, "-")}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "kv",
        filter: `key=like.${prefix}%`,
      },
      (payload) => {
        callback({
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          new: payload.new as Record<string, unknown> | null,
          old: payload.old as Record<string, unknown> | null,
        });
      }
    )
    .subscribe();
  return () => {
    if (cachedChannel) {
      client.removeChannel(cachedChannel);
      cachedChannel = null;
    }
  };
}

// دالة مساعدة: تستخرج userId من مفتاح الاشتراك (subs/{userId}.json)
export function parseSubUserId(key: string): string | null {
  const match = key.match(/^subs\/(.+)\.json$/);
  return match ? match[1] : null;
}