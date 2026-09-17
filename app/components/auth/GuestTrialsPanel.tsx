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
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  converted: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  expired: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  burned: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  deleted: "bg-navy-900/10 text-navy-700 dark:bg-white/10 dark:text-ivory-50/70",
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
    "rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-3" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-navy-900/15 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161b22]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">{tr("adminTrialsPanelTitle")}</h2>
            <p className="text-[11px] text-navy-900/50 dark:text-ivory-50/50">
              {tr("trialPanelSub")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={toggleGeneration}
              disabled={toggling}
              title={genOff ? tr("trialEnableGeneration") : tr("trialDisableGeneration")}
              className={`rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                genOff
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              {genOff ? tr("trialEnableGeneration") : tr("trialDisableGeneration")}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="rounded-full border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 disabled:opacity-50 dark:border-white/15 dark:text-ivory-50"
            >
              {loading ? "…" : tr("adminRefresh")}
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:bg-navy-700"
            >
              {tr("trialClose")}
            </button>
          </div>
        </div>

        {error && (
          <p className="border-b border-red-200 bg-red-50 px-5 py-2 text-[11px] font-bold text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div
          className={`border-b px-5 py-2 text-[11px] font-bold transition ${
            genOff
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-400/10 dark:text-amber-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-500/10 dark:text-emerald-200"
          }`}
        >
          {genOff ? tr("trialGenerationOff") : tr("trialGenerationOn")}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <p className="py-10 text-center text-xs text-navy-900/45 dark:text-ivory-50/45">{tr("adminLoading")}</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-xs text-navy-900/45 dark:text-ivory-50/45">
              {tr("trialNoTrials")}
            </p>
          ) : (
            <div className="grid gap-3">
              {items.map((t) => (
                <div
                  key={t.email}
                  className="grid gap-2 rounded-2xl border border-navy-900/10 p-3 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-navy-900 dark:text-ivory-50" dir="ltr">
                      {t.email}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLS[t.status]}`}>
                      {tr(STATUS_KEYS[t.status] as I18nKey)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-navy-900/60 dark:text-ivory-50/60">
                    <span dir="ltr">📱 {t.whatsapp || "—"}</span>
                    <span dir="ltr">🔗 /p/{t.slug}</span>
                    {t.status === "active" && <span>⏳ {tr("trialRemaining")}: {fmtLeft(t.remainingMs)}</span>}
                    <span>📅 {new Date(t.createdAt).toLocaleDateString("ar-DZ")}</span>
                  </div>

                  {planFor?.email === t.email ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-2 dark:bg-blue-500/10">
                      <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">{tr("adminChoosePlan")}</span>
                      <select
                        value={planFor.plan}
                        onChange={(e) => setPlanFor({ email: t.email, plan: e.target.value })}
                        className="rounded-lg border border-navy-900/15 bg-white px-2 py-1 text-[11px] dark:border-white/15 dark:bg-[#161b22] dark:text-ivory-50"
                      >
                        <option value="basic">basic</option>
                        <option value="pro">pro</option>
                        <option value="gold">gold</option>
                      </select>
                      <button
                        onClick={() => act(t.email, "convert", { plan: planFor.plan })}
                        disabled={busy === t.email}
                        className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
                      >
                        {tr("trialConfirmActivation")}
                      </button>
                      <button onClick={() => setPlanFor(null)} className={`${btn} border border-navy-900/15 dark:border-white/15 dark:text-ivory-50`}>
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
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {tr("trialOpenLink")} ↗
                      </a>
                      <button
                        onClick={() => setPlanFor({ email: t.email, plan: "basic" })}
                        disabled={busy === t.email}
                        className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
                      >
                        {tr("trialAssignPlan")}
                      </button>
                      <button
                        onClick={() => setConfirm({ email: t.email, kind: "burn_now" })}
                        disabled={busy === t.email}
                        className={`${btn} border border-red-500/40 text-red-600 hover:border-red-500`}
                      >
                        {tr("trialBurnNow")}
                      </button>
                      <button
                        onClick={() => setConfirm({ email: t.email, kind: "release_email" })}
                        disabled={busy === t.email}
                        className={`${btn} border border-navy-900/15 text-navy-700 hover:border-navy-500 dark:border-white/15 dark:text-ivory-50`}
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
          <div className="absolute inset-0 z-10 grid place-items-center bg-navy-950/80 p-4">
            <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-red-500/40 bg-white dark:bg-[#161b22]">
              <div className="bg-red-600 px-5 py-3 text-center text-sm font-extrabold text-white">
                {confirm.kind === "burn_now" ? tr("trialConfirmBurnTitle") : tr("trialConfirmReleaseTitle")}
              </div>
              <div className="grid gap-3 p-5">
                <p className="text-xs leading-6 text-navy-800 dark:text-ivory-50/80">
                  {confirm.kind === "burn_now"
                    ? tr("trialConfirmBurnMsg")
                    : tr("trialConfirmReleaseMsg")}
                </p>
                <button
                  onClick={() => act(confirm.email, confirm.kind)}
                  disabled={busy === confirm.email}
                  className="rounded-full bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {tr("trialConfirmBtn")}
                </button>
                <button
                  onClick={() => setConfirm(null)}
                  className="rounded-full border border-navy-900/15 px-4 py-2.5 text-xs font-bold text-navy-700 dark:border-white/15 dark:text-ivory-50"
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
