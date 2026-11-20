"use client";

// نافذة «الإعدادات المتقدمة» — تعديل نصوص **الصفحة الرئيسية** بالعربية والإنجليزية.
//
// لماذا هي مفيدة: التعديلات تُخزَّن في القاعدة لا في الكود ⇒ **لا تُفقد عند أي
// تحديث**، ويمكن استرجاع أي نص لافتراضيته بزر واحد.
//
// ⚠️ ٣٧ نصاً في ٧ مجموعات (مفاتيح الصفحة الرئيسية فقط). أي نص غير معدَّل يبقى
//    على قاموسه المدمج — فالتعديل الجزئي آمن تماماً.

import { useCallback, useEffect, useMemo, useState } from "react";
import { SITE_COPY_GROUPS, type CopyGroup, type SiteCopy } from "@/app/lib/siteCopyShared";
import type { I18nKey } from "@/app/lib/i18n";
import { useAdminLocale } from "./AdminLocale";

type Bucket = Record<string, string>;
const EMPTY: SiteCopy = { ar: {}, en: {} };

export function SiteCopyPanel({ onClose }: { onClose: () => void }) {
  const { t } = useAdminLocale();

  const [copy, setCopy] = useState<SiteCopy>(EMPTY);
  const [defaults, setDefaults] = useState<{ ar: Bucket; en: Bucket }>({ ar: {}, en: {} });
  const [groups, setGroups] = useState<CopyGroup[]>(SITE_COPY_GROUPS);
  const [tab, setTab] = useState(SITE_COPY_GROUPS[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/site-copy", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setCopy(j.copy ?? EMPTY);
      setDefaults(j.defaults ?? { ar: {}, en: {} });
      if (Array.isArray(j.groups) && j.groups.length) {
        setGroups(j.groups);
        setTab(j.groups[0].id);
      }
    } catch {
      setMsg({ ok: false, text: "تعذّر التحميل." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setValue = (langKey: "ar" | "en", key: I18nKey, value: string) => {
    setCopy((c) => {
      const bucket = { ...c[langKey] };
      if (value.trim()) bucket[key] = value;
      else delete bucket[key];
      return { ...c, [langKey]: bucket };
    });
  };

  const resetKey = (key: I18nKey) => {
    setCopy((c) => {
      const ar = { ...c.ar };
      const en = { ...c.en };
      delete ar[key];
      delete en[key];
      return { ar, en };
    });
  };

  const resetAll = () => setCopy(EMPTY);

  const modifiedCount = useMemo(() => {
    let n = 0;
    for (const g of groups) {
      for (const k of g.keys) if (copy.ar[k] || copy.en[k]) n += 1;
    }
    return n;
  }, [copy, groups]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/site-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ copy }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? String(r.status));
      setCopy(j.copy ?? copy);
      setMsg({ ok: true, text: t("siteCopySaved") });
    } catch {
      setMsg({ ok: false, text: "تعذّر الحفظ." });
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "neu-input !px-3 !py-2 !text-[13px]";

  const active = groups.find((g) => g.id === tab) ?? groups[0];

  return (
    <div className="neu-app fixed inset-0 z-50 grid place-items-center !bg-[color-mix(in_srgb,var(--bg-color)_82%,transparent)] p-3" role="dialog" aria-modal="true">
      <div className="neu-card flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden">
        {/* الترويسة */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold">
              {t("siteCopyTitle")}
            </h2>
            <p className="text-[11px] t-muted">
              {t("siteCopySub")}
              {modifiedCount > 0 && (
                <span className="neu-badge neu-badge--warning ms-2 !px-2 !py-0.5">
                  {modifiedCount} {t("siteCopyModified")}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="neu-btn neu-btn--muted !rounded-full !px-4 !py-2 !text-xs"
            >
              {loading ? "…" : t("adminRefresh")}
            </button>
            <button
              onClick={onClose}
              className="neu-btn !rounded-full !px-4 !py-2 !text-xs"
            >
              {t("adminCancel")}
            </button>
          </div>
        </div>

        {/* تبويبات المجموعات */}
        <div className="flex flex-wrap gap-1.5 border-b border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-3">
          {groups.map((g) => {
            const n = g.keys.filter((k) => copy.ar[k] || copy.en[k]).length;
            return (
              <button
                key={g.id}
                onClick={() => setTab(g.id)}
                className={`neu-tab !rounded-full !px-3.5 !py-1.5 !text-[11px] ${
                  tab === g.id
                    ? "is-active"
                    : ""
                }`}
              >
                {t(`siteCopyGroup_${g.id}` as I18nKey)}
                {n > 0 && <span className="ms-1.5 opacity-70">({n})</span>}
              </button>
            );
          })}
        </div>

        {/* الصفوف */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-xs t-muted">…</p>
          ) : (
            <div className="grid gap-3">
              {active?.keys.map((key) => {
                const isMod = Boolean(copy.ar[key] || copy.en[key]);
                return (
                  <div
                    key={key}
                    className={`neu-panel !p-3 ${
                      isMod
                        ? "![box-shadow:var(--shadow-inner-sm)]"
                        : ""
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <code dir="ltr" className="min-w-0 flex-1 truncate text-[11px] t-muted">
                        {key}
                      </code>
                      <div className="flex shrink-0 items-center gap-2">
                        {isMod && (
                          <span className="neu-badge neu-badge--warning !px-2 !py-0.5 !text-[10px]">
                            {t("siteCopyModified")}
                          </span>
                        )}
                        <button
                          onClick={() => resetKey(key)}
                          disabled={!isMod}
                          className="neu-btn neu-btn--muted !rounded-full !px-3 !py-1 !text-[10px]"
                        >
                          {t("siteCopyReset")}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-[10px] font-bold t-muted">
                          العربية
                        </p>
                        <input
                          dir="rtl"
                          className={inputCls}
                          value={copy.ar[key] ?? ""}
                          placeholder={defaults.ar[key] ?? ""}
                          onChange={(e) => setValue("ar", key, e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-bold t-muted">
                          English
                        </p>
                        <input
                          dir="ltr"
                          className={inputCls}
                          value={copy.en[key] ?? ""}
                          placeholder={defaults.en[key] ?? ""}
                          onChange={(e) => setValue("en", key, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* التذييل */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:color-mix(in_srgb,var(--text-muted)_20%,transparent)] px-5 py-4">
          <div className="text-[11px]">
            {msg ? (
              <span className={msg.ok ? "t-success" : "t-danger"}>
                {msg.text}
              </span>
            ) : (
              <span className="t-muted">{t("siteCopyEmptyHint")}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAll}
              disabled={modifiedCount === 0 || saving}
              className="neu-btn neu-btn--muted !rounded-full !px-4 !py-2 !text-xs"
            >
              {t("siteCopyResetAll")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="neu-btn neu-btn--warning !rounded-full !px-6 !py-2 !text-xs"
            >
              {saving ? "…" : t("siteCopySave")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
