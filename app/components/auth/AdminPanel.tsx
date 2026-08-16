"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../LocaleProvider";

interface SubRow {
  userId: string;
  plan: string;
  status: string;
  startsAt: string;
  expiresAt: string | null;
  reason: string | null;
  updatedAt: string;
  pages?: number;
  validityUnit?: string | null;
  validityDays?: number | null;
  validityStartsAt?: string | null;
  validityExpiresAt?: string | null;
  remainingDays?: number | null;
}

const statusLabel: Record<string, string> = {
  active: "نشط",
  suspended: "موقوف",
  banned: "محظور",
  expired: "منتهٍ",
};

// يصف نص مدة الصلاحية لكل صف
function validityText(r: SubRow): string {
  if (r.validityUnit == null) return "بلا مدة محددة";
  if (r.validityUnit === "always") return "دائم";
  if (r.validityUnit === "day") {
    const d = typeof r.remainingDays === "number" ? r.remainingDays : null;
    if (d == null) return "محدد بالأيام (انتهت)";
    return `متبقٍ ${d} يوم`;
  }
  return "—";
}

const stInput =
  "w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2 text-xs text-navy-900 outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15";
const stBtnGhost =
  "rounded-lg border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:border-navy-500 hover:text-navy-900";

// نافذة تأكيد منبثقة قبل تنفيذ عملية حسّاسة
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/50 px-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-3xl border border-navy-900/10 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold text-navy-900">{title}</h3>
        <p className="mt-2 text-[12px] leading-6 text-navy-700/80">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className={stBtnGhost} disabled={loading}>
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-500" : "bg-navy-900 hover:bg-navy-700"}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPanel({ email }: { email: string }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── حالة الاحتياط (وضع GitHub Pages + إنذار السعة) ──
  const [bwBytes, setBwBytes] = useState<number | null>(null);
  const [bwWarnBytes, setBwWarnBytes] = useState<number | null>(null);
  const [bwWarning, setBwWarning] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [ghConfigured, setGhConfigured] = useState<boolean | null>(null);

  // حالة نافذة التأكيد: أي زر وأي مستخدم
  const [confirm, setConfirm] = useState<{
    userId: string;
    kind: "suspend" | "ban" | "delete" | "delete_pages" | "unban" | "unban_purge";
  } | null>(null);

  // محرّر الصلاحية المفتوح لكل مستخدم
  const [validityOpen, setValidityOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/subscription", { cache: "no-store" });
      if (res.status === 403) {
        setError("انتهت الجلسة. سجّل الدخول من جديد.");
        setRows([]);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { subscriptions?: SubRow[] };
      setRows(data.subscriptions ?? []);
    } catch {
      setError("تعذّر تحميل الاشتراكات.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadFallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFallback() {
    try {
      const res = await fetch("/api/admin/fallback", { cache: "no-store" });
      if (res.status === 403) return;
      const data = (await res.json().catch(() => ({}))) as {
        bytes?: number;
        warnBytes?: number;
        warning?: boolean;
        fallbackMode?: boolean;
        githubConfigured?: boolean;
      };
      setBwBytes(data.bytes ?? 0);
      setBwWarnBytes(data.warnBytes ?? 0);
      setBwWarning(Boolean(data.warning));
      setFallbackMode(Boolean(data.fallbackMode));
      setGhConfigured(data.githubConfigured ?? null);
    } catch {
      // تجاهل — القسم اختياري
    }
  }

  async function setFallback(action: "enable" | "disable" | "clear_warning") {
    setFallbackBusy(true);
    try {
      const res = await fetch("/api/admin/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          fallbackMode?: boolean;
          warning?: boolean;
          githubConfigured?: boolean;
        };
        if (typeof data.fallbackMode === "boolean") setFallbackMode(data.fallbackMode);
        if (typeof data.warning === "boolean") setBwWarning(data.warning);
        if (action === "clear_warning") setBwWarning(false);
        if (typeof data.githubConfigured === "boolean") setGhConfigured(data.githubConfigured);
        if (action === "enable" || action === "disable") await loadFallback();
      }
    } catch {
      // تجاهل
    } finally {
      setFallbackBusy(false);
    }
  }

  async function applyAction(userId: string, action: "set" | "delete" | "delete_pages" | "unban_purge" | "validity", opts?: { plan?: string; status?: string; reason?: string | null; validityUnit?: string | null; validityDays?: number | null }) {
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...opts }),
      });
      if (res.status === 403) {
        setError("انتهت الجلسة أو غير مصرّح لك.");
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error === "cannot_modify_admin" ? "لا يمكن تعديل حساب المشرف." : "طلب غير صالح.");
        return;
      }
      if (!res.ok) {
        setError("فشل تنفيذ العملية.");
        return;
      }
      await load();
    } catch {
      setError("تعذّر تنفيذ العملية.");
    } finally {
      setBusyId(null);
    }
  }

  // تنفيذ بعد تأكيد النافذة
  function runConfirmed() {
    if (!confirm) return;
    const { userId, kind } = confirm;
    setConfirm(null);
    if (kind === "suspend") {
      applyAction(userId, "set", { status: "suspended", reason: "إيقاف مؤقت من المشرف." });
    } else if (kind === "ban") {
      applyAction(userId, "set", { status: "banned", reason: "حظر من المشرف." });
    } else if (kind === "delete_pages") {
      applyAction(userId, "delete_pages");
    } else if (kind === "unban") {
      // إزالة من قائمة المحظورين + إعادة تفعيل الحساب (دون مسّ المخزون).
      applyAction(userId, "set", { status: "active", reason: null });
    } else if (kind === "unban_purge") {
      // إزالة من القائمة + حذف كامل المخزون والروابط (طلب المستخدم رقم 4).
      applyAction(userId, "unban_purge");
    } else if (kind === "delete") {
      applyAction(userId, "delete");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-navy-700">
        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700">
          {email}
        </span>
        <span className="text-navy-900/50">صلاحية المشرف</span>
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">{error}</p>
      )}

      {/* ── لوحة الاحتياط وإنذار السعة ── */}
      <section className="grid gap-3 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">الاحتياط وإنذار السعة</h2>
          <button onClick={loadFallback} disabled={fallbackBusy} className={stBtnGhost}>
            تحديث
          </button>
        </div>

        {/* شريط السعة */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-navy-700">السعة المستهلكة (Vercel)</span>
            <span className={bwWarning ? "font-bold text-red-600" : "font-semibold text-navy-900/70"}>
              {bwBytes != null && bwWarnBytes != null
                ? `${(bwBytes / 1024 ** 3).toFixed(2)} / ${(bwWarnBytes / 1024 ** 3).toFixed(0)} GB`
                : "—"}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${bwWarning ? "bg-red-500" : "bg-emerald-500"}`}
              style={{
                width: `${
                  bwBytes != null && bwWarnBytes
                    ? Math.min(100, (bwBytes / bwWarnBytes) * 100).toFixed(1)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-[10px] leading-5 text-navy-900/45">
            يُحسب عند كل زيارة لرابط منشور. عند تجاوز 90GB يُفعَّل الإنذار تلقائياً.
          </p>
        </div>

        {/* شارة الإنذار */}
        {bwWarning && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-400/40 bg-red-50 px-3 py-2">
            <span className="text-[11px] font-bold text-red-700">⚠ اقتربت السعة من الحد (90GB)!</span>
            <button
              onClick={() => setFallback("clear_warning")}
              disabled={fallbackBusy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              مسح الإنذار
            </button>
          </div>
        )}

        {/* تبديل وضع الاحتياط */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-900/10 bg-ivory-50 p-3">
          <div>
            <p className="text-[11px] font-bold text-navy-900">وضع الاحتياط (GitHub Pages)</p>
            <p className="text-[10px] leading-5 text-navy-900/45">
              {fallbackMode
                ? "مُفعّل: المنتجات الجديدة تُنشر كصفحات HTML مستقلة على GitHub Pages مع صلاحية أسبوع."
                : "معطّل: كل المنتجات تُنشر على Vercel كالمعتاد."}
            </p>
          </div>
          {fallbackMode ? (
            <button
              onClick={() => setFallback("disable")}
              disabled={fallbackBusy}
              className="rounded-lg bg-navy-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-navy-700 disabled:opacity-60"
            >
              إيقاف الاحتياط
            </button>
          ) : (
            <button
              onClick={() => setFallback("enable")}
              disabled={fallbackBusy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              تفعيل الاحتياط
            </button>
          )}
        </div>

        {/* شارة توضيحية عند التفعيل — الحد التحذيري */}
        {fallbackMode && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2">
              <span className="mt-0.5 text-[11px] font-bold text-amber-700">⚠ مؤقت</span>
              <p className="text-[10px] leading-5 text-amber-800">
                الروابط الجديدة تُنشر على GitHub Pages احتياطياً فقط — تنتهي صلاحيتها بعد أسبوع
                ثم تُحرق تلقائياً وتطلب التجديد من الاستوديو. استخدم هذا الوضع عند الاقتراب من حد
                سعة Vercel (90GB) ولا تبقِه مفعّلاً إلا عند الحاجة.
              </p>
            </div>
            {ghConfigured === false && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-50 px-3 py-2">
                <span className="mt-0.5 text-[11px] font-bold text-red-700">⚠ إعداد ناقص</span>
                <p className="text-[10px] leading-5 text-red-800">
                  الوضع مفعّل لكن GITHUB_TOKEN / GITHUB_REPO غير مضبوطين في .env.local — لن يُرفع
                  أي رابط فعلياً حتى تضيفهما. عد إلى Vercel فوراً أو أضف المتغيرين.
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* قائمة المستخدمين */}
      <section className="grid gap-3 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold">المستخدمون ({rows.length})</h2>
          <button onClick={load} disabled={loading} className={stBtnGhost}>
            {loading ? "…" : "تحديث"}
          </button>
        </div>

        {rows.length === 0 && !loading ? (
          <p className="text-[11px] text-navy-900/45">لا توجد اشتراكات مسجّلة بعد.</p>
        ) : (
          <div className="grid gap-2">
            {rows.map((r) => {
              const isActive = r.status === "active";
              const isBanned = r.status === "banned";
              const isAdminRow = r.userId.toLowerCase() === email.toLowerCase();
              const showValidity = validityOpen === r.userId;
              return (
                <div key={r.userId} className="grid gap-2 rounded-2xl border border-navy-900/10 bg-ivory-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold text-navy-900">{r.userId}</code>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {typeof r.pages === "number" ? `${r.pages} صفحة` : "—"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.status === "active" ? "bg-emerald-100 text-emerald-700" : r.status === "expired" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </div>

                  {/* مدة الصلاحية */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded-full bg-navy-100 px-2 py-0.5 font-bold text-navy-700">
                      صلاحية: {validityText(r)}
                    </span>
                    {!isAdminRow && (
                      <button
                        onClick={() => setValidityOpen(showValidity ? null : r.userId)}
                        className="font-semibold text-navy-500 underline-offset-2 hover:underline"
                      >
                        {showValidity ? "إغلاق" : "تعديل الصلاحية"}
                      </button>
                    )}
                  </div>

                  {/* محرّر الصلاحية */}
                  {showValidity && !isAdminRow && (
                    <ValidityEditor
                      row={r}
                      busy={busyId === r.userId}
                      onSave={async (unit, days) => {
                        await applyAction(r.userId, "validity", { validityUnit: unit, validityDays: days });
                        setValidityOpen(null);
                      }}
                    />
                  )}

                  {/* أزرار التحكم المجمّعة */}
                  {!isAdminRow && (
                    <div className="flex flex-wrap gap-1.5">
                      {isBanned && (
                        <button
                          onClick={() => applyAction(r.userId, "set", { status: "active", reason: null })}
                          disabled={busyId === r.userId}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          إلغاء الحظر
                        </button>
                      )}
                      {!isBanned && !isActive && (
                        <button
                          onClick={() => applyAction(r.userId, "set", { status: "active", reason: null })}
                          disabled={busyId === r.userId}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          تفعيل
                        </button>
                      )}
                      {isActive && (
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "suspend" })}
                          disabled={busyId === r.userId}
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60"
                        >
                          توقيف
                        </button>
                      )}
                      {!isBanned && (
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "ban" })}
                          disabled={busyId === r.userId}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-500 disabled:opacity-60"
                        >
                          حظر
                        </button>
                      )}
                      <button
                        onClick={() => setConfirm({ userId: r.userId, kind: "delete_pages" })}
                        disabled={busyId === r.userId}
                        className="rounded-lg border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:border-amber-500 hover:text-amber-600 disabled:opacity-60"
                      >
                        حذف الصفحات
                      </button>
                      <button
                        onClick={() => setConfirm({ userId: r.userId, kind: "delete" })}
                        disabled={busyId === r.userId}
                        className="rounded-lg border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 transition hover:border-red-500 hover:text-red-600 disabled:opacity-60"
                      >
                        حذف
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── قائمة المحظورين ── */}
      <section className="grid gap-3 rounded-3xl border border-red-300/40 bg-red-50/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-red-800">قائمة المحظورين</h2>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
            {rows.filter((r) => r.status === "banned").length} محظور
          </span>
        </div>

        {rows.filter((r) => r.status === "banned").length === 0 ? (
          <p className="text-[11px] text-navy-900/45">لا يوجد أي حساب محظور حالياً.</p>
        ) : (
          <div className="grid gap-2">
            {rows
              .filter((r) => r.status === "banned")
              .map((r) => {
                const isAdminRow = r.userId.toLowerCase() === email.toLowerCase();
                return (
                  <div key={r.userId} className="grid gap-2 rounded-2xl border border-red-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold text-navy-900">{r.userId}</code>
                      {typeof r.pages === "number" && r.pages > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {r.pages} صفحة
                        </span>
                      )}
                    </div>
                    {r.reason && (
                      <p className="text-[10px] leading-5 text-red-600/80">{r.reason}</p>
                    )}
                    {!isAdminRow && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban" })}
                          disabled={busyId === r.userId}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          إزالة من القائمة
                        </button>
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban_purge" })}
                          disabled={busyId === r.userId}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          حذف المخزون نهائياً
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* نافذة التأكيد */}
      <ConfirmDialog
        open={confirm?.kind === "suspend"}
        title="تأكيد التوقيف"
        message="سيتم إيقاف صفحات هذا المستخدم مؤقتاً عن العمل دون حذف حسابه. يمكنك إعادتها لاحقاً عبر «تفعيل»."
        confirmLabel="توقيف"
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "ban"}
        title="تأكيد الحظر"
        message="سيتم تجميد حساب المستخدم وتعطيله بالكامل: تتوقف جميع صفحاته وروابطه فوراً، ويُمنع أي زبون من الشراء عبر روابطه مع ظهور رسالة حظر واضحة. بياناته تبقى محفوظة ويمكن استرجاعها لاحقاً عبر «إلغاء الحظر». هل أنت متأكد؟"
        confirmLabel="حظر"
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "unban"}
        title="إزالة من قائمة المحظورين"
        message="سيتم إلغاء حظر هذا الحساب وإعادته للعمل بشكل طبيعي (روابطه وصفحاته تعود متاحة). يبقى مخزونه كما هو. هل تريد المتابعة؟"
        confirmLabel="إزالة من القائمة"
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "unban_purge"}
        title="إزالة نهائية + حذف المخزون"
        message="سيتم إزالة هذا الإيميل من قائمة المحظورين وحذف كامل مخزونه من التخزين وكل صفحاته وروابطه نهائياً — تتوقف عن العمل غير قابلة للوصول. لا يمكن التراجع عن حذف المخزون."
        confirmLabel="حذف المخزون نهائياً"
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete_pages"}
        title="تأكيد حذف الصفحات"
        message="سيتم حذف جميع صفحات وروابط هذا المستخدم من قاعدة البيانات نهائياً وتتوقف عن العمل فوراً. يبقى حسابه واشتراكه كما هما. لا يمكن التراجع عن هذه العملية."
        confirmLabel="حذف الصفحات"
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="تأكيد الحذف"
        message="سيتم حذف حساب هذا المستخدم من النظام بشكل كامل. لا يمكن التراجع عن هذه العملية."
        confirmLabel="حذف نهائي"
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

// محرّر مدة الصلاحية — دائم أو عدد أيام (مضافة من الآن)
function ValidityEditor({
  row,
  busy,
  onSave,
}: {
  row: SubRow;
  busy: boolean;
  onSave: (unit: "day" | "always" | null, days: number | null) => void;
}) {
  const [mode, setMode] = useState<string>(row.validityUnit === "always" ? "always" : row.validityUnit === "day" ? "day" : "none");
  const [days, setDays] = useState<string>(row.validityDays ? String(row.validityDays) : "30");

  return (
    <div className="grid gap-2 rounded-xl border border-navy-900/10 bg-white p-3">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {[
          { v: "none", l: "بلا مدة" },
          { v: "day", l: "بالأيام" },
          { v: "always", l: "دائم" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setMode(o.v)}
            className={`rounded-full px-3 py-1 font-bold transition ${mode === o.v ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700 hover:bg-navy-200"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {mode === "day" && (
        <input
          className={stInput}
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
          placeholder="عدد الأيام"
          dir="ltr"
        />
      )}
      <button
        onClick={() => onSave(mode === "none" ? null : (mode as "day" | "always"), mode === "day" ? Math.max(1, Number(days) || 1) : null)}
        disabled={busy}
        className="justify-self-start rounded-full bg-rose-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
      >
        حفظ الصلاحية
      </button>
    </div>
  );
}
