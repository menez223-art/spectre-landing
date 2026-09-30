"use client";

// نافذة الأدمن — «بيانات الدخول».
//
// تتيح تغيير:
//   • اسم المستخدم + كلمة مرور **الاستوديو**
//   • بريد + كلمة مرور **الأدمن**
//
// ⚠️ الأمان: القيم تُرسَل للخادم فقط ولا تُعاد أبداً. الحقول دائماً فارغة عند
//    الفتح — اللوحة تخبر فقط هل هناك تخصيص مفعّل أم لا. هذا مقصود: لا كشف أسرار.
// ⚡ الحفظ يُطبَّق فوراً على عمليات الدخول التالية (KV يُقرأ قبل متغيرات البيئة).

import { useCallback, useEffect, useState } from "react";
import { useAdminLocale } from "./AdminLocale";

type Tab = "studio" | "admin";

interface Status {
  studio: { overridden: boolean };
  admin: { overridden: boolean; email: string };
}

export function CredentialsPanel({ onClose }: { onClose: () => void }) {
  const { t } = useAdminLocale();
  const [tab, setTab] = useState<Tab>("studio");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [stUser, setStUser] = useState("");
  const [stPass, setStPass] = useState("");
  const [adEmail, setAdEmail] = useState("");
  const [adPass, setAdPass] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/credentials", { cache: "no-store" });
      if (!res.ok) {
        setMsg({ ok: false, text: t("credErrLoad") });
        return;
      }
      const data = (await res.json().catch(() => null)) as Status | null;
      if (data) {
        setStatus(data);
        setAdEmail((prev) => prev || data.admin.email || "");
      }
    } catch {
      setMsg({ ok: false, text: t("credErrLoad") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);
  async function submit(action: "save_studio" | "save_admin") {
    setMsg(null);
    setBusy(true);
    try {
      const payload =
        action === "save_studio"
          ? { action, username: stUser, password: stPass }
          : { action, email: adEmail, password: adPass };

      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMsg({ ok: true, text: t("credSaved") });
        if (action === "save_studio") {
          setStUser("");
          setStPass("");
        } else {
          setAdPass("");
        }
        await load();
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const map: Record<string, string> = {
        short_password: t("credErrShort"),
        short_username: t("credErrUsername"),
        bad_username: t("credErrUsername"),
        bad_email: t("credErrEmail"),
      };
      setMsg({ ok: false, text: (body.error && map[body.error]) || t("credErrSave") });
    } catch {
      setMsg({ ok: false, text: t("credErrSave") });
    } finally {
      setBusy(false);
    }
  }

  async function reset(action: "reset_studio" | "reset_admin") {
    if (!window.confirm(t("credResetConfirm"))) return;
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setMsg({ ok: true, text: t("credResetDone") });
        if (action === "reset_studio") {
          setStUser("");
          setStPass("");
        } else {
          setAdPass("");
        }
        await load();
      } else {
        setMsg({ ok: false, text: t("credErrSave") });
      }
    } catch {
      setMsg({ ok: false, text: t("credErrSave") });
    } finally {
      setBusy(false);
    }
  }
  const inputCls =
    "w-full rounded-lg border border-navy-900/15 bg-white px-3 py-2.5 text-[16px] text-navy-900 outline-none transition placeholder:text-navy-900/30 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15 sm:text-sm dark:border-white/15 dark:bg-[#0f141a] dark:text-ivory-50 dark:placeholder:text-ivory-50/25 min-h-[44px] touch-manipulation sm:min-h-0";
  const labelCls = "block text-[11px] font-bold text-navy-700 dark:text-navy-300";
  const btnPrimary =
    "rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60 min-h-[44px] touch-manipulation sm:min-h-0";
  const btnDanger =
    "rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-500/10 min-h-[44px] touch-manipulation sm:min-h-0";

  const studioOverridden = status?.studio.overridden ?? false;
  const adminOverridden = status?.admin.overridden ?? false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/70 p-3" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-navy-900/15 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161b22]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-navy-900 dark:text-white">
              🔑 {t("credTitle")}
            </h2>
            <p className="text-[11px] leading-5 text-navy-900/50 dark:text-ivory-50/50">
              {t("credSub")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full bg-navy-900 px-4 py-2 text-xs font-bold text-ivory-50 transition hover:bg-navy-700 min-h-[44px] touch-manipulation dark:bg-navy-700 dark:hover:bg-navy-600 sm:min-h-0"
          >
            {t("adminCancel")}
          </button>
        </div>

        <div className="mx-5 mt-4 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-5 text-amber-800 dark:border-amber-700/50 dark:bg-amber-500/10 dark:text-amber-300">
          {t("credWarn")}
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {(["studio", "admin"] as const).map((k) => {
            const overridden = k === "studio" ? studioOverridden : adminOverridden;
            return (
              <button
                key={k}
                onClick={() => { setTab(k); setMsg(null); }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition min-h-[44px] touch-manipulation sm:min-h-0 ${
                  tab === k
                    ? "bg-navy-900 text-white"
                    : "bg-navy-50 text-navy-700 hover:bg-navy-100 dark:bg-navy-800 dark:text-navy-300 dark:hover:bg-navy-700"
                }`}
              >
                {k === "studio" ? t("credStudioTab") : t("credAdminTab")}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    overridden
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-ivory-50/60"
                  }`}
                >
                  {overridden ? t("credOverridden") : t("credDefault")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 overflow-auto px-5 py-4">
          {loading ? (
            <p className="py-6 text-center text-xs text-navy-900/45 dark:text-ivory-50/45">…</p>
          ) : tab === "studio" ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className={labelCls} htmlFor="cred-st-user">{t("credUsername")}</label>
                <input
                  id="cred-st-user"
                  type="text"
                  autoComplete="off"
                  value={stUser}
                  onChange={(e) => setStUser(e.target.value)}
                  placeholder={t("credUsername")}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <label className={labelCls} htmlFor="cred-st-pass">{t("credPassword")}</label>
                <input
                  id="cred-st-pass"
                  type="password"
                  autoComplete="new-password"
                  value={stPass}
                  onChange={(e) => setStPass(e.target.value)}
                  placeholder={t("credPassword")}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => submit("save_studio")} disabled={busy} className={btnPrimary}>
                  {busy ? t("credSaving") : t("credSave")}
                </button>
                {studioOverridden && (
                  <button onClick={() => reset("reset_studio")} disabled={busy} className={btnDanger}>
                    {t("credReset")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className={labelCls} htmlFor="cred-ad-email">{t("credEmail")}</label>
                <input
                  id="cred-ad-email"
                  type="email"
                  autoComplete="off"
                  value={adEmail}
                  onChange={(e) => setAdEmail(e.target.value)}
                  placeholder={t("credEmail")}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="grid gap-1.5">
                <label className={labelCls} htmlFor="cred-ad-pass">{t("credPassword")}</label>
                <input
                  id="cred-ad-pass"
                  type="password"
                  autoComplete="new-password"
                  value={adPass}
                  onChange={(e) => setAdPass(e.target.value)}
                  placeholder={t("credPassword")}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => submit("save_admin")} disabled={busy} className={btnPrimary}>
                  {busy ? t("credSaving") : t("credSave")}
                </button>
                {adminOverridden && (
                  <button onClick={() => reset("reset_admin")} disabled={busy} className={btnDanger}>
                    {t("credReset")}
                  </button>
                )}
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
