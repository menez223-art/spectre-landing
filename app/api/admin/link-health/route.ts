// مسار إداري محمي — فحص صحة روابط المستخدمين (/p/[slug]).
// يمرّ على كل المنشورات ويضرب رابطها الداخلي للتأكد من استجابتها
// (200 / محجوبة بسبب حظر أو اشتراك منتهٍ / خطأ)، ويسجّل النتائج في KV
// كي تعرضها لوحة الأدمن. هذا يجيب مباشرة على سؤال المستخدم:
// «معرفة إن كان هناك مشكل في الروابط أم لا».
// بوابة أمان صارمة مثل بقية مسارات الأدمن: يعمل فقط للمشرف.

import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/adminAuth";
import { isDeviceApproved } from "@/app/lib/authStore";
import { getProfileEmail, resolveOwnerEmail } from "@/app/lib/profileStore";
import { getKv, setKv, listKv } from "@/app/lib/kvStore";
import {
  listPublishedProducts,
  getPublishedOwner,
  getPublishedProduct,
  getPublishedMeta,
  setPublishedMeta,
} from "@/app/lib/publishStore";
import { setSubscription, getSubscription } from "@/app/lib/subsStore";
import { buildWebhook } from "@/app/lib/sheetResolver";
import { generateLandingHtml } from "@/app/lib/generateHtml";
import { deployHtmlToGithubPages, hasGithubPages } from "@/app/lib/githubPages";

export const dynamic = "force-dynamic";
// الفحص الأوتوماتيكي (auto) قد يمرّ على عدة روابط ويعيد النشر على GitHub Pages
// (استقصاء قد يصل ~40ث لكل رابط متعافٍ) — نمنح المسار المهلة القصوى على Hobby
// كي يكمل الـ cron دون قطع. Vercel يقصّها تلقائياً لحد الخطة إن لزم.
export const maxDuration = 60;

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const HEALTH_KEY = "stats/link-health";

// سرّ استدعاء الجدولة (Vercel Cron) — إن وُجد جرى التحقق منه في assertAdmin.
// Vercel يُرسل تلقائياً `Authorization: Bearer <CRON_SECRET>` لطلبات cron.
const CRON_SECRET = process.env.CRON_SECRET || "";

async function assertAdmin(request: Request, fingerprint?: string): Promise<boolean> {
  // استدعاء cron مصرّح به عبر السرّ المخصّص (بلا كوكي جلسة).
  if (CRON_SECRET && request.headers.get("authorization") === `Bearer ${CRON_SECRET}`) return true;
  if (!ADMIN_EMAIL) return false;
  if (getAdminSession() === ADMIN_EMAIL) return true;
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === ADMIN_EMAIL;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export interface LinkHealthEntry {
  slug: string;
  status: "ok" | "blocked" | "error"; // ok=200، blocked=محجوبة، error=فشل/غير موجودة
  httpStatus: number;
  checkedAt: string;
  ownerEmail?: string | null; // بريد مالك الرابط (للتعريف في لوحة الأدمن)
}

export interface LinkHealthReport {
  checkedAt: string;
  total: number;
  ok: number;
  blocked: number;
  error: number;
  entries: LinkHealthEntry[];
}

// فحص رابط واحد عبر استدعاء داخلي لصفحة الهبوط — يلتقط حالة الحظر/التوقيف
// (لأن renderBlocked يرجع 200 أيضاً، نميّز بالنص داخل HTML: "محظور" أو "متوقفة").
async function probeSlug(slug: string, origin: string): Promise<LinkHealthEntry> {
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${origin}/p/${encodeURIComponent(slug)}`, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "LinkHealthProbe/1.0" },
      cache: "no-store",
    });
    const httpStatus = res.status;
    // renderBlocked تُرجع 200 مع نص يحوي "محظور" أو "متوقفة" — نميّزها.
    if (httpStatus === 200) {
      const text = await res.text().catch(() => "");
      if (text.includes("محظور") || text.includes("متوقفة")) {
        return { slug, status: "blocked", httpStatus, checkedAt: now };
      }
      return { slug, status: "ok", httpStatus, checkedAt: now };
    }
    if (httpStatus >= 300 && httpStatus < 400) {
      // توجيه (مثلاً إلى GitHub Pages) — نعتبره سليماً لأن الصفحة حيّة.
      return { slug, status: "ok", httpStatus, checkedAt: now };
    }
    return { slug, status: "error", httpStatus, checkedAt: now };
  } catch {
    return { slug, status: "error", httpStatus: 0, checkedAt: now };
  }
}

// يشغّل فحصاً فعلياً لكل الروابط ويرجع التقرير (مُستخدَم من run و auto).
async function runHealthCheck(origin: string): Promise<LinkHealthReport> {
  // نجلب قائمة المنشورات فقط (slug) لا المنتج كاملاً لتفادي تحميل كبير.
  const products = await listPublishedProducts();
  const slugs = Array.from(new Set(products.map((p) => p.slug)));

  const entries: LinkHealthEntry[] = [];
  // نفحص على دفعات صغيرة لتفادي ضغط متزامن شديد على الخادم.
  const BATCH = 8;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((s) => probeSlug(s, origin)));
    // نجلب بريد المالك لكل رابط كي يظهر في لوحة الأدمن (للتعريف)
    const withOwners = await Promise.all(
      results.map(async (r) => {
        let ownerEmail: string | null = null;
        try {
          const owner = await getPublishedOwner(r.slug);
          if (owner) ownerEmail = (await resolveOwnerEmail(owner)) ?? owner;
        } catch {
          ownerEmail = null;
        }
        return { ...r, ownerEmail };
      })
    );
    entries.push(...withOwners);
  }

  return {
    checkedAt: new Date().toISOString(),
    total: entries.length,
    ok: entries.filter((e) => e.status === "ok").length,
    blocked: entries.filter((e) => e.status === "blocked").length,
    error: entries.filter((e) => e.status === "error").length,
    entries,
  };
}

// يعيد نشر نسخة احتياطية لرابط على GitHub Pages (احتياط عند فشل Vercel).
async function redeployFallback(slug: string) {
  try {
    const product = await getPublishedProduct(slug);
    if (!product) return { ok: false, served: false, reason: "no_product" };
    const webhook = await buildWebhook({
      sheetKey: product.sheetKey ?? null,
      sheetEmail: product.sheetEmail ?? null,
    });
    const html = await generateLandingHtml(
      product,
      webhook ?? undefined,
      new Date().toISOString()
    );
    return await deployHtmlToGithubPages(slug, html);
  } catch (err) {
    return { ok: false, served: false, reason: String(err) };
  }
}

// فحص يدوي (action=run): يشغّل فحصاً كاملاً، يحفظ التقرير، ويرجعه.
async function runManualAction(request: Request): Promise<NextResponse> {
  try {
    const origin = new URL(request.url).origin;
    const report = await runHealthCheck(origin);
    await setKv(HEALTH_KEY, report);
    return NextResponse.json({ ok: true, fresh: true, report });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// فحص أوتوماتيكي (action=auto، عبر جدولة Vercel Cron): فحص كامل + عند الفشل
// إشعار داخلي للمالك (النقطة 2) + تعافٍ أوتوماتيكي بإعادة النشر على GitHub Pages
// وتحويل الرابط إليها (النقطة 3). لا علاقة له بنظام الحظر/السماح.
async function runAutoAction(request: Request): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const report = await runHealthCheck(origin);
  await setKv(HEALTH_KEY, report);

  const githubAvailable = hasGithubPages();
  const recovered: string[] = [];
  // سقف محاولات التعافي لكل تشغيلة: استقصاء Pages حتى ~40ث للرابط الواحد،
  // وروابط خطأ متعددة بتشغيلة cron واحدة كانت تتجاوز maxDuration=60 ثانية
  // فتُقص في منتصف الفحص. ما تجاوز السقف يتأجل للتشغيلة التالية (بعد يوم).
  const MAX_RECOVERY_PER_RUN = 2;
  let recoveries = 0;

  for (const entry of report.entries) {
    if (entry.status !== "error") continue;
    try {
      const owner = await getPublishedOwner(entry.slug);
      if (!owner) continue;
      const email = (await resolveOwnerEmail(owner)) ?? owner;
      const sub = await getSubscription(email);
      if (!sub) continue;

      // النقطة 3 أولاً — إن نجح التعافي الآن فهو أفضل من الإشعار، ولا داعي
      // لإزعاج المالك برسالة «رابطك معطّل» بينما صار يعمل فعلاً.
      let recoveredThisRun = false;
      if (githubAvailable && recoveries < MAX_RECOVERY_PER_RUN) {
        const dep = await redeployFallback(entry.slug);
        // لا نحوّل الرابط إلى host="github" إلا بعد تأكيد أن Pages يخدمه فعلاً
        // (served=true)، وإلا وقع الزائر على 404 أثناء تأخّر بناء Pages؛ يبقى
        // على Vercel ويُعاد المحاولة في تشغيلة الفحص التالية بعد اكتمال البناء.
        if (dep.ok && dep.served) {
          const existingMeta = (await getPublishedMeta(entry.slug)) ?? {
            owner,
            createdAt: entry.checkedAt,
          };
          await setPublishedMeta(entry.slug, { ...existingMeta, host: "github" });
          recovered.push(entry.slug);
          recoveries++;
          recoveredThisRun = true;
          // مسح أي إشعار قديم مضلل بقي من تشغيلات سابقة
          try {
            await setSubscription({
              ...sub,
              notice: null,
              updatedAt: new Date().toISOString(),
            });
          } catch {
            // فشل المسح لا يعكس نجاح التعافي نفسه
          }
        }
      }

      // النقطة 2 — إشعار داخلي فقط (لا إيميل) حين لم يتعافَ الرابط فعلاً
      if (!recoveredThisRun) {
        const notice =
          "⚠️ رابط صفحتك لم يستجب أثناء الفحص الأخير. يرجى تحديث رابطك من الاستوديو (زر «رابط جديد»).";
        await setSubscription({ ...sub, notice, updatedAt: new Date().toISOString() });
      }
    } catch {
      // نتجاهل خطأ رابط واحد ونكمل البقية
    }
  }

  return NextResponse.json({ ok: true, fresh: true, report, recovered });
}

// GET: بلا action يعيد آخر تقرير محفوظ (عرض سريع في اللوحة). لكن Vercel Cron
// يستدعي هذا المسار عبر GET حاملاً ?action=auto (من vercel.json) — لا POST —
// لذا ندعم تشغيل الفحص هنا أيضاً، وإلا لن تعمل المراقبة المجدولة إطلاقاً
// (كانت تعيد التقرير القديم فقط دون أي فحص فعلي).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(request, fingerprint || undefined))) return forbidden();

  const action = searchParams.get("action");
  if (action === "auto") return runAutoAction(request);
  if (action === "run") return runManualAction(request);

  try {
    const saved = await getKv<LinkHealthReport>(HEALTH_KEY);
    if (saved) return NextResponse.json({ report: saved, fresh: false });
    return NextResponse.json({ report: null, fresh: false });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// POST: إجراءات متعددة عبر body.action:
//   - "run"    : فحص يدوي فقط (للوحة الأدمن).
//   - "notify" : يكتب إشعاراً داخلياً للمالك (لا إيميل) يطلب منه تحديث رابطه.
//   - "auto"   : فحص أوتوماتيكي (عبر جدولة Vercel) — عند الفشل يكتب إشعاراً
//                داخلياً للمالك (النقطة 2) ويعيد النشر على GitHub Pages ويحوّل
//                الرابط إليها (تعافٍ أوتوماتيكي، النقطة 3). لا علاقة بنظام الحظر.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(request, fingerprint || undefined))) return forbidden();

  let action = searchParams.get("action") || "run";
  let body: { action?: string; slug?: string; notify?: string } = {};
  try {
    body = (await request.json().catch(() => ({}))) as { action?: string; slug?: string; notify?: string };
    if (body.action) action = body.action;
  } catch {
    // نتجاهل JSON السيئ ونفترض التشغيل
  }

  // إجراء "notify": يكتب إشعاراً للعميل المالك للرابط (عبر حقل notice في
  // اشتراكه) يظهر له كلفتة داخل الاستوديو يطلب منه تحديث رابطه. لا يرسل
  // إيميلاً للعميل (نظام الإيميل مخصّص للمشرف فقط لأسباب أمنية) — الإشعار
  // داخلي في الواجهة. لا علاقة له بنظام الحظر/السماح.
  if (action === "notify") {
    const slug = String(body.slug ?? "").trim();
    const notify = body.notify != null ? String(body.notify).slice(0, 280) : null;
    if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });
    try {
      const owner = await getPublishedOwner(slug);
      if (!owner) return NextResponse.json({ error: "no_owner" }, { status: 404 });
      // نوحّد إلى البريد الكنسي إن كان المالك هوية جهاز
      const email = (await resolveOwnerEmail(owner)) ?? owner;
      const existing = await getSubscription(email);
      if (!existing) return NextResponse.json({ error: "no_subscription" }, { status: 404 });
      const updated = { ...existing, notice: notify, updatedAt: new Date().toISOString() };
      await setSubscription(updated);
      return NextResponse.json({ ok: true, ownerEmail: email });
    } catch {
      return NextResponse.json({ error: "storage" }, { status: 502 });
    }
  }

  // auto و run يشغّلان نفس المنطق المشترك (يعمل من POST ومن GET/الجدولة).
  if (action === "auto") return runAutoAction(request);

  if (action !== "run") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  return runManualAction(request);
}
