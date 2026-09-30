"use client";

// نافذة الأدمن — «إدارة التخزين».
//
// يختار المالك بحرّية ما يريد حذفه من قاعدة البيانات:
//   • فئات محددة (صفحات / تجارب / اشتراكات / حسابات / إحصاءات / …)
//   • أو الكل (تحديد الكل)
//
// ⚠️ الحذف نهائي ولا يمكن التراجع — لذلك: تأكيد نصي إلزامي + تحذير حسب الخطورة.
// ⚠️ العدّادات تُقرأ عند الفتح (مفاتيح فقط، بلا قيم — خفيف).

import { useCallback, useEffect, useState } from "react";
import { useAdminLocale } from "./AdminLocale";
import type { I18nKey } from "@/app/lib/i18n";

type Danger = "critical" | "high" | "med" | "low";

interface CatInfo {
  id: string;
  danger: Danger;
}

const LABEL_KEYS: Record<string, I18nKey> = {
  pages: "storCatPages",
  trials: "storCatTrials",
  subs: "storCatSubs",
  auth: "storCatAuth",
  stats: "storCatStats",
  limits: "storCatLimits",
  copy: "storCatCopy",
  creds: "storCatCreds",
  flags: "storCatFlags",
};

const DANGER_CLS: Record<Danger, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  med: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-ivory-50/60",
};

export function StoragePanel({ onClose }: { onClose: () => void }) {
  const { t } = useAdminLocale();
  const [cats, setCats] = useState<CatInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/storage", { cache: "no-store" });
      if (!res.ok) {
        setMsg({ ok: false, text: t("storErrLoad") });
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { counts?: Record<string, number>; categories?: CatInfo[] }
        | null;
      setCats(data?.categories ?? []);
      setCounts(data?.counts ?? {});
    } catch {
      setMsg({ ok: false, text: t("storErrLoad") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMsg(null);
  }

  const allSelected = cats.length > 0 && selected.size === cats.length;
  const totalKeys = Array.from(selected).reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  const confirmOk = confirm.trim() === "حذف" || confirm.trim().toUpperCase() === "DELETE";

  async function runDelete() {
    setMsg(null);
    if (selected.size === 0) {
      setMsg({ ok: false, text: t("storErrNone") });
      return;
    }
    if (!confirmOk) {
      setMsg({ ok: false, text: t("storErrConfirm") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: Array.from(selected), confirm: confirm.trim() }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg({
          ok: false,
          text: b.error === "bad_confirm" ? t("storErrConfirm") : t("storErrSave"),
        });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { deleted?: number };
      setMsg({ ok: true, text: `${t("storDone")}: ${data.deleted ?? 0} ${t("storKeysUnit")}` });
      setSelected(new Set());
      setConfirm("");
      await load();
    } catch {
      setMsg({ ok: false, text: t("storErrSave") });
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-[16px] text-navy-900 outline-none transition placeholder:text-navy-900/30 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm dark:border-white/15 dark:bg-[#0f141a] dark:text-ivory-50 dark:placeholder:text-ivory-50/25 min-h-[44px] touch-manipulation sm:min-h-0";
  const ghostBtn =
    "rounded-lg border border-navy-900/15 px-4 py-2 text-xs font-bold text-navy-700 transition hover:border-navy-500 dark:border-white/15 dark:text-ivory-50 min-h-[44px] touch-manipulation sm:min-h-0";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-3" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-navy-900/15 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161b22]">
        {/* الترويسة */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">
              {t("storTitle")}
            </h2>
            <p className="text-[11px] leading-5 text-navy-900/50 dark:text-ivory-50/50">{t("storSub")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={load} disabled={loading || busy} className={ghostBtn}>
              {loading ? "…" : t("storRefresh")}
            </button>
            <button onClick={onClose} className={`${ghostBtn} bg-navy-900 text-ivory-50 dark:bg-navy-700`}>
              {t("storCancel")}
            </button>
          </div>
        </div>

        {/* أدوات التحديد */}
        <div className="flex flex-wrap items-center gap-2 border-b border-navy-900/10 px-5 py-3 dark:border-white/10">
          <button
            onClick={() => { setSelected(allSelected ? new Set() : new Set(cats.map((c) => c.id))); setMsg(null); }}
            className={ghostBtn}
          >
            {allSelected ? t("storClear") : t("storSelectAll")}
          </button>
          {selected.size > 0 && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {selected.size} · {totalKeys} {t("storKeysUnit")}
            </span>
          )}
        </div>

        {/* قائمة الفئات */}
        <div className="grid gap-2 overflow-auto px-5 py-4">
          {loading && cats.length === 0 ? (
            <p className="py-6 text-center text-xs text-navy-900/45 dark:text-ivory-50/45">…</p>
          ) : (
            cats.map((c) => {
              const n = counts[c.id] ?? 0;
              const isSel = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex cursor-pointer flex-wrap items-center gap-3 rounded-2xl border p-3 transition ${
                    isSel
                      ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-500/10"
                      : "border-navy-900/10 bg-ivory-50 dark:border-white/10 dark:bg-navy-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(c.id)}
                    className="w-5 h-5 rounded border-navy-900/15 text-red-600 focus:ring-2 focus:ring-red-500/20 cursor-pointer touch-manipulation shrink-0"
                  />
                  <span className="min-w-0 flex-1 text-xs font-bold text-navy-900 dark:text-white">
                    {t(LABEL_KEYS[c.id] ?? "storTitle")}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DANGER_CLS[c.danger]}`}>
                    {c.danger === "critical"
                      ? t("storWarnCritical")
                      : c.danger === "high"
                      ? t("storWarnHigh")
                      : c.danger === "med"
                      ? t("storWarnMed")
                      : t("storWarnLow")}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-ivory-50/70">
                    {n} {n === 1 ? t("storKeyUnit") : t("storKeysUnit")}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {/* منطقة التأكيد + التنفيذ */}
        <div className="grid gap-3 border-t border-navy-900/10 px-5 py-4 dark:border-white/10">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold text-navy-700 dark:text-navy-300" htmlFor="stor-confirm">
              {t("storConfirmLabel")}
            </label>
            <input
              id="stor-confirm"
              type="text"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setMsg(null); }}
              placeholder={t("storConfirmPh")}
              className={inputCls}
              disabled={busy}
            />
          </div>

          {msg && (
            <p
              className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${
                msg.ok
                  ? "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-red-300/50 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-500/10 dark:text-red-300"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            onClick={runDelete}
            disabled={busy || !confirmOk || selected.size === 0}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40 min-h-[44px] touch-manipulation sm:min-h-0"
          >
            {busy ? t("storDeleting") : t("storDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
