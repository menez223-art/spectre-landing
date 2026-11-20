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
  critical: "neu-badge--danger",
  high: "neu-badge--warning",
  med: "neu-badge--warning",
  low: "",
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
    "neu-input !px-3 !py-2.5 !text-[16px] sm:!text-sm min-h-[44px] touch-manipulation sm:min-h-0";
  const ghostBtn =
    "neu-btn neu-btn--muted !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0";

  return (
    <div className="neu-app fixed inset-0 z-50 grid place-items-center !bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-3" role="dialog" aria-modal="true">
      <div className="neu-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden">
        {/* الترويسة */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              {t("storTitle")}
            </h2>
            <p className="text-[11px] leading-5 t-muted">{t("storSub")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={load} disabled={loading || busy} className={ghostBtn}>
              {loading ? "…" : t("storRefresh")}
            </button>
            <button onClick={onClose} className="neu-btn !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0">
              {t("storCancel")}
            </button>
          </div>
        </div>

        {/* أدوات التحديد */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-3">
          <button
            onClick={() => { setSelected(allSelected ? new Set() : new Set(cats.map((c) => c.id))); setMsg(null); }}
            className={ghostBtn}
          >
            {allSelected ? t("storClear") : t("storSelectAll")}
          </button>
          {selected.size > 0 && (
            <span className="neu-badge neu-badge--primary !px-3 !py-1 !text-[11px]">
              {selected.size} · {totalKeys} {t("storKeysUnit")}
            </span>
          )}
        </div>

        {/* قائمة الفئات */}
        <div className="grid gap-2 overflow-auto px-5 py-4">
          {loading && cats.length === 0 ? (
            <p className="py-6 text-center text-xs t-muted">…</p>
          ) : (
            cats.map((c) => {
              const n = counts[c.id] ?? 0;
              const isSel = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`neu-row flex cursor-pointer flex-wrap items-center gap-3 !p-3 ${
                    isSel
                      ? "![box-shadow:var(--shadow-inner-sm)]"
                      : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(c.id)}
                    className="w-5 h-5 accent-[var(--danger-color)] cursor-pointer touch-manipulation shrink-0"
                  />
                  <span className="min-w-0 flex-1 text-xs font-bold">
                    {t(LABEL_KEYS[c.id] ?? "storTitle")}
                  </span>
                  <span className={`neu-badge !whitespace-normal max-w-[360px] text-start !leading-[1.6] !rounded-xl !px-2.5 !py-1.5 !text-[10px] ${DANGER_CLS[c.danger]}`}>
                    {c.danger === "critical"
                      ? t("storWarnCritical")
                      : c.danger === "high"
                      ? t("storWarnHigh")
                      : c.danger === "med"
                      ? t("storWarnMed")
                      : t("storWarnLow")}
                  </span>
                  <span className="neu-badge !px-2 !py-0.5 !text-[10px]">
                    {n} {n === 1 ? t("storKeyUnit") : t("storKeysUnit")}
                  </span>
                </label>
              );
            })
          )}
        </div>
        {/* منطقة التأكيد + التنفيذ */}
        <div className="grid gap-3 border-t border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-bold" htmlFor="stor-confirm">
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
              className={`neu-inset px-3 py-2 text-[11px] font-bold ${
                msg.ok
                  ? "t-success"
                  : "t-danger"
              }`}
            >
              {msg.text}
            </p>
          )}

          <button
            onClick={runDelete}
            disabled={busy || !confirmOk || selected.size === 0}
            className="neu-btn neu-btn--danger neu-btn--block !px-4 !py-2.5 !text-xs min-h-[44px] touch-manipulation sm:min-h-0"
          >
            {busy ? t("storDeleting") : t("storDelete")}
          </button>
        </div>
      </div>
    </div>
  );
}
