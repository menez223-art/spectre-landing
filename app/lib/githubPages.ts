// رفع ملف HTML مستقل على GitHub Pages (احتياط مستقر بديل Netlify).
// server only — يستخدم GitHub Personal Access Token + repo من البيئة.
//
// المتغيرات المطلوبة (.env.local — سرّية):
//   GITHUB_TOKEN   — PAT بصلاحيات contents:write على الريبو.
//   GITHUB_REPO    — بصيغة "owner/repo" (الريبو المخصص للاحتياط).
//
// الآلية (GitHub Contents API):
//   1) إن وجد الملف مسبقاً نجلب sha الحالي (للتحديث عبر PUT).
//   2) نرفع/نحدّث الملف عبر PUT /repos/{owner}/{repo}/contents/{path}
//      مع محتوى base64 ورأس باسم الفرع.
//   3) الموقع مُفعّل كـ GitHub Pages من الإعدادات (نشر الفرع مباشرة)،
//      فيصبح الرابط العام https://<owner>.github.io/<repo>/<path>.
//
// ملاحظة المسارات: نضع الملفات تحت بادئة "p/" (وليست جذر الموقع) كي لا
// تفهرسها محركات البحث كبنية موقع حقيقية — هي روابط مؤقتة (تحترق بأسبوع).

import { getKv, setKv } from "./kvStore";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = (process.env.GITHUB_REPO || "").trim(); // "owner/repo"
const BRANCH = (process.env.GITHUB_BRANCH || "main").trim();
const PATH_PREFIX = "p/";
const POLL_MAX = 20;
const POLL_INTERVAL_MS = 2000;

export function hasGithubPages(): boolean {
  return Boolean(TOKEN && REPO.includes("/"));
}

export interface GithubPagesResult {
  url: string;
  ok: boolean;
  error?: string;
}

// يحوّل بادئة "owner/repo" إلى اسم النطاق الفرعي لـ Pages.
function siteBase(): string {
  const [owner, repo] = REPO.split("/");
  return `https://${owner}.github.io/${repo}`;
}

// يبني رابط محتوى الـ API (مسار مُرمّز).
function apiPath(slug: string): string {
  const path = `${PATH_PREFIX}${slug}.html`;
  return `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`;
}

// يأخذ sha الحالي للملف إن وُجد (للتحديث) — يتجاهل أخطاء 404.
async function getFileSha(path: string): Promise<string | null> {
  try {
    const res = await fetch(apiPath(path.replace(/\.html$/, "")), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as { sha?: string };
    return data.sha ?? null;
  } catch {
    return null;
  }
}

// يرفع ملف HTML واحد تحت slug.html في بادئة p/ وينشره على GitHub Pages.
// يرجع الرابط العام https://<owner>.github.io/<repo>/p/<slug>.html.
export async function deployHtmlToGithubPages(
  slug: string,
  html: string
): Promise<GithubPagesResult> {
  if (!hasGithubPages()) return { url: "", ok: false, error: "missing_config" };

  const content = Buffer.from(html, "utf-8").toString("base64");
  const path = `${PATH_PREFIX}${slug}.html`;
  const sha = await getFileSha(slug);

  const body: Record<string, unknown> = {
    message: `deploy fallback page: ${slug}`,
    content,
    branch: BRANCH,
  };
  if (sha) body.sha = sha; // تحديث ملف موجود

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { url: "", ok: false, error: `upload:${res.status}:${errText.slice(0, 200)}` };
  }

  // GitHub Pages ينشر تلقائياً عند دفع للفرع المُفعّل — ننتظر ظهور الرابط.
  const url = `${siteBase()}/${path}`;
  let reached = false;
  for (let i = 0; i < POLL_MAX; i++) {
    try {
      const head = await fetch(url, { method: "HEAD" });
      if (head.ok || head.status === 200) {
        reached = true;
        break;
      }
    } catch {
      // نتابع الاستقصاء
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!reached) {
    // نعيد الرابط رغم ذلك — قد يتأخر نشر Pages بضع ثوانٍ بعد الرفع.
    return { url, ok: true };
  }

  return { url, ok: true };
}
