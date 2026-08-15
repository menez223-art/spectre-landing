"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./LocaleProvider";

// صندوق دخول الأدمن — يرسل البريد + كلمة المرور إلى الخادم الذي يضع كوكي جلسة موقّعة،
// ثم يوجّه مباشرة إلى صفحة إدارة الاشتراكات. كلمة المرور لا تُخزَّن في المتصفح.
export function AdminLoginBox() {
  const { t } = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/admin");
        return;
      }
      setError(t("adminLoginError"));
    } catch {
      setError(t("adminLoginError"));
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-navy-900/15 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-900/35 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/15";

  return (
    <div className="grid w-full max-w-sm gap-4 rounded-3xl border border-rose-300/40 bg-white p-6 shadow-xl shadow-navy-950/20">
      <div className="text-center">
        <p className="font-display text-lg font-extrabold text-navy-900 dark:text-ivory-50">{t("adminLoginTitle")}</p>
        <p className="mt-1 text-[11px] text-navy-900/50 dark:text-ivory-50/50">للمشرف فقط</p>
      </div>
      <form onSubmit={handleLogin} className="grid gap-3">
        <input
          className={inputCls}
          type="email"
          dir="ltr"
          placeholder={t("adminEmailPh")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          className={inputCls}
          type="password"
          dir="ltr"
          placeholder={t("adminPasswordPh")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-rose-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
        >
          {busy ? "…" : t("adminEnter")}
        </button>
      </form>
    </div>
  );
}
