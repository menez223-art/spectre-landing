"use client";

import { useEffect, useState, useMemo } from "react";
import { useLocale } from "../LocaleProvider";
import type { Plan, Subscription, SubStatus, ValidityUnit } from "@/app/lib/subsStore";

// ── الأنواع ──
interface SubRow extends Subscription {
  pages?: number;
  remainingDays?: number | null;
  storeName?: string | null; // الاسم الودّي الذي اختاره صاحب المتجر (اختياري)
  whatsapp?: string | null; // رقم واتساب استلام الطلبات — للتواصل السريع
}

// صفّ منتج في قسم إشراف المتجر (من /api/admin/products)
interface ProductRow {
  slug: string;
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  badge: string | null;
  eyebrow: string | null;
  owner: string | null;
  listed: boolean;
  hidden: boolean;
  banned: boolean;
}

interface Stats {
  total: number;
  active: number;
  suspended: number;
  banned: number;
  expired: number;
  byPlan: { basic: number; pro: number; gold: number };
  revenue: number;
  expiringSoon: number;
}

// ── الثوابت ──
const PLAN_LABELS: Record<Plan, string> = {
  basic: "أساسي",
  pro: "متقدم",
  gold: "الذهبية",
};

const PLAN_PRICES: Record<Plan, number> = {
  basic: 2000,
  pro: 4000,
  gold: 6000,
};

const STATUS_LABELS: Record<SubStatus, string> = {
  active: "نشط",
  suspended: "موقوف",
  banned: "محظور",
  expired: "منتهٍ",
};

// ── نظام الألوان حسب الخطة ──
const PLAN_COLORS: Record<Plan, { bg: string; border: string; text: string; badge: string }> = {
  basic: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  pro: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-300",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  gold: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

const STATUS_COLORS: Record<SubStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  suspended: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  banned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

// ── أيقونات SVG مدمجة ──
const Icons: Record<string, React.FC<{ className?: string }>> = {
  Search: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Refresh: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  More: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  ),
  Users: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
    </svg>
  ),
  Money: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Chart: ({ className = "w-5 h-5" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Warning: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Bell: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  Clock: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Box: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Image: ({ className = "w-4 h-4" }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};
// ── مكونات واجهة مشتركة ──
const stInput =
  "w-full rounded-lg border border-navy-900/15 bg-white dark:bg-navy-800 px-3 py-2 text-[16px] text-navy-900 dark:text-white outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm";
const stBtnGhost =
  "rounded-lg border border-navy-900/15 px-3 py-1.5 text-[11px] font-bold text-navy-700 dark:text-navy-300 transition hover:border-navy-500 hover:text-navy-900 dark:hover:text-white";
const stBtnPrimary =
  "rounded-lg bg-navy-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-navy-700 disabled:opacity-60";
const stBtnDanger =
  "rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-red-500 disabled:opacity-60";
const stBtnSuccess =
  "rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60";
const stBtnWarning =
  "rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-60";

// نافذة تأكيد منبثقة
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="liquid-glass liquid-glass--rounded w-full max-w-sm overflow-hidden rounded-2xl p-4 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold text-navy-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-[12px] leading-6 text-navy-700/80 dark:text-navy-300/80">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className={stBtnGhost} disabled={loading}>
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-500" : "bg-navy-900 hover:bg-navy-700"
            }`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── نافذة تعديل منتج (إشراف المتجر) ──
function ProductEditModal({
  product,
  busy,
  onSave,
  onClose,
}: {
  product: ProductRow;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [oldPrice, setOldPrice] = useState(product.oldPrice != null ? String(product.oldPrice) : "");
  const [badge, setBadge] = useState(product.badge ?? "");
  const [eyebrow, setEyebrow] = useState(product.eyebrow ?? "");

  function submit() {
    const p = Number(price);
    const op = oldPrice.trim() === "" ? null : Number(oldPrice);
    onSave({
      name: name.trim() || product.name,
      price: Number.isFinite(p) ? p : product.price,
      oldPrice: op === null ? null : Number.isFinite(op) ? op : null,
      badge: badge.trim() === "" ? null : badge.trim(),
      eyebrow: eyebrow.trim() === "" ? null : eyebrow.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="liquid-glass liquid-glass--rounded w-full max-w-md overflow-hidden rounded-2xl p-4 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-base font-bold text-navy-900 dark:text-white">تعديل المنتج</h3>
        <p className="mt-1 text-[11px] text-navy-900/45 dark:text-navy-300/45">
          يُطبَّق التعديل على الصفحة المنشورة فوراً. يبقى الثيم وباقي البيانات كما هي.
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">الاسم</span>
            <input className={stInput} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">السعر (د.ج)</span>
              <input className={stInput} type="number" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">السعر القديم (اختياري)</span>
              <input className={stInput} type="number" dir="ltr" value={oldPrice} onChange={(e) => setOldPrice(e.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">الشارة (Badge)</span>
            <input className={stInput} value={badge} onChange={(e) => setBadge(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold text-navy-700 dark:text-navy-300">العنوان الفرعي (Eyebrow)</span>
            <input className={stInput} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={stBtnGhost} disabled={busy}>
            إلغاء
          </button>
          <button onClick={submit} className={stBtnPrimary} disabled={busy}>
            {busy ? "…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── بطاقة إحصائية ──
function StatCard({ icon: Icon, label, value, color, trend }: { icon: React.FC<{ className?: string }>; label: string; value: string | number; color: string; trend?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${color} dark:border-navy-700`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold opacity-80">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold">{value}</p>
          {trend && <p className="mt-1 text-[10px] font-semibold opacity-90">{trend}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

// ── شريط التقدم للخطة ──
function PlanProgressBar({ current, max, label, color }: { current: number; max: number; label: string; color: string }) {
  const percent = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isOver = current > max;
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-semibold text-navy-900 dark:text-white">{label}</span>
        <span className={`font-bold ${isOver ? "text-red-600 dark:text-red-400" : "text-navy-900/70 dark:text-navy-300/70"}`}>
          {current} / {max} {isOver && "⚠"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-700">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ── بطاقة الاشتراك (Card) ──
function SubscriptionCard({
  row,
  busy,
  onAction,
  onExpand,
  isExpanded,
  isSelected,
  onSelect,
}: {
  row: SubRow;
  busy: boolean;
  onAction: (kind: string, opts?: any) => void;
  onExpand: () => void;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const planColors = PLAN_COLORS[row.plan] || PLAN_COLORS.basic;
  const isActive = row.status === "active";
  const isBanned = row.status === "banned";
  const isAdminRow = row.userId.toLowerCase().includes("admin");
  const remaining = row.remainingDays;
  const hasQuotaExceeded =
    (row.maxProducts && row.pages && row.pages > row.maxProducts) ||
    (row.maxImages && row.pages && row.pages > row.maxImages);

  // حالة محلية للخطة والأيام
  const [editPlan, setEditPlan] = useState(row.plan);
  const [editDays, setEditDays] = useState(remaining?.toString() || "30");
  const [saving, setSaving] = useState(false);

  const handleSaveSubscription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdminRow || saving) return;

    setSaving(true);
    try {
      const days = parseInt(editDays) || 0;
      await onAction("update_subscription", { plan: editPlan, days });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      key={row.userId}
      className={`grid gap-3 rounded-2xl border-2 transition-all ${isSelected ? "ring-2 ring-navy-500" : ""} ${planColors?.border || "border-navy-200 dark:border-navy-700"} ${planColors?.bg || "bg-white dark:bg-navy-800"} p-4 dark:border-opacity-50`}
    >
      {/* Header الصف - اسم المستخدم + checkbox selection */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onSelect(); }}
            className="w-4 h-4 rounded border-navy-900/15 text-navy-500 focus:ring-2 focus:ring-navy-500/20 cursor-pointer"
          />
          <div className="min-w-0 flex-1">
            {row.storeName ? (
              <p className="truncate text-sm font-bold text-navy-900 dark:text-white">🛍️ {row.storeName}</p>
            ) : null}
            <code dir="ltr" className="block min-w-0 truncate text-[11px] font-semibold text-navy-900 dark:text-white">{row.userId}</code>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {row.whatsapp ? (
                <a
                  href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="text-[10px] font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                  title="تواصل سريع عبر واتساب"
                >
                  💬 {row.whatsapp}
                </a>
              ) : null}
              {row.pages !== undefined && (
                <span className="text-[10px] text-navy-900/45 dark:text-navy-300/45">{row.pages} صفحة منشورة</span>
              )}
            </div>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[row.status]}`}>
          {STATUS_LABELS[row.status]}
        </span>
      </div>

      {/* التحكم السريع في الخطة والأيام */}
      {!isAdminRow && (
        <div className="grid gap-2 p-3 rounded-xl bg-navy-50 dark:bg-navy-800/50 border border-navy-900/10 dark:border-navy-700" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-semibold text-navy-700 dark:text-navy-300">الخطة:</label>
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value as Plan)}
              disabled={saving || busy}
              className="rounded-lg border border-navy-900/15 bg-white dark:bg-navy-900 px-3 py-1.5 text-[16px] font-semibold text-navy-900 dark:text-white disabled:opacity-50 sm:text-[11px]"
            >
              <option value="basic">أساسي (2000 د.ج)</option>
              <option value="pro">متقدم (4000 د.ج)</option>
              <option value="gold">الذهبية (6000 د.ج)</option>
            </select>

            <label className="text-[10px] font-semibold text-navy-700 dark:text-navy-300 ml-3">الأيام المتبقية:</label>
            <input
              type="number"
              min="0"
              max="365"
              value={editDays}
              onChange={(e) => setEditDays(e.target.value)}
              disabled={saving || busy}
              className="w-20 rounded-lg border border-navy-900/15 bg-white dark:bg-navy-900 px-3 py-1.5 text-[16px] font-semibold text-navy-900 dark:text-white disabled:opacity-50 sm:text-[11px]"
              placeholder="30"
            />
            <span className="text-[10px] text-navy-700 dark:text-navy-300">يوم</span>

            <button
              onClick={handleSaveSubscription}
              disabled={saving || busy}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-50"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
          <div className="text-[10px] text-navy-600 dark:text-navy-400">
            الخطة الحالية: <strong>{PLAN_LABELS[row.plan]}</strong> • متبقٍ: <strong>{remaining ?? 0} يوم</strong>
          </div>
        </div>
      )}

      {/* Plan Badge + Validity */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${planColors?.badge || "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}>
          {PLAN_LABELS[row.plan]} {PLAN_PRICES[row.plan] > 0 ? `(${PLAN_PRICES[row.plan].toLocaleString()} د.ج)` : ""}
        </span>
        {row.validityUnit && (
          <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold text-navy-700">
            {row.validityUnit === "always" ? "دائم" : `متبقٍ ${remaining ?? 0} يوم`}
          </span>
        )}
        {!row.validityUnit && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            بلا مدة محددة
          </span>
        )}
        {hasQuotaExceeded && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 flex items-center gap-1">
            <Icons.Warning /> تجاوز الحصة
          </span>
        )}
      </div>

      {/* Usage Bars */}
      <div className="grid gap-2">
        <PlanProgressBar
          current={row.pages ?? 0}
          max={row.maxProducts ?? 0}
          label="منتجات"
          color="bg-blue-500"
        />
        <PlanProgressBar
          current={row.pages ?? 0}
          max={row.maxImages ?? 0}
          label="صور"
          color="bg-purple-500"
        />
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className="grid gap-3 pt-2 border-t border-navy-900/10 dark:border-navy-700/50">
          <div className="grid gap-2 text-[11px] text-navy-700 dark:text-navy-300">
            <div className="flex justify-between"><span>بدء الاشتراك</span><span className="font-semibold text-navy-900 dark:text-white">{new Date(row.startsAt).toLocaleDateString("ar-DZ")}</span></div>
            <div className="flex justify-between"><span>آخر تحديث</span><span className="font-semibold text-navy-900 dark:text-white">{new Date(row.updatedAt).toLocaleDateString("ar-DZ")}</span></div>
            {row.expiresAt && (
              <div className="flex justify-between"><span>تاريخ الانتهاء</span><span className="font-semibold text-red-600 dark:text-red-400">{new Date(row.expiresAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.validityStartsAt && (
              <div className="flex justify-between"><span>بداية الصلاحية</span><span className="font-semibold text-navy-900 dark:text-white">{new Date(row.validityStartsAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.validityExpiresAt && (
              <div className="flex justify-between"><span>نهاية الصلاحية</span><span className="font-semibold text-navy-900 dark:text-white">{new Date(row.validityExpiresAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.reason && (
              <div className="flex justify-between"><span>السبب</span><span className="font-semibold text-red-600 dark:text-red-400">{row.reason}</span></div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isAdminRow && !isBanned && isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("suspend"); }}
                disabled={busy}
                className={stBtnWarning}
              >
                إيقاف
              </button>
            )}
            {!isAdminRow && isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("ban"); }}
                disabled={busy}
                className={stBtnDanger}
              >
                حظر
              </button>
            )}
            {!isAdminRow && isBanned && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("unban"); }}
                disabled={busy}
                className={stBtnSuccess}
              >
                إلغاء الحظر
              </button>
            )}
            {!isAdminRow && !isBanned && !isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("activate"); }}
                disabled={busy}
                className={stBtnSuccess}
              >
                تفعيل
              </button>
            )}
            {!isAdminRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("delete_pages"); }}
                disabled={busy}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                حذف الصفحات
              </button>
            )}
            {!isAdminRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("delete"); }}
                disabled={busy}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
              >
                حذف الاشتراك
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chevron */}
      <div className="flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="p-1 text-navy-900/40 hover:text-navy-900 dark:text-navy-300/40 dark:hover:text-white"
        >
          <svg className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}// ── لوحة الإحصائيات المتقدمة ──
function StatsDashboard({ stats }: { stats: Stats }) {
  const total = stats.total || 1;
  const basicPct = Math.round((stats.byPlan.basic / total) * 100);
  const proPct = Math.round((stats.byPlan.pro / total) * 100);
  const goldPct = Math.round((stats.byPlan.gold / total) * 100);

  return (
    <section className="liquid-glass liquid-glass--rounded grid gap-3 overflow-hidden rounded-2xl p-4 sm:gap-4 sm:rounded-3xl sm:p-5">
      <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">📊 ملخص الاشتراكات</h2>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Icons.Users}
          label="إجمالي المشتركين"
          value={stats.total}
          color="bg-navy-50 border-navy-100 text-navy-900 dark:bg-navy-800 dark:text-white"
        />
        <StatCard
          icon={Icons.Money}
          label="الإيرادات الشهرية"
          value={`${stats.revenue.toLocaleString()} د.ج`}
          color="bg-emerald-50 border-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-300"
        />
        <StatCard
          icon={Icons.Chart}
          label="نشط اليوم"
          value={stats.active}
          color="bg-blue-50 border-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300"
        />
        <StatCard
          icon={Icons.Clock}
          label="تنتهي قريباً (7 أيام)"
          value={stats.expiringSoon}
          color="bg-amber-50 border-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300"
        />
      </div>

      {/* توزيع الخطط */}
      <div className="mt-4 grid gap-3">
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold text-blue-600 dark:text-blue-400">أساسي</span>
          <div className="flex-1 h-3 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${basicPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold text-blue-700 dark:text-blue-300">{stats.byPlan.basic} ({basicPct}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold text-purple-600">متقدم</span>
          <div className="flex-1 h-3 rounded-full bg-purple-100 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${proPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold text-purple-700">{stats.byPlan.pro} ({proPct}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold text-amber-600">الذهبية</span>
          <div className="flex-1 h-3 rounded-full bg-amber-100 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${goldPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold text-amber-700">{stats.byPlan.gold} ({goldPct}%)</span>
        </div>
      </div>
    </section>
  );
}

// ── التحذيرات الذكية ──
function SmartWarnings({ rows }: { rows: SubRow[] }) {
  const quotaExceeded = rows.filter((r) =>
    (r.maxProducts && r.pages && r.pages > r.maxProducts) ||
    (r.maxImages && r.pages && r.pages > r.maxImages)
  );

  const expiringSoon = rows.filter((r) => {
    if (!r.validityExpiresAt || r.status !== "active") return false;
    const diff = new Date(r.validityExpiresAt).getTime() - Date.now();
    return diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  });

  const suspendedAuto = rows.filter((r) => r.status === "suspended" && r.reason?.includes("انتهت صلاحية"));

  if (quotaExceeded.length === 0 && expiringSoon.length === 0 && suspendedAuto.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 rounded-3xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5">
      <h2 className="font-display text-base font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <Icons.Warning /> تنبيهات ذكية
      </h2>

      {quotaExceeded.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-white dark:bg-navy-800 p-3">
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
            ⚠️ {quotaExceeded.length} مشترك تجاوز حصته:
          </p>
          <div className="grid gap-1 max-h-32 overflow-auto">
            {quotaExceeded.map((r) => (
              <div key={r.userId} className="text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <code className="font-mono text-navy-900 dark:text-white">{r.userId}</code>
                <span className="text-navy-700 dark:text-navy-300">{r.pages ?? 0}/{r.maxProducts ?? 0} منتج</span>
                <span className="text-navy-700 dark:text-navy-300">{r.pages ?? 0}/{r.maxImages ?? 0} صورة</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-white dark:bg-navy-800 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
              🔔 {expiringSoon.length} اشتراك ينتهي خلال 7 أيام:
            </p>
            <button className={stBtnWarning} disabled>
              تمديد الكل 30 يوم
            </button>
          </div>
          <div className="grid gap-1 max-h-32 overflow-auto">
            {expiringSoon.map((r) => (
              <div key={r.userId} className="text-[10px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <code className="font-mono text-navy-900 dark:text-white">{r.userId}</code>
                <span className="text-navy-700 dark:text-navy-300">متبقٍ {r.remainingDays} يوم</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suspendedAuto.length > 0 && (
        <div className="grid gap-2 rounded-xl border border-red-300/50 dark:border-red-700/50 bg-white dark:bg-navy-800 p-3">
          <p className="text-[11px] font-bold text-red-700 dark:text-red-400">
            🔴 {suspendedAuto.length} مشترك موقوف تلقائياً لانتهاء الصلاحية:
          </p>
          <div className="grid gap-1 max-h-32 overflow-auto">
            {suspendedAuto.map((r) => (
              <div key={r.userId} className="text-[10px] text-red-800 dark:text-red-300 flex items-center justify-between">
                <code className="font-mono text-navy-900 dark:text-white">{r.userId}</code>
                <button className={stBtnSuccess} onClick={() => {}} disabled>
                  تجديد
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── شريط البحث والفلترة ──
function SearchFilterBar({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  planFilter,
  setPlanFilter,
  onRefresh,
  loading,
}: {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: SubStatus | "all";
  setStatusFilter: (v: SubStatus | "all") => void;
  planFilter: Plan | "all";
  setPlanFilter: (v: Plan | "all") => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-900/40 dark:text-navy-300/40" />
        <input
          type="text"
          placeholder="بحث بالبريد أو المعرف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-navy-900/15 bg-white dark:bg-navy-800 text-[16px] text-navy-900 dark:text-white outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as SubStatus | "all")}
        className={stInput}
      >
        <option value="all">كل الحالات</option>
        <option value="active">نشط</option>
        <option value="suspended">موقوف</option>
        <option value="banned">محظور</option>
        <option value="expired">منتهٍ</option>
      </select>
      <select
        value={planFilter}
        onChange={(e) => setPlanFilter(e.target.value as Plan | "all")}
        className={stInput}
      >
        <option value="all">كل الخطط</option>
        <option value="basic">أساسي</option>
        <option value="pro">متقدم</option>
        <option value="gold">الذهبية</option>
      </select>
      <button onClick={onRefresh} disabled={loading} className={stBtnGhost}>
        <Icons.Refresh className="inline mr-1" /> تحديث
      </button>
    </div>
  );
}

export function AdminPanel({ email }: { email: string }) {
  const { t } = useLocale();
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── الفلاتر والتبويبات ──
  const [activeTab, setActiveTab] = useState<Plan | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubStatus | "all">("all");
  const [planFilter, setPlanFilter] = useState<Plan | "all">("all");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "plan">("updated");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── حالة الاحتياط (وضع GitHub Pages + إنذار السعة) ──
  const [bwBytes, setBwBytes] = useState<number | null>(null);
  const [bwWarnBytes, setBwWarnBytes] = useState<number | null>(null);
  const [bwWarning, setBwWarning] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackBusy, setFallbackBusy] = useState(false);
  const [ghConfigured, setGhConfigured] = useState<boolean | null>(null);

  // ── نافذة التأكيد ──
  const [confirm, setConfirm] = useState<{
    userId: string;
    kind: "suspend" | "ban" | "delete" | "delete_pages" | "unban" | "unban_purge" | "activate";
  } | null>(null);

  // ── محرّر الصلاحية ──
  const [validityOpen, setValidityOpen] = useState<string | null>(null);

  // ── رصد صحة الروابط ──
  const [health, setHealth] = useState<{
    checkedAt: string | null;
    total: number;
    ok: number;
    blocked: number;
    error: number;
    entries: { slug: string; status: "ok" | "blocked" | "error"; httpStatus: number; ownerEmail?: string | null }[];
  } | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [notifySlug, setNotifySlug] = useState<string | null>(null);
  const [notifyText, setNotifyText] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── إدارة منتجات المتجر (إشراف) ──
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productsBusy, setProductsBusy] = useState(false);
  const [productBusySlug, setProductBusySlug] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [productDeleteTarget, setProductDeleteTarget] = useState<ProductRow | null>(null);

  // ── الإحصائيات المحسوبة ──
  const stats: Stats = useMemo(() => {
    const total = rows.length;
    const byPlan = { basic: 0, pro: 0, gold: 0 };
    let active = 0, suspended = 0, banned = 0, expired = 0, revenue = 0, expiringSoon = 0;
    rows.forEach((r) => {
      byPlan[r.plan]++;
      if (r.status === "active") active++;
      if (r.status === "suspended") suspended++;
      if (r.status === "banned") banned++;
      if (r.status === "expired") expired++;
      revenue += PLAN_PRICES[r.plan];
      if (r.validityExpiresAt && r.status === "active") {
        const diff = new Date(r.validityExpiresAt).getTime() - Date.now();
        if (diff > 0 && diff <= 7 * 24 * 60 * 60 * 1000) expiringSoon++;
      }
    });
    return { total, active, suspended, banned, expired, byPlan, revenue, expiringSoon };
  }, [rows]);

  // ── الفلترة والترتيب ──
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // فلتر التبويب (الخطة)
    if (activeTab !== "all") {
      result = result.filter((r) => r.plan === activeTab);
    }

    // فلتر الحالة
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // فلتر الخطة (من القائمة المنسدلة)
    if (planFilter !== "all") {
      result = result.filter((r) => r.plan === planFilter);
    }

    // البحث النصي
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.userId.toLowerCase().includes(q)
      );
    }

    // الترتيب
    result.sort((a, b) => {
      if (sortBy === "plan") {
        const order = { basic: 0, pro: 1, gold: 2 };
        return order[a.plan] - order[b.plan];
      }
      if (sortBy === "created") {
        return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [rows, activeTab, statusFilter, planFilter, searchQuery, sortBy]);

  // عدد حسب الخطة للتبويبات
  const tabCounts = useMemo(() => {
    const counts = { all: rows.length, basic: 0, pro: 0, gold: 0 };
    rows.forEach((r) => {
      counts[r.plan]++;
    });
    return counts;
  }, [rows]);

  // صحة الروابط
  async function loadHealth() {
    try {
      const res = await fetch("/api/admin/link-health", { cache: "no-store" });
      if (res.status === 403) return;
      const data = (await res.json().catch(() => ({}))) as { report?: typeof health };
      setHealth(data.report ?? null);
    } catch {
      // تجاهل — القسم اختياري
    }
  }

  async function runHealth() {
    setHealthBusy(true);
    try {
      const res = await fetch("/api/admin/link-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { report?: typeof health };
        setHealth(data.report ?? null);
      }
    } catch {
      // تجاهل
    } finally {
      setHealthBusy(false);
    }
  }

  // منتجات المتجر (إشراف) — قائمة + أفعال edit/hide/unhide عبر /api/admin/products.
  async function loadProducts() {
    setProductsBusy(true);
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) return;
      const data = (await res.json().catch(() => ({}))) as { products?: ProductRow[] };
      setProducts(data.products ?? []);
    } catch {
      // تجاهل — القسم اختياري
    } finally {
      setProductsBusy(false);
    }
  }

  async function applyProductAction(slug: string, action: "hide" | "unhide" | "edit" | "delete", patch?: Record<string, unknown>) {
    setProductBusySlug(slug);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "edit" ? { action, slug, product: patch } : { action, slug }),
      });
      if (res.ok) await loadProducts();
    } catch {
      // تجاهل
    } finally {
      setProductBusySlug(null);
    }
  }

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
    loadHealth();
    loadProducts();
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
      applyAction(userId, "set", { status: "active", reason: null });
    } else if (kind === "unban_purge") {
      applyAction(userId, "unban_purge");
    } else if (kind === "delete") {
      applyAction(userId, "delete");
    } else if (kind === "activate") {
      applyAction(userId, "set", { status: "active", reason: null });
    }
  }

  // معالجات البطاقات
  function handleCardAction(kind: string, userId: string, opts?: { plan?: string; days?: number }) {
    if (kind === "suspend") setConfirm({ userId, kind: "suspend" });
    else if (kind === "ban") setConfirm({ userId, kind: "ban" });
    else if (kind === "delete_pages") setConfirm({ userId, kind: "delete_pages" });
    else if (kind === "unban") setConfirm({ userId, kind: "unban" });
    else if (kind === "activate") applyAction(userId, "set", { status: "active", reason: null });
    else if (kind === "delete") setConfirm({ userId, kind: "delete" });
    else if (kind === "update_subscription") applyUpdateSubscription(userId, opts?.plan, opts?.days);
  }

  // حفظ سريع للخطة + الأيام من بطاقة المستخدم.
  // الأدمن يُدخل عدد الأيام والنظام يحسب تاريخ الانتهاء تلقائياً عبر مسار
  // "validity" (setValidity ⇒ validityExpiresAt = الآن + الأيام). الخطة تُضبط
  // أولاً عبر "set" (الحصص تُشتق من الخطة خادمياً). 0 يوم = إنهاء فوري.
  async function applyUpdateSubscription(userId: string, plan?: string, days?: number) {
    setBusyId(userId);
    setError("");
    try {
      // 1) ضبط الخطة وتفعيل الحساب (الحصص maxProducts/maxImages تُشتق خادمياً)
      const planRes = await fetch("/api/admin/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "set", plan, status: "active", reason: null }),
      });
      if (planRes.status === 400) {
        const b = (await planRes.json().catch(() => ({}))) as { error?: string };
        setError(b.error === "cannot_modify_admin" ? "لا يمكن تعديل حساب المشرف." : "طلب غير صالح.");
        return;
      }
      if (!planRes.ok) {
        setError("فشل تحديث الخطة.");
        return;
      }

      const d = Math.max(0, Math.floor(days ?? 0));
      if (d > 0) {
        // 2) ضبط الأيام → الخادم يحسب تاريخ الانتهاء تلقائياً (ويعيد التفعيل إن كان منتهياً)
        await fetch("/api/admin/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: "validity", validityUnit: "day", validityDays: d }),
        });
      } else {
        // 0 يوم = إنهاء فوري: توقيف مع سبب انتهاء الصلاحية (يحبس الروابط ويمنع الدخول)
        await fetch("/api/admin/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: "set", status: "suspended", reason: "انتهت صلاحية الاشتراك." }),
        });
      }
      await load();
    } catch {
      setError("تعذّر تحديث الاشتراك.");
    } finally {
      setBusyId(null);
    }
  }

  function handleCardExpand(userId: string) {
    setExpandedId((prev) => (prev === userId ? null : userId));
  }

  function handleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === filteredRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.userId)));
    }
  }

  // إجراءات جماعية
  async function handleBulkAction(action: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    if (action === "extend_7") {
      for (const id of ids) {
        const row = rows.find((r) => r.userId === id);
        if (row) {
          const days = (row.validityDays ?? 0) + 7;
          await applyAction(id, "validity", { validityUnit: "day", validityDays: days });
        }
      }
    } else if (action === "extend_30") {
      for (const id of ids) {
        const row = rows.find((r) => r.userId === id);
        if (row) {
          const days = (row.validityDays ?? 0) + 30;
          await applyAction(id, "validity", { validityUnit: "day", validityDays: days });
        }
      }
    } else if (action === "activate") {
      for (const id of ids) {
        await applyAction(id, "set", { status: "active", reason: null });
      }
    } else if (action === "suspend") {
      for (const id of ids) {
        await applyAction(id, "set", { status: "suspended", reason: "إيقاف جماعي من المشرف." });
      }
    }
    setSelectedIds(new Set());
    setExpandedId(null);
    await load();
  }

  // ── ValidityEditor داخل البطاقة الموسعة ──
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
      <div className="grid gap-2 rounded-xl border border-navy-900/10 dark:border-navy-700/50 bg-white dark:bg-navy-800 p-3">
        <div className="flex flex-wrap gap-2 text-[11px]">
          {[
            { v: "none", l: "بلا مدة" },
            { v: "day", l: "بالأيام" },
            { v: "always", l: "دائم" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setMode(o.v)}
              className={`rounded-full px-3 py-1 font-bold transition ${mode === o.v ? "bg-navy-900 text-white" : "bg-navy-100 text-navy-700 hover:bg-navy-200 dark:bg-navy-700 dark:text-navy-300 dark:hover:bg-navy-600"}`}
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
          className="justify-self-start rounded-full bg-rose-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-600 disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          حفظ الصلاحية
        </button>
      </div>
    );
  }

  // ── عرض القسم ──
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-navy-700 dark:text-navy-300 bg-white dark:bg-navy-900 rounded-2xl p-4 shadow-sm">
        <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {email}
        </span>
        <span className="text-navy-900/50 dark:text-navy-300/50">صلاحية المشرف</span>
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/30 dark:border-red-800/30 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-[11px] font-semibold text-red-700 dark:text-red-400">{error}</p>
      )}

      {/* ── لوحة الإحصائيات ── */}
      <StatsDashboard stats={stats} />

      {/* ── التحذيرات الذكية ── */}
      <SmartWarnings rows={rows} />

      {/* ── شريط البحث والفلترة ── */}
      <section className="liquid-glass liquid-glass--rounded overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-5">
        <SearchFilterBar
          search={searchQuery}
          setSearch={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          planFilter={planFilter}
          setPlanFilter={setPlanFilter}
          onRefresh={load}
          loading={loading}
        />

        {/* أزرار التبويبات (Tabs) */}
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {(["all", "basic", "pro", "gold"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => { setActiveTab(tab); setSearchQuery(""); }}
              className={`rounded-full px-4 py-1.5 text-[11px] font-bold transition ${
                activeTab === tab
                  ? "bg-navy-900 text-white"
                  : "bg-navy-50 text-navy-700 hover:bg-navy-100 dark:bg-navy-800 dark:text-navy-300 dark:hover:bg-navy-700"
              }`}
            >
              {tab === "all" ? "الكل" : PLAN_LABELS[tab]} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      </section>

      {/* ── قائمة المستخدمين (Cards) ── */}
      <section className="liquid-glass liquid-glass--rounded grid gap-3 overflow-hidden rounded-2xl p-4 sm:gap-4 sm:rounded-3xl sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">المستخدمون ({filteredRows.length} / {rows.length})</h2>
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "updated" | "created" | "plan")}
              className={stInput}
            >
              <option value="updated">ترتيب: آخر تحديث</option>
              <option value="created">ترتيب: الأقدم</option>
              <option value="plan">ترتيب: حسب الخطة</option>
            </select>
            <button onClick={load} disabled={loading} className={stBtnGhost}>
              {loading ? <Icons.Refresh className="animate-spin w-4 h-4" /> : "تحديث"}
            </button>
          </div>
        </div>

        {/* إجراءات جماعية عند التحديد */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">{selectedIds.size} محدد</span>
            <button onClick={() => handleBulkAction("extend_7")} className={stBtnPrimary} disabled={busyId != null}>تمديد 7 أيام</button>
            <button onClick={() => handleBulkAction("extend_30")} className={stBtnPrimary} disabled={busyId != null}>تمديد 30 يوم</button>
            <button onClick={() => handleBulkAction("activate")} className={stBtnSuccess} disabled={busyId != null}>تفعيل</button>
            <button onClick={() => handleBulkAction("suspend")} className={stBtnWarning} disabled={busyId != null}>إيقاف</button>
            <button onClick={() => setSelectedIds(new Set())} className={stBtnGhost}>إلغاء التحديد</button>
          </div>
        )}

        {filteredRows.length === 0 && !loading ? (
          <p className="text-[11px] text-navy-900/45 dark:text-navy-300/45 text-center py-8">
            لا توجد اشتراكات مطابقة للفلاتر المختارة.
          </p>
        ) : (
          <div className="grid gap-3">
            {filteredRows.map((r) => (
              <SubscriptionCard
                key={r.userId}
                row={r}
                busy={busyId === r.userId}
                onAction={(kind, opts) => handleCardAction(kind, r.userId, opts)}
                onExpand={() => handleCardExpand(r.userId)}
                isExpanded={expandedId === r.userId}
                isSelected={selectedIds.has(r.userId)}
                onSelect={() => handleSelect(r.userId)}
              />
            ))}
          </div>
        )}
      </section>{/* ── قائمة المحظورين ── */}
      <section className="grid gap-3 rounded-3xl border border-red-300/40 dark:border-red-800/40 bg-red-50/40 dark:bg-red-900/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-red-800 dark:text-red-300">قائمة المحظورين</h2>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {rows.filter((r) => r.status === "banned").length} محظور
          </span>
        </div>

        {rows.filter((r) => r.status === "banned").length === 0 ? (
          <p className="text-[11px] text-navy-900/45 dark:text-navy-300/45">لا يوجد أي حساب محظور حالياً.</p>
        ) : (
          <div className="grid gap-2">
            {rows
              .filter((r) => r.status === "banned")
              .map((r) => {
                const isAdminRow = r.userId.toLowerCase() === email.toLowerCase();
                return (
                  <div key={r.userId} className="grid gap-2 rounded-2xl border border-red-200 dark:border-red-800 bg-white dark:bg-navy-800 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold text-navy-900 dark:text-white">{r.userId}</code>
                      {typeof r.pages === "number" && r.pages > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {r.pages} صفحة
                        </span>
                      )}
                    </div>
                    {r.reason && (
                      <p className="text-[10px] leading-5 text-red-600/80 dark:text-red-400/80">{r.reason}</p>
                    )}
                    {!isAdminRow && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban" })}
                          disabled={busyId === r.userId}
                          className={stBtnSuccess}
                        >
                          إزالة من القائمة
                        </button>
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban_purge" })}
                          disabled={busyId === r.userId}
                          className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
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

      {/* ── رصد صحة الروابط ── */}
      <section className="liquid-glass liquid-glass--rounded grid gap-3 overflow-hidden rounded-2xl p-4 sm:gap-4 sm:rounded-3xl sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">رصد صحة الروابط</h2>
          <button onClick={runHealth} disabled={healthBusy} className={stBtnGhost}>
            {healthBusy ? "جارٍ الفحص…" : "فحص الآن"}
          </button>
        </div>

        {!health ? (
          <p className="text-[11px] text-navy-900/45 dark:text-navy-300/45">
            لم يُجرَ فحص بعد. اضغط «فحص الآن» لاختبار كل روابط المستخدمين والتأكد من أنها تعمل دون مشاكل.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">سليمة: {health.ok}</span>
              <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 font-bold text-red-700 dark:text-red-300">محجوبة: {health.blocked}</span>
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 font-bold text-amber-700 dark:text-amber-300">خطأ: {health.error}</span>
              <span className="text-navy-900/45 dark:text-navy-300/45">
                {health.checkedAt ? `آخر فحص: ${new Date(health.checkedAt).toLocaleString("ar-DZ")}` : ""}
              </span>
            </div>

            {health.error > 0 && (
              <p className="rounded-xl border border-amber-300/50 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                ⚠ يوجد {health.error} رابط بها مشكل — راجع القائمة أدناه.
              </p>
            )}

            {health.entries.length > 0 && (
              <div className="grid gap-1.5 max-h-72 overflow-auto">
                {health.entries.map((e) => (
                  <div
                    key={e.slug}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-navy-900/10 dark:border-navy-700/50 bg-ivory-50 dark:bg-navy-800 px-3 py-1.5"
                  >
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold text-navy-900 dark:text-white">
                        /p/{e.slug}
                      </code>
                      {e.ownerEmail && (
                        <span className="text-[10px] text-navy-900/50 dark:text-navy-300/50 font-mono truncate">
                          {e.ownerEmail}
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        e.status === "ok"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : e.status === "blocked"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}
                    >
                      {e.status === "ok" ? "سليمة" : e.status === "blocked" ? "محجوبة" : `خطأ ${e.httpStatus}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── إدارة منتجات المتجر ── */}
      <section className="liquid-glass liquid-glass--rounded grid gap-3 overflow-hidden rounded-2xl p-4 sm:gap-4 sm:rounded-3xl sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">إدارة منتجات المتجر</h2>
          <button onClick={loadProducts} disabled={productsBusy} className={stBtnGhost}>
            {productsBusy ? "جارٍ التحميل…" : "تحديث"}
          </button>
        </div>
        <p className="text-[11px] leading-5 text-navy-900/45 dark:text-navy-300/45">
          تعديل بيانات أي منتج منشور، أو إخفاؤه من المتجر العام. الإخفاء يزيله من المتجر فقط — تبقى صفحته{" "}
          <code dir="ltr">/p/&lt;slug&gt;</code> تعمل بشكل طبيعي.
        </p>

        {products.length === 0 && !productsBusy ? (
          <p className="py-6 text-center text-[11px] text-navy-900/45 dark:text-navy-300/45">لا توجد منتجات منشورة بعد.</p>
        ) : (
          <div className="grid max-h-[32rem] gap-2 overflow-auto">
            {products.map((p) => (
              <div
                key={p.slug}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-navy-900/10 dark:border-navy-700/50 bg-ivory-50 dark:bg-navy-800 p-3"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy-100 dark:bg-navy-700">
                    <Icons.Image />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold text-navy-900 dark:text-white">{p.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-navy-900/50 dark:text-navy-300/50">
                    <span dir="ltr" className="font-semibold">{p.price.toLocaleString()} د.ج</span>
                    {p.owner && <span className="truncate font-mono">{p.owner}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.listed ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">مُدرَج</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-navy-700 dark:text-navy-300">خاص</span>
                  )}
                  {p.hidden && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">مخفي</span>
                  )}
                  {p.banned && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">محظور</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={`/p/${p.slug}`} target="_blank" rel="noopener" className={stBtnGhost}>فتح</a>
                  <button onClick={() => setEditProduct(p)} disabled={productBusySlug === p.slug} className={stBtnPrimary}>تعديل</button>
                  {p.hidden ? (
                    <button onClick={() => applyProductAction(p.slug, "unhide")} disabled={productBusySlug === p.slug} className={stBtnSuccess}>إظهار</button>
                  ) : (
                    <button onClick={() => applyProductAction(p.slug, "hide")} disabled={productBusySlug === p.slug} className={stBtnWarning}>إخفاء</button>
                  )}
                  {/* حذف المنتج نهائياً — لا يمكن التراجع. يظهر بجانب رابط «فتح» مباشرة. */}
                  <button
                    onClick={() => setProductDeleteTarget(p)}
                    disabled={productBusySlug === p.slug}
                    className="rounded-full border border-red-500/40 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 sm:px-4 sm:py-2 sm:text-xs dark:hover:bg-red-500/10"
                    title="حذف المنتج نهائياً"
                    aria-label="حذف المنتج نهائياً"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── نافذة التأكيد ── */}
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

      {/* ── لوحة الاحتياط وإنذار السعة ── */}
      <section className="liquid-glass liquid-glass--rounded grid gap-3 overflow-hidden rounded-2xl p-4 sm:gap-4 sm:rounded-3xl sm:p-5">
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
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
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
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-400/40 bg-red-50 dark:bg-red-900/20 px-3 py-2">
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-900/10 bg-ivory-50 dark:bg-navy-800 p-3">
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
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              <span className="mt-0.5 text-[11px] font-bold text-amber-700">⚠ مؤقت</span>
              <p className="text-[10px] leading-5 text-amber-800">
                الروابط الجديدة تُنشر على GitHub Pages احتياطياً فقط — تنتهي صلاحيتها بعد أسبوع
                ثم تُحرق تلقائياً وتطلب التجديد من الاستوديو. استخدم هذا الوضع عند الاقتراب من حد
                سعة Vercel (90GB) ولا تبقِه مفعّلاً إلا عند الحاجة.
              </p>
            </div>
            {ghConfigured === false && (
              <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-50 dark:bg-red-900/20 px-3 py-2">
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

      {/* ── نافذة تعديل منتج المتجر ── */}
      {editProduct && (
        <ProductEditModal
          product={editProduct}
          busy={productBusySlug === editProduct.slug}
          onSave={(patch) => {
            const slug = editProduct.slug;
            setEditProduct(null);
            applyProductAction(slug, "edit", patch);
          }}
          onClose={() => setEditProduct(null)}
        />
      )}

      {/* ── تأكيد حذف المنتج نهائياً — يطلب موافقة صريحة لأن الفعل لا يمكن التراجع عنه. ── */}
      <ConfirmDialog
        open={productDeleteTarget !== null}
        title="حذف المنتج نهائياً"
        message={
          productDeleteTarget
            ? `سيتم حذف «${productDeleteTarget.name}» (/${productDeleteTarget.slug}) من المتجر وصفحته العامة نهائياً. لا يمكن التراجع عن هذه العملية.`
            : ""
        }
        confirmLabel="حذف نهائي"
        danger
        loading={productBusySlug === productDeleteTarget?.slug}
        onConfirm={async () => {
          if (!productDeleteTarget) return;
          const slug = productDeleteTarget.slug;
          setProductDeleteTarget(null);
          await applyProductAction(slug, "delete");
        }}
        onCancel={() => setProductDeleteTarget(null)}
      />
    </div>
  );
}