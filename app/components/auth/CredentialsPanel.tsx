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
    "neu-input !px-3 !py-2.5 !text-[16px] sm:!text-sm min-h-[44px] touch-manipulation sm:min-h-0";
  const labelCls = "block text-[11px] font-bold";
  const btnPrimary =
    "neu-btn neu-btn--success !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0";
  const btnDanger =
    "neu-btn neu-btn--danger !px-3 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0";

  const studioOverridden = status?.studio.overridden ?? false;
  const adminOverridden = status?.admin.overridden ?? false;

  return (
    <div className="neu-app fixed inset-0 z-50 grid place-items-center !bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-3" role="dialog" aria-modal="true">
      <div className="neu-card flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              <i className="fa-solid fa-key t-primary" aria-hidden="true" /> {t("credTitle")}
            </h2>
            <p className="text-[11px] leading-5 t-muted">
              {t("credSub")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="neu-btn shrink-0 !rounded-full !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0"
          >
            {t("adminCancel")}
          </button>
        </div>

        <div className="neu-inset mx-5 mt-4 !px-3 !py-2.5 text-[11px] font-semibold leading-5 t-warning">
          {t("credWarn")}
        </div>
        <div className="flex flex-wrap gap-1.5 px-5 pt-4">
          {(["studio", "admin"] as const).map((k) => {
            const overridden = k === "studio" ? studioOverridden : adminOverridden;
            return (
              <button
                key={k}
                onClick={() => { setTab(k); setMsg(null); }}
                className={`neu-tab flex items-center gap-2 !rounded-full !px-4 !py-2 !text-xs min-h-[44px] touch-manipulation sm:min-h-0 ${
                  tab === k
                    ? "is-active"
                    : ""
                }`}
              >
                {k === "studio" ? t("credStudioTab") : t("credAdminTab")}
                <span
                  className={`neu-badge !px-2 !py-0.5 !text-[10px] ${
                    overridden
                      ? "neu-badge--success"
                      : ""
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
            <p className="py-6 text-center text-xs t-muted">…</p>
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
              className={`neu-inset px-3 py-2 text-[11px] font-bold ${
                msg.ok
                  ? "t-success"
                  : "t-danger"
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
