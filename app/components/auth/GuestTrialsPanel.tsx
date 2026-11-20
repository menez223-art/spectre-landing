"use client";

// نافذة الأدمن المنبثقة — روابط تجربة الڤيست.
//
// تعرض: الإيميل · الواتساب · الرابط · الوقت المتبقي · الحالة
// وإجراءات: **تعيين اشتراك** (مع الخطة) · **حرق فوري** · **تحرير الإيميل/الجهاز/الرقم**
//
// ⚠️ لا يوجد **تمديد زمني** إطلاقاً (قاعدة المالك ١٠): إمّا اشتراك فعلي أو حرق.
// ⚠️ لا تمسّ أي رابط لمشترك حقيقي — روابط الڤيست فقط.

import { useCallback, useEffect, useState } from "react";
import { useAdminLocale } from "./AdminLocale";
import type { I18nKey } from "@/app/lib/i18n";

type Status = "active" | "converted" | "expired" | "burned" | "deleted";

interface TrialItem {
  email: string;
  whatsapp: string;
  slug: string;
  createdAt: string;
  expiresAt: string;
  remainingMs: number;
  status: Status;
}

// تُحسب من دالة الترجمة (لغتنا المستقلة) — لا نصوص صلبة.
const STATUS_KEYS: Record<Status, string> = {
  active: "trialStatusActive",
  converted: "trialStatusConverted",
  expired: "trialStatusExpired",
  burned: "trialStatusBurned",
  deleted: "trialStatusDeleted",
};

const STATUS_CLS: Record<Status, string> = {
  active: "neu-badge--success",
  converted: "neu-badge--primary",
  expired: "neu-badge--warning",
  burned: "neu-badge--danger",
  deleted: "",
};

function fmtLeft(ms: number): string {
  if (ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}س ${m}د` : `${m}د`;
}

export function GuestTrialsPanel({ onClose }: { onClose: () => void }) {
  const { t: tr } = useAdminLocale();
  const [items, setItems] = useState<TrialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ email: string; kind: "burn_now" | "release_email" } | null>(null);
  const [planFor, setPlanFor] = useState<{ email: string; plan: string } | null>(null);
  const [genOff, setGenOff] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/admin/trials", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error === "forbidden" ? tr("trialErrForbidden") : tr("trialErrLoad"));
        setItems([]);
        return;
      }
      setItems(Array.isArray(j.items) ? j.items : []);
      setGenOff(Boolean(j.trialsDisabled));
    } catch {
      setError(tr("trialErrLoad"));
    } finally {
      setLoading(false);
    }
    // tr ثابتة لكل لغة (useCallback في المزوّد) — آمنة كتبعية.
  }, [tr]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(email: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(email);
    setError("");
    try {
      const r = await fetch("/api/admin/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, action, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(
          j.error === "forbidden"
            ? tr("trialErrForbidden")
            : j.error === "not_found"
              ? tr("trialErrNotFound")
              : tr("trialErrAction")
        );
        return;
      }
      await load();
    } catch {
      setError(tr("trialErrAction"));
    } finally {
      setBusy("");
      setConfirm(null);
      setPlanFor(null);
    }
  }

  async function toggleGeneration() {
    if (toggling) return;
    setToggling(true);
    setError("");
    try {
      const r = await fetch("/api/admin/trials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: genOff ? "trials_enable" : "trials_disable" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error === "forbidden" ? tr("trialErrForbidden") : tr("trialErrAction"));
        return;
      }
      setGenOff(Boolean(j.trialsDisabled));
    } catch {
      setError(tr("trialErrAction"));
    } finally {
      setToggling(false);
    }
  }

  const btn =
    "neu-btn !rounded-full !px-3 !py-1.5 !text-[11px]";

  return (
    <div className="neu-app fixed inset-0 z-50 grid place-items-center !bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-3" role="dialog" aria-modal="true">
      <div className="neu-card flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">{tr("adminTrialsPanelTitle")}</h2>
            <p className="text-[11px] t-muted">
              {tr("trialPanelSub")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleGeneration}
              disabled={toggling}
              title={genOff ? tr("trialEnableGeneration") : tr("trialDisableGeneration")}
              className={`neu-btn !rounded-full !px-4 !py-2 !text-xs ${
                genOff
                  ? "neu-btn--success"
                  : "neu-btn--warning"
              }`}
            >
              {genOff ? tr("trialEnableGeneration") : tr("trialDisableGeneration")}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="neu-btn neu-btn--muted !rounded-full !px-4 !py-2 !text-xs"
            >
              {loading ? "…" : tr("adminRefresh")}
            </button>
            <button
              onClick={onClose}
              className="neu-btn !rounded-full !px-4 !py-2 !text-xs"
            >
              {tr("trialClose")}
            </button>
          </div>
        </div>

        {error && (
          <p className="border-b border-[color:color-mix(in_srgb,var(--danger-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger-color)_8%,var(--bg-color))] px-5 py-2 text-[11px] font-bold t-danger">
            {error}
          </p>
        )}

        <div
          className={`border-b px-5 py-2 text-[11px] font-bold ${
            genOff
              ? "border-[color:color-mix(in_srgb,var(--warning-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning-color)_8%,var(--bg-color))] t-warning"
              : "border-[color:color-mix(in_srgb,var(--success-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--success-color)_8%,var(--bg-color))] t-success"
          }`}
        >
          {genOff ? tr("trialGenerationOff") : tr("trialGenerationOn")}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <p className="py-10 text-center text-xs t-muted">{tr("adminLoading")}</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-xs t-muted">
              {tr("trialNoTrials")}
            </p>
          ) : (
            <div className="grid gap-3">
              {items.map((t) => (
                <div
                  key={t.email}
                  className="neu-row grid gap-2 !p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold" dir="ltr">
                      {t.email}
                    </span>
                    <span className={`neu-badge !px-2.5 !py-1 !text-[10px] ${STATUS_CLS[t.status]}`}>
                      {tr(STATUS_KEYS[t.status] as I18nKey)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] t-muted">
                    <span dir="ltr"><i className="fa-solid fa-phone" aria-hidden="true" /> {t.whatsapp || "—"}</span>
                    <span dir="ltr"><i className="fa-solid fa-link" aria-hidden="true" /> /p/{t.slug}</span>
                    {t.status === "active" && <span><i className="fa-solid fa-clock" aria-hidden="true" /> {tr("trialRemaining")}: {fmtLeft(t.remainingMs)}</span>}
                    <span><i className="fa-solid fa-calendar-days" aria-hidden="true" /> {new Date(t.createdAt).toLocaleDateString("ar-DZ")}</span>
                  </div>

                  {planFor?.email === t.email ? (
                    <div className="neu-inset flex flex-wrap items-center gap-2 !p-2">
                      <span className="text-[11px] font-bold t-primary">{tr("adminChoosePlan")}</span>
                      <select
                        value={planFor.plan}
                        onChange={(e) => setPlanFor({ email: t.email, plan: e.target.value })}
                        className="neu-input !w-auto ![appearance:auto] !px-2 !py-1 !text-[11px]"
                      >
                        <option value="basic">basic</option>
                        <option value="pro">pro</option>
                        <option value="gold">gold</option>
                      </select>
                      <button
                        onClick={() => act(t.email, "convert", { plan: planFor.plan })}
                        disabled={busy === t.email}
                        className={`${btn}`}
                      >
                        {tr("trialConfirmActivation")}
                      </button>
                      <button onClick={() => setPlanFor(null)} className={`${btn} neu-btn--muted`}>
                        {tr("trialCancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/p/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        // الروابط المحروقة/المحذوفة لم تعد موجودة → لا فائدة من فتحها.
                        aria-disabled={t.status === "burned" || t.status === "deleted"}
                        className={`${btn} ${
                          t.status === "burned" || t.status === "deleted"
                            ? "pointer-events-none opacity-40"
                            : "neu-btn--success"
                        }`}
                      >
                        {tr("trialOpenLink")} <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                      </a>
                      <button
                        onClick={() => setPlanFor({ email: t.email, plan: "basic" })}
                        disabled={busy === t.email}
                        className={`${btn}`}
                      >
                        {tr("trialAssignPlan")}
                      </button>
                      <button
                        onClick={() => setConfirm({ email: t.email, kind: "burn_now" })}
                        disabled={busy === t.email}
                        className={`${btn} neu-btn--danger`}
                      >
                        {tr("trialBurnNow")}
                      </button>
                      <button
                        onClick={() => setConfirm({ email: t.email, kind: "release_email" })}
                        disabled={busy === t.email}
                        className={`${btn} neu-btn--muted`}
                      >
                        {tr("trialReleaseEmail")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {confirm && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-4">
            <div className="neu-card w-full max-w-sm overflow-hidden">
              <div className="px-5 py-3 text-center text-sm font-extrabold t-danger">
                {confirm.kind === "burn_now" ? tr("trialConfirmBurnTitle") : tr("trialConfirmReleaseTitle")}
              </div>
              <div className="grid gap-3 p-5">
                <p className="text-xs leading-6 t-muted">
                  {confirm.kind === "burn_now"
                    ? tr("trialConfirmBurnMsg")
                    : tr("trialConfirmReleaseMsg")}
                </p>
                <button
                  onClick={() => act(confirm.email, confirm.kind)}
                  disabled={busy === confirm.email}
                  className="neu-btn neu-btn--danger !rounded-full !px-4 !py-2.5 !text-xs"
                >
                  {tr("trialConfirmBtn")}
                </button>
                <button
                  onClick={() => setConfirm(null)}
                  className="neu-btn neu-btn--muted !rounded-full !px-4 !py-2.5 !text-xs"
                >
                  {tr("trialRevertBtn")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
