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
    "neu-input !px-4 !py-2.5 !text-sm";

  return (
    <div className="grid w-full max-w-sm gap-4">
      <div className="text-center">
        <p className="text-lg font-extrabold">{t("adminLoginTitle")}</p>
        <p className="mt-1 text-[11px] t-muted">{t("adminOnly")}</p>
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
          <p className="neu-inset px-3 py-2 text-[11px] font-semibold t-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="neu-btn neu-btn--lg neu-btn--block !rounded-full"
        >
          {busy ? "…" : t("adminEnter")}
        </button>
      </form>
    </div>
  );
}
