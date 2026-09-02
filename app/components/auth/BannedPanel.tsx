"use client";

// BannedPanel — قائمة المحظورين والموقوفين والمنتهين
// يجلب من /api/admin/subscription ويعرض فقط status === "banned" | "suspended" | "expired"
// يوفّر زر "رفع الحظر" لكل صف (PATCH /api/admin/subscription).

import { useEffect, useState } from "react";

type SubStatus = "active" | "suspended" | "banned" | "expired";
type Plan = "basic" | "pro" | "gold" | "free";

interface SubRow {
  userId: string;
  email?: string;
  plan: Plan;
  status: SubStatus;
  reason?: string | null;
  startsAt?: string;
  expiresAt?: string | null;
  remainingDays?: number | null;
  whatsapp?: string | null;
  storeName?: string | null;
  productCount?: number;
  imageCount?: number;
  pages?: number;
}

const STATUS_LABELS: Record<SubStatus, string> = {
  active: "نشط",
  suspended: "موقوف",
  banned: "محظور",
  expired: "منتهٍ",
};

const STATUS_COLORS: Record<SubStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  suspended: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  banned: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function BannedPanel() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/subscription", { cache: "no-store" });
      if (!res.ok) throw new Error("فشل التحميل");
      const data = (await res.json()) as { subscriptions: SubRow[] };
      // فلترة: المحظورون + الموقوفون + المنتهون فقط
      const filtered = (data.subscriptions ?? []).filter(
        (r) => r.status === "banned" || r.status === "suspended" || r.status === "expired"
      );
      setRows(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ غير معروف");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUnban(userId: string) {
    if (busyId) return;
    if (!confirm("هل تريد رفع الحظر/التعليق عن هذا المستخدم؟")) return;
    setBusyId(userId);
    try {
      // PATCH بـ kind=activate يعيد التفعيل — ثم تنظيف سبب الحظر
      const res = await fetch("/api/admin/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, kind: "activate" }),
      });
      if (!res.ok) throw new Error("فشل رفع الحظر");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setBusyId(null);
    }
  }

  const banned = rows.filter((r) => r.status === "banned");
  const suspended = rows.filter((r) => r.status === "suspended");
  const expired = rows.filter((r) => r.status === "expired");

  return (
    <div className="grid gap-4">
      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="محظورون" value={banned.length} color="rose" icon="🚫" />
        <Stat label="موقوفون" value={suspended.length} color="amber" icon="⏸️" />
        <Stat label="منتهون" value={expired.length} color="gray" icon="⏳" />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-navy-900/60 dark:text-ivory-50/60">
          إجمالي: {rows.length} {rows.length === 1 ? "مستخدم" : "مستخدمين"}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-full border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900 disabled:opacity-50 dark:border-white/15 dark:text-ivory-50 dark:hover:border-navy-400"
        >
          {loading ? "..." : "🔄 تحديث"}
        </button>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-12 text-center text-[11px] text-navy-900/45 dark:text-ivory-50/45">
          جارٍ التحميل...
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
            لا يوجد محظورون أو موقوفون حاليًا
          </p>
          <p className="mt-1 text-[11px] text-emerald-700/70 dark:text-emerald-300/70">
            جميع المستخدمين في حالة نشطة
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <article
              key={r.userId}
              className="liquid-glass liquid-glass--rounded grid gap-2 overflow-hidden rounded-2xl border border-navy-900/10 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-[#11161d]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-900 dark:text-ivory-50" dir="ltr">
                    {r.userId}
                  </p>
                  {r.storeName && (
                    <p className="truncate text-[11px] text-navy-700/70 dark:text-ivory-50/70">
                      متجر: {r.storeName}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <Field label="الخطة" value={r.plan} />
                <Field label="الأيام المتبقية" value={r.remainingDays ?? "—"} />
                <Field label="المنتجات" value={r.productCount ?? 0} />
                <Field label="الصور" value={r.imageCount ?? 0} />
              </div>

              {r.reason && (
                <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                  السبب: {r.reason}
                </p>
              )}

              {r.status !== "expired" && (
                <button
                  type="button"
                  onClick={() => handleUnban(r.userId)}
                  disabled={busyId === r.userId}
                  className="rounded-full bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === r.userId ? "..." : "🔓 رفع الحظر / التفعيل"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: "rose" | "amber" | "gray"; icon: string }) {
  const colors = {
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-500/30 dark:bg-gray-500/10 dark:text-gray-300",
  };
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${colors[color]}`}>
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold sm:text-[11px]">{label}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-navy-900/5 px-2 py-1.5 dark:bg-white/5">
      <p className="text-[10px] font-bold text-navy-700/60 dark:text-ivory-50/60">{label}</p>
      <p className="text-xs font-bold text-navy-900 dark:text-ivory-50">{value}</p>
    </div>
  );
}
