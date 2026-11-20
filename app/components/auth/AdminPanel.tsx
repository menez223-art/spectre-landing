"use client";

import { useEffect, useState, useMemo } from "react";
import type { Plan, Subscription, SubStatus } from "@/app/lib/subsStore";
import type { I18nKey } from "@/app/lib/i18n";
import { GuestTrialsPanel } from "./GuestTrialsPanel";
import { SiteCopyPanel } from "./SiteCopyPanel";
import { CredentialsPanel } from "./CredentialsPanel";
import { StoragePanel } from "./StoragePanel";
import { useAdminLocale } from "@/app/components/auth/AdminLocale";

// ── الأنواع ──
interface SubRow extends Subscription {
  pages?: number;
  productCount?: number;
  imageCount?: number;
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
// PLAN_LABELS و STATUS_LABELS تُحسب الآن من t() داخل كل مكون.
// نوفّر دوال مساعدة:
type TranslateFn = (key: I18nKey, vars?: Record<string, string | number>) => string;

function planLabel(t: TranslateFn, plan: Plan): string {
  return plan === "basic" ? t("adminPlanBasic") : plan === "pro" ? t("adminPlanPro") : t("adminPlanGold");
}
// سبب التوقيف **بيانات مخزَّنة** — تبقى عربية في القاعدة (لأن الفلترة في
// suspendedAuto تعتمد عليها)، وتُترجَم **للعرض فقط** عبر هذه الخريطة.
// أي سبب غير معروف يُعرض كما هو بلا تغيير.
const REASON_KEYS: Record<string, I18nKey> = {
  "إيقاف مؤقت من المشرف.": "adminReasonSuspended",
  "حظر من المشرف.": "adminReasonBanned",
  "انتهت صلاحية الاشتراك.": "adminReasonExpired",
  "إيقاف جماعي من المشرف.": "adminReasonBulkSuspended",
};
function reasonLabel(t: TranslateFn, reason: string | null | undefined): string {
  if (!reason) return "";
  const k = REASON_KEYS[reason.trim()];
  return k ? t(k) : reason;
}

function statusLabel(t: TranslateFn, status: SubStatus): string {
  return status === "active" ? t("adminStatusActive") : status === "suspended" ? t("adminStatusSuspended") : status === "banned" ? t("adminStatusBanned") : t("adminStatusExpired");
}

const PLAN_PRICES: Record<Plan, number> = {
  basic: 2000,
  pro: 4000,
  gold: 6000,
};

// STATUS_LABELS تُحسب الآن من statusLabel() أعلاه.

// ── نظام الألوان حسب الخطة ──
const PLAN_COLORS: Record<Plan, { bg: string; border: string; text: string; badge: string }> = {
  basic: {
    bg: "",
    border: "",
    text: "",
    badge: "neu-badge--primary",
  },
  pro: {
    bg: "",
    border: "",
    text: "",
    badge: "neu-badge--primary",
  },
  gold: {
    bg: "",
    border: "",
    text: "",
    badge: "neu-badge--primary",
  },
};

const STATUS_COLORS: Record<SubStatus, string> = {
  active: "neu-badge--success",
  suspended: "neu-badge--warning",
  banned: "neu-badge--danger",
  expired: "",
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
// تحسينات الموبايل: min-h-[44px] (معيار اللمس) + touch-manipulation (منع تأخير 300ms)
// أحجام الخطوط: text-xs على الموبايل (12px) ثم text-[11px] على الديسكتوب (أكثر كثافة)
const stInput =
  "neu-input w-full !px-3 !py-2 !text-[16px] sm:!text-sm";
const stBtnGhost =
  "neu-btn neu-btn--muted !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]";
const stBtnPrimary =
  "neu-btn !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]";
const stBtnDanger =
  "neu-btn neu-btn--danger !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]";
const stBtnSuccess =
  "neu-btn neu-btn--success !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]";
const stBtnWarning =
  "neu-btn neu-btn--warning !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]";

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
  // ⚠️ الخطاف **قبل** الإرجاع المبكر — وإلا خالف قواعد الخطافات (rules-of-hooks).
  const { t } = useAdminLocale();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] px-4" onClick={onCancel}>
      <div
        className="neu-card w-full max-w-sm overflow-hidden p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">{title}</h3>
        <p className="mt-2 text-[12px] leading-6 t-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className={stBtnGhost} disabled={loading}>
            {t("adminCancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`neu-btn !px-4 !py-1.5 !text-[11px] ${
              danger ? "neu-btn--danger" : ""
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
  const { t } = useAdminLocale();

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] px-4" onClick={onClose}>
      <div
        className="neu-card w-full max-w-md overflow-hidden p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">{t("adminEditProduct")}</h3>
        <p className="mt-1 text-[11px] t-muted">
          {t("adminEditProductDesc")}
        </p>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold">{t("adminProductName")}</span>
            <input className={stInput} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-bold">{t("adminProductPrice")}</span>
              <input className={stInput} type="number" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-bold">{t("adminProductOldPrice")}</span>
              <input className={stInput} type="number" dir="ltr" value={oldPrice} onChange={(e) => setOldPrice(e.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold">{t("adminProductBadge")}</span>
            <input className={stInput} value={badge} onChange={(e) => setBadge(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold">{t("adminProductEyebrow")}</span>
            <input className={stInput} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={stBtnGhost} disabled={busy}>
            {t("adminCancel")}
          </button>
          <button onClick={submit} className={stBtnPrimary} disabled={busy}>
            {busy ? "…" : t("adminSave")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── بطاقة إحصائية ──
function StatCard({ icon: Icon, label, value, color, trend }: { icon: React.FC<{ className?: string }>; label: string; value: string | number; color: string; trend?: string }) {
  return (
    <div className={`neu-panel p-4 ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-xl font-bold break-words sm:text-2xl">{value}</p>
          {trend && <p className="mt-1 text-[10px] font-semibold opacity-90">{trend}</p>}
        </div>
        <div className="w-10 h-10 shrink-0 rounded-[var(--r-control)] [box-shadow:var(--shadow-inner-sm)] flex items-center justify-center">
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
        <span className="font-semibold">{label}</span>
        <span className={`font-bold ${isOver ? "t-danger" : "t-muted"}`}>
          {current} / {max} {isOver && <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />}
        </span>
      </div>
      <div className="neu-progress !h-2">
        <div
          className={`h-full rounded-full ${isOver ? "bg-[var(--danger-color)]" : color}`}
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
  adminEmail,
}: {
  row: SubRow;
  busy: boolean;
  onAction: (kind: string, opts?: { plan?: Plan; days?: number }) => void;
  onExpand: () => void;
  isExpanded: boolean;
  isSelected: boolean;
  onSelect: () => void;
  adminEmail: string;
}) {
  const planColors = PLAN_COLORS[row.plan] || PLAN_COLORS.basic;
  const { t } = useAdminLocale();
  const isActive = row.status === "active";
  const isBanned = row.status === "banned";
  // مطابقة دقيقة لبريد المشرف فقط — لا أي userId يحوي كلمة "admin".
  const isAdminRow = row.userId.toLowerCase() === (adminEmail || "").toLowerCase();
  const remaining = row.remainingDays;
  const hasQuotaExceeded =
    // فحص عدد الصفحات مقابل maxPages (السقف الأعلى = maxPages للخطة).
    (row.maxPages && row.pages && row.pages > row.maxPages) ||
    // فحص مجموع المنتجات في كل الصفحات مقابل (maxProducts × maxPages).
    (row.maxProducts && row.maxPages && row.productCount !== undefined && row.productCount > row.maxProducts * row.maxPages) ||
    // فحص مجموع الصور في كل الصفحات مقابل (maxImages × maxPages).
    (row.maxImages && row.maxPages && row.imageCount !== undefined && row.imageCount > row.maxImages * row.maxPages);

  // حالة محلية للخطة والأيام
  const [editPlan, setEditPlan] = useState(row.plan);
  const [editDays, setEditDays] = useState(remaining?.toString() || "30");
  const [saving, setSaving] = useState(false);

  const handleSaveSubscription = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdminRow || saving) return;

    // الحفظ على بطاقة محظورة يُفعّل الحساب (ويعيد روابطه المحروقة) تلقائياً
    // على الخادم — يجب أن يكون صريحاً، لا ضمنياً مع تعديل الخطة.
    if (isBanned) {
      if (!window.confirm(t("adminSaveUnbansConfirm"))) return;
    }

    setSaving(true);
    try {
      // حدّ عملي 365 يوم (الخانة لها max لكن القيمة المُدخلة قد تتجاوزه)
      const days = Math.min(365, parseInt(editDays) || 0);
      await onAction("update_subscription", { plan: editPlan, days });
    } finally {
      setSaving(false);
    }
  };

  // مزامنة الحالة المحلية مع الصف بعد كل تحديث خارجي (save جماعي، load)
  // — كانت تبقى قيم الخطة/الأيام القديمة بعد تعديلها من مكان آخر.
  useEffect(() => {
    setEditPlan(row.plan);
    setEditDays(row.remainingDays?.toString() || "30");
  }, [row.plan, row.remainingDays]);

  return (
    <div
      key={row.userId}
      className={`neu-panel grid gap-3 p-4 ${isSelected ? "![box-shadow:var(--shadow-inner-sm)]" : ""} ${planColors?.border || ""} ${planColors?.bg || ""}`}
    >
      {/* Header الصف - اسم المستخدم + checkbox selection */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onSelect(); }}
            className="w-5 h-5 rounded accent-[var(--primary-color)] cursor-pointer touch-manipulation sm:w-4 sm:h-4"
          />
          <div className="min-w-0 flex-1">
            {row.storeName ? (
              <p className="truncate text-sm font-bold"><i className="fa-solid fa-store t-primary" aria-hidden="true" /> {row.storeName}</p>
            ) : null}
            <code dir="ltr" className="block min-w-0 truncate text-[11px] font-semibold">{row.userId}</code>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {row.whatsapp ? (
                <a
                  href={`https://wa.me/${row.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="text-[10px] font-bold t-success hover:underline"
                  title={t("adminWhatsappTip")}
                >
                  <i className="fa-brands fa-whatsapp" aria-hidden="true" /> {row.whatsapp}
                </a>
              ) : null}
              {row.pages !== undefined && (
                <span className="text-[10px] t-muted">{row.pages} {t("adminPages")}</span>
              )}
            </div>
          </div>
        </div>
        <span className={`neu-badge !px-2 !py-0.5 !text-[10px] !font-bold ${STATUS_COLORS[row.status]}`}>
          {statusLabel(t, row.status)}
        </span>
      </div>

      {/* التحكم السريع في الخطة والأيام */}
      {!isAdminRow && (
        <div className="neu-inset grid gap-2 p-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-semibold t-muted">{t("adminPlanColon")}</label>
            <select
              value={editPlan}
              onChange={(e) => setEditPlan(e.target.value as Plan)}
              disabled={saving || busy}
              className="neu-input !w-auto !px-3 !py-2 !text-[16px] font-semibold disabled:opacity-50 min-h-[44px] touch-manipulation sm:min-h-0 sm:!py-1.5 sm:!text-[11px]"
            >
              <option value="basic">{t("adminPlanBasicPrice")}</option>
              <option value="pro">{t("adminPlanProPrice")}</option>
              <option value="gold">{t("adminPlanGoldPrice")}</option>
            </select>

            <label className="text-[10px] font-semibold t-muted ml-3">{t("adminRemainingDays")}</label>
            <input
              type="number"
              min="0"
              max="365"
              value={editDays}
              onChange={(e) => setEditDays(e.target.value)}
              disabled={saving || busy}
              className="neu-input !w-20 !px-3 !py-2 !text-[16px] font-semibold disabled:opacity-50 min-h-[44px] touch-manipulation sm:min-h-0 sm:!py-1.5 sm:!text-[11px]"
              placeholder="30"
            />
            <span className="text-[10px] t-muted">{t("adminDay")}</span>

            <button
              onClick={handleSaveSubscription}
              disabled={saving || busy}
              className="neu-btn neu-btn--success !px-4 !py-1.5 !text-xs disabled:opacity-50 min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
            >
              {saving ? t("adminSaving") : t("adminSave")}
            </button>
          </div>
          <div className="text-[10px] t-muted">
            {t("adminCurrentPlan")}: <strong>{planLabel(t, row.plan)}</strong> • {t("adminRemaining")}: <strong>{remaining ?? 0} {t("adminDay")}</strong>
          </div>
        </div>
      )}

      {/* Plan Badge + Validity */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`neu-badge !px-2 !py-0.5 !text-[10px] !font-bold ${planColors?.badge || "neu-badge--primary"}`}>
          {planLabel(t, row.plan)} {PLAN_PRICES[row.plan] > 0 ? `(${PLAN_PRICES[row.plan].toLocaleString()} ${t("adminCurrency")})` : ""}
        </span>
        {row.validityUnit && (
          <span className="neu-badge !px-2 !py-0.5 !text-[10px] !font-bold">
            {row.validityUnit === "always" ? t("adminPermanent") : `${t("adminRemaining")} ${remaining ?? 0} ${t("adminDay")}`}
          </span>
        )}
        {!row.validityUnit && (
          <span className="neu-badge !px-2 !py-0.5 !text-[10px] !font-bold">
            {t("adminNoValidity")}
          </span>
        )}
        {hasQuotaExceeded && (
          <span className="neu-badge neu-badge--danger !px-2 !py-0.5 !text-[10px] !font-bold !gap-1">
            <Icons.Warning /> {t("adminQuotaExceeded")}
          </span>
        )}
      </div>

      {/* Usage Bars */}
      <div className="grid gap-2">
        <PlanProgressBar
          current={row.pages ?? 0}
          max={row.maxPages ?? 1}
          label={t("adminPagesLabel")}
          color="bg-[var(--primary-color)]"
        />
        <PlanProgressBar
          current={row.productCount ?? 0}
          max={(row.maxProducts ?? 0) * (row.maxPages ?? 1)}
          label={t("adminProductsLabel")}
          color="bg-[var(--primary-color)]"
        />
        <PlanProgressBar
          current={row.imageCount ?? 0}
          max={(row.maxImages ?? 0) * (row.maxPages ?? 1)}
          label={t("adminImagesLabel")}
          color="bg-[var(--primary-color)]"
        />
      </div>

      {/* Expandable Details */}
      {isExpanded && (
        <div className="grid gap-3 pt-2 border-t border-[color-mix(in_srgb,var(--text-muted)_25%,transparent)]">
          <div className="grid gap-2 text-[11px] t-muted">
            <div className="flex justify-between"><span>{t("adminStartSub")}</span><span className="font-semibold">{new Date(row.startsAt).toLocaleDateString("ar-DZ")}</span></div>
            <div className="flex justify-between"><span>{t("adminLastUpdate")}</span><span className="font-semibold">{new Date(row.updatedAt).toLocaleDateString("ar-DZ")}</span></div>
            {row.expiresAt && (
              <div className="flex justify-between"><span>{t("adminExpiryDate")}</span><span className="font-semibold t-danger">{new Date(row.expiresAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.validityStartsAt && (
              <div className="flex justify-between"><span>{t("adminValidityStart")}</span><span className="font-semibold">{new Date(row.validityStartsAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.validityExpiresAt && (
              <div className="flex justify-between"><span>{t("adminValidityEnd")}</span><span className="font-semibold">{new Date(row.validityExpiresAt).toLocaleDateString("ar-DZ")}</span></div>
            )}
            {row.reason && (
              <div className="flex justify-between"><span>{t("adminReason")}</span><span className="font-semibold t-danger">{reasonLabel(t, row.reason)}</span></div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isAdminRow && !isBanned && isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("suspend"); }}
                disabled={busy}
                className={stBtnWarning}
              >
                {t("adminSuspend")}
              </button>
            )}
            {!isAdminRow && isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("ban"); }}
                disabled={busy}
                className={stBtnDanger}
              >
                {t("adminBan")}
              </button>
            )}
            {!isAdminRow && isBanned && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("unban"); }}
                disabled={busy}
                className={stBtnSuccess}
              >
                {t("adminUnban")}
              </button>
            )}
            {!isAdminRow && !isBanned && !isActive && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("activate"); }}
                disabled={busy}
                className={stBtnSuccess}
              >
                {t("adminActivate")}
              </button>
            )}
            {!isAdminRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("delete_pages"); }}
                disabled={busy}
                className="neu-btn neu-btn--warning !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
              >
                {t("adminDeletePages")}
              </button>
            )}
            {!isAdminRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction("delete"); }}
                disabled={busy}
                className="neu-btn neu-btn--danger !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
              >
                {t("adminDeleteSub")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chevron */}
      <div className="flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="neu-circle neu-circle--sm t-muted min-h-[44px] min-w-[44px] touch-manipulation sm:min-h-0 sm:min-w-0"
        >
          <svg className={`w-5 h-5 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}// ── لوحة الإحصائيات المتقدمة ──
function StatsDashboard({ stats }: { stats: Stats }) {
  const { t } = useAdminLocale();
  const total = stats.total || 1;
  const basicPct = Math.round((stats.byPlan.basic / total) * 100);
  const proPct = Math.round((stats.byPlan.pro / total) * 100);
  const goldPct = Math.round((stats.byPlan.gold / total) * 100);

  return (
    <section className="neu-card grid gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5">
      <h2 className="text-base font-bold">{t("adminStatsTitle")}</h2>

      {/* بطاقات الإحصائيات الرئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Icons.Users}
          label={t("adminTotalSubs")}
          value={stats.total}
          color="t-primary"
        />
        <StatCard
          icon={Icons.Money}
          label={t("adminMonthlyRevenue")}
          value={`${stats.revenue.toLocaleString()} ${t("adminCurrency")}`}
          color="t-success"
        />
        <StatCard
          icon={Icons.Chart}
          label={t("adminActiveToday")}
          value={stats.active}
          color="t-primary"
        />
        <StatCard
          icon={Icons.Clock}
          label={t("adminExpiringSoon")}
          value={stats.expiringSoon}
          color="t-warning"
        />
      </div>

      {/* توزيع الخطط */}
      <div className="mt-4 grid gap-3">
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold">{t("adminPlanBasic")}</span>
          <div className="neu-progress flex-1 !h-3">
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: `${basicPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold t-muted">{stats.byPlan.basic} ({basicPct}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold">{t("adminPlanPro")}</span>
          <div className="neu-progress flex-1 !h-3">
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: `${proPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold t-muted">{stats.byPlan.pro} ({proPct}%)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-20 text-[11px] font-semibold">{t("adminPlanGold")}</span>
          <div className="neu-progress flex-1 !h-3">
            <div className="h-full bg-[var(--primary-color)] rounded-full" style={{ width: `${goldPct}%` }} />
          </div>
          <span className="w-14 text-right text-[11px] font-bold t-muted">{stats.byPlan.gold} ({goldPct}%)</span>
        </div>
      </div>
    </section>
  );
}

// ── التحذيرات الذكية ──
function SmartWarnings({ rows }: { rows: SubRow[] }) {
  const { t } = useAdminLocale();
  const quotaExceeded = rows.filter((r) =>
    (r.maxPages && r.pages && r.pages > r.maxPages) ||
    (r.maxProducts && r.maxPages && r.productCount !== undefined && r.productCount > r.maxProducts * r.maxPages) ||
    (r.maxImages && r.maxPages && r.imageCount !== undefined && r.imageCount > r.maxImages * r.maxPages)
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
    <section className="neu-card grid gap-3 p-5">
      <h2 className="text-base font-bold t-warning flex items-center gap-2">
        <Icons.Warning /> {t("adminSmartWarnings")}
      </h2>

      {quotaExceeded.length > 0 && (
        <div className="neu-inset grid gap-2 p-3">
          <p className="text-[11px] font-bold t-warning">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {t("adminQuotaWarn", { count: quotaExceeded.length })}
          </p>
          <div className="grid gap-1 max-h-48 overflow-auto sm:max-h-32">
            {quotaExceeded.map((r) => (
              <div key={r.userId} className="text-[10px] t-muted flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <code className="font-mono min-w-0 truncate">{r.userId}</code>
                <span className="t-muted">{r.pages ?? 0}/{r.maxPages ?? 1} {t("adminPagesLabel")}</span>
                <span className="t-muted">{r.productCount ?? 0}/{(r.maxProducts ?? 0) * (r.maxPages ?? 1)} {t("adminProductsLabel")}</span>
                <span className="t-muted">{r.imageCount ?? 0}/{(r.maxImages ?? 0) * (r.maxPages ?? 1)} {t("adminImagesLabel")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="neu-inset grid gap-2 p-3">
          <p className="text-[11px] font-bold t-warning">
            <i className="fa-solid fa-bell" aria-hidden="true" /> {t("adminExpiringWarn", { count: expiringSoon.length })}
          </p>
          <div className="grid gap-1 max-h-48 overflow-auto sm:max-h-32">
            {expiringSoon.map((r) => (
              <div key={r.userId} className="text-[10px] t-muted flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono min-w-0 truncate">{r.userId}</code>
                <span className="t-muted">{t("adminRemaining")} {r.remainingDays} {t("adminDay")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {suspendedAuto.length > 0 && (
        <div className="neu-inset grid gap-2 p-3">
          <p className="text-[11px] font-bold t-danger">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {t("adminSuspendedAuto", { count: suspendedAuto.length })}
          </p>
          <div className="grid gap-1 max-h-48 overflow-auto sm:max-h-32">
            {suspendedAuto.map((r) => (
              <div key={r.userId} className="text-[10px] t-muted flex flex-wrap items-center justify-between gap-2">
                <code className="font-mono min-w-0 truncate">{r.userId}</code>
                <span>{t("adminRemaining")} {r.remainingDays} {t("adminDay")}</span>
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
  const { t } = useAdminLocale();
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-muted" />
        <input
          type="text"
          placeholder={t("adminSearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="neu-input w-full !pl-10 !pr-3 !py-2 !text-[16px] sm:!text-sm"
        />
      </div>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as SubStatus | "all")}
        className={stInput}
      >
        <option value="all">{t("adminAllStatuses")}</option>
        <option value="active">{t("adminStatusActive")}</option>
        <option value="suspended">{t("adminStatusSuspended")}</option>
        <option value="banned">{t("adminStatusBanned")}</option>
        <option value="expired">{t("adminStatusExpired")}</option>
      </select>
      <select
        value={planFilter}
        onChange={(e) => setPlanFilter(e.target.value as Plan | "all")}
        className={stInput}
      >
        <option value="all">{t("adminAllPlans")}</option>
        <option value="basic">{t("adminPlanBasic")}</option>
        <option value="pro">{t("adminPlanPro")}</option>
        <option value="gold">{t("adminPlanGold")}</option>
      </select>
      <button onClick={onRefresh} disabled={loading} className={`${stBtnGhost} flex items-center justify-center gap-1.5`}>
        <Icons.Refresh className="inline" /> {t("adminRefresh")}
      </button>
    </div>
  );
}

export function AdminPanel({ email }: { email: string }) {
  const { t } = useAdminLocale();
  const [rows, setRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── الفلاتر والتبويبات ──
  const [activeTab, setActiveTab] = useState<Plan | "all">("all");
  // نافذة روابط تجربة الڤيست
  const [showTrials, setShowTrials] = useState(false);
  const [showSiteCopy, setShowSiteCopy] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
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
      // الإيراد يُحتسب فقط للاشتراكات النشطة (المحظور/الموقوف/المنتهي
      // لا يدفع ولا يجب أن يُظهر رقماً منتفخاً).
      if (r.status === "active") revenue += PLAN_PRICES[r.plan];
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

    // البحث النصي — يشمل البريد/المتجر/الواتساب (لا userId فقط)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.userId.toLowerCase().includes(q) ||
          (r.storeName ?? "").toLowerCase().includes(q) ||
          (r.whatsapp ?? "").toLowerCase().includes(q)
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
      if (res.ok) {
        await loadProducts();
      } else {
        // الفشل كان صامتاً تماماً — الأدمن يرى زرّاً لا يفعل شيئاً.
        setError(res.status === 403 ? t("adminErrUnauthorized") : t("adminErrActionFailed"));
      }
    } catch {
      setError(t("adminErrActionError"));
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
        setError(t("adminErrSession"));
        setRows([]);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { subscriptions?: SubRow[] };
      setRows(data.subscriptions ?? []);
    } catch {
      setError(t("adminErrLoadSubs"));
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
          warning?: boolean | string;
          githubConfigured?: boolean;
        };
        // قد تكون warning نصاً (github_not_configured) — كان يُتجاهل لأنه ليس boolean،
        // فلم يعرف الأدمن قط أن تفعيل الاحتياط لا يرفع فعلياً.
        if (data.warning === "github_not_configured") {
          setError(t("adminErrGithubNotConfigured"));
        }
        if (typeof data.fallbackMode === "boolean") setFallbackMode(data.fallbackMode);
        if (typeof data.warning === "boolean") setBwWarning(data.warning);
        if (action === "clear_warning") setBwWarning(false);
        if (typeof data.githubConfigured === "boolean") setGhConfigured(data.githubConfigured);
        if (action === "enable" || action === "disable") await loadFallback();
      } else {
        setError(res.status === 403 ? t("adminErrUnauthorized") : t("adminErrActionFailed"));
      }
    } catch {
      // تجاهل
    } finally {
      setFallbackBusy(false);
    }
  }

  async function applyAction(userId: string, action: "set" | "delete" | "delete_pages" | "unban_purge" | "validity", opts?: { plan?: string; status?: string; reason?: string | null; validityUnit?: string | null; validityDays?: number | null }, reload = true) {
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch("/api/admin/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, ...opts }),
      });
      if (res.status === 403) {
        setError(t("adminErrUnauthorized"));
        return;
      }
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error === "cannot_modify_admin" ? t("adminErrCannotModifyAdmin") : t("adminErrInvalidRequest"));
        return;
      }
      if (!res.ok) {
        setError(t("adminErrActionFailed"));
        return;
      }
      // في الإجراءات الجماعية نُؤجّل إعادة التحميل لنهاية الدفعة (إلا تحميل واحد).
      if (reload) await load();
    } catch {
      setError(t("adminErrActionError"));
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
        setError(b.error === "cannot_modify_admin" ? t("adminErrCannotModifyAdmin") : t("adminErrInvalidRequest"));
        return;
      }
      if (!planRes.ok) {
        setError(t("adminErrPlanUpdate"));
        return;
      }

      const d = Math.max(0, Math.floor(days ?? 0));
      if (d > 0) {
        // 2) ضبط الأيام → الخادم يحسب تاريخ الانتهاء تلقائياً (ويعيد التفعيل إن كان منتهياً)
        const vr = await fetch("/api/admin/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action: "validity", validityUnit: "day", validityDays: d }),
        });
        if (!vr.ok) {
          // الخطة ضُبطت لكن الصلاحية فشلت — نُخبر الأدمن حتى لا يظن أنه اكتمل.
          setError(t("adminErrValidityFailed"));
        }
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
      setError(t("adminErrSubUpdate"));
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

  // إجراءات جماعية
  async function handleBulkAction(action: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // تأكيد قبل أي تعديل جماعي (سبق أن نُفّذت تغييرات بلا عودة).
    const addDays = action === "extend_7" ? 7 : action === "extend_30" ? 30 : 0;
    const verb =
      action === "extend_7" || action === "extend_30"
        ? t("adminBulkExtendConfirm").replace("{n}", String(addDays))
        : action === "activate"
        ? t("adminBulkActivateConfirm")
        : t("adminBulkSuspendConfirm");
    if (!window.confirm(`${verb} (${ids.length} ${t("adminSelected")})`)) return;

    if (addDays > 0) {
      for (const id of ids) {
        const row = rows.find((r) => r.userId === id);
        if (!row) continue;
        // الاشتراك الدائم (always) لا يُمَدَّد: تحويله لأيام كان يدمّر الدوام.
        if (row.validityUnit === "always") continue;
        // ننطلق من الأيام المتبقية فعلاً (remainingDays)، لا من validityDays
        // الذي قد يكون قديماً بعد انتهاء الصلاحية.
        const days = Math.max(0, row.remainingDays ?? 0) + addDays;
        await applyAction(id, "validity", { validityUnit: "day", validityDays: days }, false);
      }
    } else if (action === "activate") {
      for (const id of ids) {
        await applyAction(id, "set", { status: "active", reason: null }, false);
      }
    } else if (action === "suspend") {
      for (const id of ids) {
        await applyAction(id, "set", { status: "suspended", reason: "إيقاف جماعي من المشرف." }, false);
      }
    }
    setSelectedIds(new Set());
    setExpandedId(null);
    await load();
  }

  // ── عرض القسم ──
  return (
    <div className="grid gap-6">
      <div className="neu-row flex items-center gap-2 text-sm font-semibold t-muted">
        <span className="neu-badge neu-badge--primary !px-3 !py-1 !text-[11px] !font-bold">
          {email}
        </span>
        <span className="t-muted">{t("adminAdminAuth")}</span>
      </div>

      {error && (
        <p className="neu-inset px-3 py-2 text-[11px] font-semibold t-danger">{error}</p>
      )}

      {/* ── لوحة الإحصائيات ── */}
      <StatsDashboard stats={stats} />

      {/* ── التحذيرات الذكية ── */}
      <SmartWarnings rows={rows} />

      {/* ── شريط البحث والفلترة ── */}
      <section className="neu-card overflow-hidden p-4 sm:p-5">
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
              className={`neu-tab !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!py-1.5 sm:!text-[11px] ${
                activeTab === tab
                  ? "is-active"
                  : ""
              }`}
            >
              {tab === "all" ? t("adminAll") : planLabel(t, tab)} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      </section>

      {/* ── قائمة المستخدمين (Cards) ── */}
      <section className="neu-card grid gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t("adminUsersHeading", { count: filteredRows.length, total: rows.length })}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "updated" | "created" | "plan")}
              // not stInput: w-full تختنق داخل صف افقي على الموبايل → عرض ذاتي
              className="neu-input !w-auto !px-3 !py-2 !text-[16px] font-semibold sm:!text-sm"
            >
              <option value="updated">{t("adminSortUpdated")}</option>
              <option value="created">{t("adminSortCreated")}</option>
              <option value="plan">{t("adminSortPlan")}</option>
            </select>
            <button
              onClick={() => setShowTrials(true)}
              className="neu-btn neu-btn--warning !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0"
            >
              {t("adminTrialLinks")}
            </button>
            <button
              onClick={() => setShowSiteCopy(true)}
              title={t("siteCopyTitle")}
              className="neu-btn neu-btn--muted !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0"
            >
              <i className="fa-solid fa-gear" aria-hidden="true" /> {t("siteCopyShort")}
            </button>
            <button
              onClick={() => setShowCredentials(true)}
              title={t("credSub")}
              className="neu-btn neu-btn--muted !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0"
            >
              <i className="fa-solid fa-key" aria-hidden="true" /> {t("credTitle")}
            </button>
            <button onClick={load} disabled={loading} className={stBtnGhost}>
              {loading ? <Icons.Refresh className="w-4 h-4" /> : t("adminRefresh")}
            </button>
          </div>
        </div>

        {/* إجراءات جماعية عند التحديد */}
        {selectedIds.size > 0 && (
          <div className="neu-inset flex flex-wrap items-center gap-2 p-3">
            <span className="text-xs font-bold t-primary sm:text-[11px]">{selectedIds.size} {t("adminSelected")}</span>
            <button onClick={() => handleBulkAction("extend_7")} className={stBtnPrimary} disabled={busyId != null}>{t("adminExtend7")}</button>
            <button onClick={() => handleBulkAction("extend_30")} className={stBtnPrimary} disabled={busyId != null}>{t("adminExtend30")}</button>
            <button onClick={() => handleBulkAction("activate")} className={stBtnSuccess} disabled={busyId != null}>{t("adminActivate")}</button>
            <button onClick={() => handleBulkAction("suspend")} className={stBtnWarning} disabled={busyId != null}>{t("adminSuspend")}</button>
            <button onClick={() => setSelectedIds(new Set())} className={stBtnGhost}>{t("adminClearSelection")}</button>
          </div>
        )}

        {filteredRows.length === 0 && !loading ? (
          <p className="text-[11px] t-muted text-center py-8">
            {t("adminNoMatches")}
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
                adminEmail={email}
              />
            ))}
          </div>
        )}
      </section>{/* ── قائمة المحظورين ── */}
      <section className="neu-card grid gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold t-danger">{t("adminBannedList")}</h2>
          <span className="neu-badge neu-badge--danger !px-2 !py-0.5 !text-[10px] !font-bold">
            {rows.filter((r) => r.status === "banned").length} {t("adminBannedCount")}
          </span>
        </div>

        {rows.filter((r) => r.status === "banned").length === 0 ? (
          <p className="text-[11px] t-muted">{t("adminNoBanned")}</p>
        ) : (
          <div className="grid gap-2">
            {rows
              .filter((r) => r.status === "banned")
              .map((r) => {
                const isAdminRow = r.userId.toLowerCase() === email.toLowerCase();
                return (
                  <div key={r.userId} className="neu-row grid gap-2 !p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold">{r.userId}</code>
                      {typeof r.pages === "number" && r.pages > 0 && (
                        <span className="neu-badge neu-badge--warning !px-2 !py-0.5 !text-[10px] !font-bold">
                          {r.pages} {t("adminPageUnit")}
                        </span>
                      )}
                    </div>
                    {r.reason && (
                      <p className="text-[10px] leading-5 t-danger">{reasonLabel(t, r.reason)}</p>
                    )}
                    {!isAdminRow && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban" })}
                          disabled={busyId === r.userId}
                          className={stBtnSuccess}
                        >
                          {t("adminRemoveFromList")}
                        </button>
                        <button
                          onClick={() => setConfirm({ userId: r.userId, kind: "unban_purge" })}
                          disabled={busyId === r.userId}
                          className="neu-btn neu-btn--danger !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
                        >
                          {t("adminDeleteInventory")}
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
      <section className="neu-card grid gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t("adminLinkHealth")}</h2>
          <button onClick={runHealth} disabled={healthBusy} className={stBtnGhost}>
            {healthBusy ? t("adminChecking") : t("adminCheckNow")}
          </button>
        </div>

        {!health ? (
          <p className="text-[11px] t-muted">
            {t("adminNoHealthCheck")}
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="neu-badge neu-badge--success !px-2 !py-0.5 !font-bold">{t("adminHealthy")}: {health.ok}</span>
              <span className="neu-badge neu-badge--danger !px-2 !py-0.5 !font-bold">{t("adminBlocked")}: {health.blocked}</span>
              <span className="neu-badge neu-badge--warning !px-2 !py-0.5 !font-bold">{t("adminError")}: {health.error}</span>
              <span className="t-muted">
                {health.checkedAt ? `${t("adminLastError")}: ${new Date(health.checkedAt).toLocaleString("ar-DZ")}` : ""}
              </span>
            </div>

            {health.error > 0 && (
              <p className="neu-inset px-3 py-2 text-[11px] font-bold t-warning">
                {t("adminHealthErrorCount", { count: health.error })}
              </p>
            )}

            {health.entries.length > 0 && (
              <div className="grid gap-1.5 max-h-[50vh] overflow-auto sm:max-h-72">
                {health.entries.map((e) => (
                  <div
                    key={e.slug}
                    className="neu-row flex flex-wrap items-center justify-between gap-2 !px-3 !py-1.5"
                  >
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] font-semibold">
                        /p/{e.slug}
                      </code>
                      {e.ownerEmail && (
                        <span className="text-[10px] t-muted font-mono truncate">
                          {e.ownerEmail}
                        </span>
                      )}
                    </div>
                    <span
                      className={`neu-badge !px-2 !py-0.5 !text-[10px] !font-bold ${
                        e.status === "ok"
                          ? "neu-badge--success"
                          : e.status === "blocked"
                          ? "neu-badge--danger"
                          : "neu-badge--warning"
                      }`}
                    >
                      {e.status === "ok" ? t("adminHealthy") : e.status === "blocked" ? t("adminBlocked") : `${t("adminError")} ${e.httpStatus}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── إدارة منتجات المتجر ── */}
      <section className="neu-card grid gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t("adminStoreManage")}</h2>
          <button onClick={loadProducts} disabled={productsBusy} className={stBtnGhost}>
            {productsBusy ? t("adminLoading") : t("adminRefresh")}
          </button>
        </div>
        <p className="text-[11px] leading-5 t-muted">
          {t("adminProductDesc")}
        </p>

        {products.length === 0 && !productsBusy ? (
          <p className="py-6 text-center text-[11px] t-muted">{t("adminNoProducts")}</p>
        ) : (
          <div className="grid max-h-[50vh] gap-2 overflow-auto sm:max-h-[32rem]">
            {products.map((p) => (
              <div
                key={p.slug}
                className="neu-row flex flex-wrap items-center gap-3 !p-3"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--r-control)] [box-shadow:var(--shadow-inner-sm)] t-muted">
                    <Icons.Image />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-bold">{p.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] t-muted">
                    <span dir="ltr" className="font-semibold">{p.price.toLocaleString()} {t("adminCurrency")}</span>
                    {p.owner && <span className="truncate font-mono">{p.owner}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.listed ? (
                    <span className="neu-badge neu-badge--success !px-2 !py-0.5 !text-[10px] !font-bold">{t("adminListed")}</span>
                  ) : (
                    <span className="neu-badge !px-2 !py-0.5 !text-[10px] !font-bold">{t("adminPrivate")}</span>
                  )}
                  {p.hidden && (
                    <span className="neu-badge neu-badge--warning !px-2 !py-0.5 !text-[10px] !font-bold">{t("adminHidden")}</span>
                  )}
                  {p.banned && (
                    <span className="neu-badge neu-badge--danger !px-2 !py-0.5 !text-[10px] !font-bold">{t("adminStatusBanned")}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={`/p/${p.slug}`} target="_blank" rel="noopener" className={stBtnGhost} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t("adminOpen")}</a>
                  <button onClick={() => setEditProduct(p)} disabled={productBusySlug === p.slug} className={stBtnPrimary}>{t("adminEdit")}</button>
                  {p.hidden ? (
                    <button onClick={() => applyProductAction(p.slug, "unhide")} disabled={productBusySlug === p.slug} className={stBtnSuccess}>{t("adminShow")}</button>
                  ) : (
                    <button onClick={() => applyProductAction(p.slug, "hide")} disabled={productBusySlug === p.slug} className={stBtnWarning}>{t("adminHide")}</button>
                  )}
                  {/* حذف المنتج نهائياً — لا يمكن التراجع. يظهر بجانب رابط «فتح» مباشرة. */}
                  <button
                    onClick={() => setProductDeleteTarget(p)}
                    disabled={productBusySlug === p.slug}
                    className="neu-circle neu-circle--sm neu-circle--danger min-h-[44px] touch-manipulation sm:min-h-0"
                    title={t("adminDeleteProductTitle")}
                    aria-label={t("adminDeleteProductTitle")}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
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
        title={t("adminConfirmSuspendTitle")}
        message={t("adminConfirmSuspendMsg")}
        confirmLabel={t("adminConfirmSuspendBtn")}
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "ban"}
        title={t("adminConfirmBanTitle")}
        message={t("adminConfirmBanMsg")}
        confirmLabel={t("adminConfirmBanBtn")}
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "unban"}
        title={t("adminConfirmUnbanTitle")}
        message={t("adminConfirmUnbanMsg")}
        confirmLabel={t("adminConfirmUnbanBtn")}
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "unban_purge"}
        title={t("adminConfirmPurgeTitle")}
        message={t("adminConfirmPurgeMsg")}
        confirmLabel={t("adminConfirmPurgeBtn")}
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete_pages"}
        title={t("adminConfirmDeletePagesTitle")}
        message={t("adminConfirmDeletePagesMsg")}
        confirmLabel={t("adminConfirmDeletePagesBtn")}
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title={t("adminConfirmDeleteTitle")}
        message={t("adminConfirmDeleteMsg")}
        confirmLabel={t("adminConfirmDeleteBtn")}
        danger
        loading={busyId != null}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />

      {/* ── لوحة الاحتياط وإنذار السعة ── */}
      <section className="neu-card grid gap-3 overflow-hidden p-4 sm:gap-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">{t("adminFallbackTitle")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowStorage(true)}
              title={t("storSub")}
              className="neu-btn neu-btn--danger !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
            >
              {t("storOpen")}
            </button>
            <button onClick={loadFallback} disabled={fallbackBusy} className={stBtnGhost}>
              {t("adminRefresh")}
            </button>
          </div>
        </div>

        {/* شريط السعة */}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold">{t("adminBandwidthUsed")}</span>
            <span className={bwWarning ? "font-bold t-danger" : "font-semibold t-muted"}>
              {bwBytes != null && bwWarnBytes != null
                ? `${(bwBytes / 1024 ** 3).toFixed(2)} / ${(bwWarnBytes / 1024 ** 3).toFixed(0)} GB`
                : "—"}
            </span>
          </div>
          <div className="neu-progress !h-2.5">
            <div
              className={`h-full rounded-full ${bwWarning ? "bg-[var(--danger-color)]" : "bg-[var(--success-color)]"}`}
              style={{
                width: `${
                  bwBytes != null && bwWarnBytes
                    ? Math.min(100, (bwBytes / bwWarnBytes) * 100).toFixed(1)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-[10px] leading-5 t-muted">
            {t("adminBandwidthNote")}
          </p>
        </div>

        {/* شارة الإنذار */}
        {bwWarning && (
          <div className="neu-inset flex items-center justify-between gap-2 px-3 py-2 t-danger">
            <span className="text-[11px] font-bold t-danger">{t("adminBandwidthWarning")}</span>
            <button
              onClick={() => setFallback("clear_warning")}
              disabled={fallbackBusy}
              className="neu-btn neu-btn--danger !px-3 !py-1.5 !text-[10px]"
            >
              {t("adminClearWarning")}
            </button>
          </div>
        )}

        {/* تبديل وضع الاحتياط */}
        <div className="neu-row flex flex-wrap items-center justify-between gap-2 !p-3">
          <div>
            <p className="text-[11px] font-bold">{t("adminFallbackMode")}</p>
            <p className="text-[10px] leading-5 t-muted">
              {fallbackMode
                ? t("adminFallbackEnabled")
                : t("adminFallbackDisabled")}
            </p>
          </div>
          {fallbackMode ? (
            <button
              onClick={() => setFallback("disable")}
              disabled={fallbackBusy}
              className="neu-btn neu-btn--muted !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
            >
              {t("adminDisableFallback")}
            </button>
          ) : (
            <button
              onClick={() => setFallback("enable")}
              disabled={fallbackBusy}
              className="neu-btn neu-btn--success !px-3 !py-1.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 sm:!text-[11px]"
            >
              {t("adminEnableFallback")}
            </button>
          )}
        </div>

        {/* شارة توضيحية عند التفعيل — الحد التحذيري */}
        {fallbackMode && (
          <>
            <div className="neu-inset flex items-start gap-2 px-3 py-2 t-warning">
              <span className="mt-0.5 text-[11px] font-bold t-warning">{t("adminFallbackTemp")}</span>
              <p className="text-[10px] leading-5 t-muted">
                {t("adminFallbackTempDesc")}
              </p>
            </div>
            {ghConfigured === false && (
              <div className="neu-inset flex items-start gap-2 px-3 py-2 t-danger">
                <span className="mt-0.5 text-[11px] font-bold t-danger">{t("adminFallbackMisconfigured")}</span>
                <p className="text-[10px] leading-5 t-muted">
                  {t("adminFallbackMisconfiguredDesc")}
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
        title={t("adminDeleteProductTitle")}
        message={
          productDeleteTarget
            ? t("adminConfirmDeleteProductMsg", { name: productDeleteTarget.name, slug: productDeleteTarget.slug })
            : ""
        }
        confirmLabel={t("adminConfirmDeleteBtn")}
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

      {/* نافذة روابط تجربة الڤيست */}
      {showTrials && <GuestTrialsPanel onClose={() => setShowTrials(false)} />}
      {showSiteCopy && <SiteCopyPanel onClose={() => setShowSiteCopy(false)} />}
      {showCredentials && <CredentialsPanel onClose={() => setShowCredentials(false)} />}
      {showStorage && <StoragePanel onClose={() => setShowStorage(false)} />}
    </div>
  );
}