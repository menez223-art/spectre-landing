"use client";

// Hook لمزامنة الاشتراكات فورياً عبر Supabase Realtime
// يستمع لتغييرات مفاتيح `subs/%` في جدول kv ويحدّث حالة الاشتراك محلياً
// يكمل/يحل محل polling الحالي في AuthGate (كل 15-30 ثانية)

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/components/auth/AuthGate";
import { subscribeToKvPrefix, parseSubUserId, hasSupabaseClient } from "@/app/lib/supabase-client";
import type { AccountSubscription } from "@/app/lib/auth";

export function useSubscriptionSync() {
  const { fingerprint, subscription, setSubscription, refreshSubscription } = useAuth();
  const channelRef = useRef<(() => void) | null>(null);
  const fingerprintRef = useRef(fingerprint);
  const subscriptionRef = useRef(subscription);

  // تحديث refs عند تغير القيم
  useEffect(() => {
    fingerprintRef.current = fingerprint;
  }, [fingerprint]);

  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  // دالة لتحديث الاشتراك محلياً من payload Realtime
  const handleRealtimeChange = useCallback(
    (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
      const { eventType, new: newRow, old: oldRow } = payload;
      const key = (newRow?.key ?? oldRow?.key) as string | undefined;
      if (!key) return;

      const userId = parseSubUserId(key);
      if (!userId) return;

      // نحدّث فقط إذا كان الاشتراك يخص المستخدم الحالي
      // (fingerprint الحالي قد يكون مربوطاً بـ email أو device:hash)
      // نتحقق عبر مقارنة userId مع subscription الحالي
      const currentSub = subscriptionRef.current;
      if (!currentSub) return;

      // إذا كان المفتاح يخص مستخدم آخر، نتجاهل
      if (currentSub.userId !== userId) return;

      // DELETE → الاشتراك حُذف (نعتبره غير موجود)
      if (eventType === "DELETE") {
        setSubscription(null);
        return;
      }

      // INSERT/UPDATE → نحدّث بالبيانات الجديدة
      const subData = newRow?.value as Record<string, unknown> | null;
      if (!subData) return;

      setSubscription((prev: AccountSubscription | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...subData,
          // نضمن الحقول المطلوبة
          userId: subData.userId as string,
          plan: subData.plan as string,
          status: subData.status as string,
          expiresAt: (subData.expiresAt as string) ?? null,
          reason: (subData.reason as string) ?? null,
          updatedAt: subData.updatedAt as string,
          validityUnit: (subData.validityUnit as "day" | "always" | null) ?? null,
          validityDays: (subData.validityDays as number) ?? null,
          validityStartsAt: (subData.validityStartsAt as string) ?? null,
          validityExpiresAt: (subData.validityExpiresAt as string) ?? null,
          remainingDays: (subData.remainingDays as number) ?? null,
          notice: (subData.notice as string) ?? null,
        };
      });
    },
    [setSubscription]
  );

  // إنشاء/تنظيف الاشتراك عند تغير fingerprint
  useEffect(() => {
    if (!hasSupabaseClient()) return;
    if (!fingerprintRef.current) return;

    // تنظيف القناة السابقة
    if (channelRef.current) {
      channelRef.current();
      channelRef.current = null;
    }

    // الاشتراك في تغييرات مفاتيح الاشتراكات
    channelRef.current = subscribeToKvPrefix("subs/", handleRealtimeChange);

    // تنظيف عند unmount أو تغير fingerprint
    return () => {
      if (channelRef.current) {
        channelRef.current();
        channelRef.current = null;
      }
    };
  }, [handleRealtimeChange]);

  // نبضة احتياطية (fallback polling) كل 30 ثانية — في حال فشل Realtime
  // أو عند أول تحميل لضمان تزامن أولي
  useEffect(() => {
    if (!fingerprintRef.current) return;
    const id = setInterval(() => {
      refreshSubscription();
    }, 30_000);
    return () => clearInterval(id);
  }, [refreshSubscription]);
}

// دالة مساعدة: تحسب الأيام المتبقية محلياً من validityExpiresAt
// (مستخدمة في SettingsPanel للعرض الحي دون طلب شبكة)
export function computeRemainingDays(validityExpiresAt: string | null | undefined): number | null {
  if (!validityExpiresAt) return null;
  const ve = new Date(validityExpiresAt).getTime();
  const diff = ve - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}