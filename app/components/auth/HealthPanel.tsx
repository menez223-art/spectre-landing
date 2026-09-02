"use client";

// HealthPanel — فحص روابط المنتجات المنشورة
// يستدعي /api/admin/link-health لعرض حالة كل رابط (200 = صحي، error = ميت)
// يعرض الإحصائيات التاريخية + زر "فحص الآن" (manual trigger)
// احتراماً لبروتوكول الحظر: لا يلامس KV، قراءة فقط.

import { useEffect, useState } from "react";

type HealthEntry = {
  slug: string;
  status: number | "error";
  ok: boolean;
  lastChecked?: string;
  host?: string;
};

export function HealthPanel() {
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/link-health", { cache: "no-store" });
      if (!res.ok) {
        // الأدمن فقط — قد لا يكون مصرحاً له في dev
        setError("لا يمكن الوصول (قد تحتاج تسجيل دخول كأدمن)");
        return;
      }
      const data = (await res.json()) as { entries?: HealthEntry[]; lastRun?: string };
      setEntries(data.entries ?? []);
      setLastRun(data.lastRun ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRunNow() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/admin/link-health?action=auto", { method: "POST", cache: "no-store" });
      await load();
    } finally {
      setLoading(false);
    }
  }

  const okCount = entries.filter((e) => e.ok).length;
  const errorCount = entries.length - okCount;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Stat label="روابط سليمة" value={okCount} color="emerald" icon="✅" />
        <Stat label="روابط معطلة" value={errorCount} color="rose" icon="❌" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-navy-700/60 dark:text-ivory-50/60">
          {lastRun ? `آخر فحص: ${new Date(lastRun).toLocaleString("ar-DZ")}` : "لم يتم الفحص بعد"}
        </p>
        <button
          type="button"
          onClick={handleRunNow}
          disabled={loading}
          className="rounded-full bg-blue-600 px-4 py-2 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "🔍 فحص الآن"}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {error}
        </p>
      )}

      {entries.length === 0 && !loading ? (
        <div className="rounded-2xl border border-navy-900/10 bg-white p-8 text-center dark:border-white/10 dark:bg-[#11161d]">
          <p className="text-3xl">🔗</p>
          <p className="mt-2 text-sm font-bold">لا توجد روابط للفحص</p>
          <p className="mt-1 text-[11px] text-navy-700/60 dark:text-ivory-50/60">
            انشر منتجًا أولاً ثم ارجع هنا
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => (
            <a
              key={e.slug}
              href={`/p/${e.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-900/10 bg-white p-3 transition hover:border-blue-500 hover:bg-blue-50 dark:border-white/10 dark:bg-[#11161d] dark:hover:border-blue-400 dark:hover:bg-blue-500/10"
              title={`فتح /p/${e.slug} في تبويب جديد`}
            >
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                e.ok
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              }`}>
                {e.ok ? "✅ سليم" : `❌ ${e.status}`}
              </span>
              <code className="flex-1 truncate text-xs underline decoration-dotted" dir="ltr">
                /p/{e.slug}
              </code>
              {e.host && (
                <span className="rounded bg-navy-900/5 px-2 py-0.5 text-[10px] dark:bg-white/5">
                  host: {e.host}
                </span>
              )}
              <span aria-hidden className="text-blue-600 dark:text-blue-400">👁</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: "emerald" | "rose"; icon: string }) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  };
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${colors[color]}`}>
      <p className="text-2xl">{icon}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold sm:text-[11px]">{label}</p>
    </div>
  );
}
