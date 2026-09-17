// لوحة الأدمن — روابط تجربة الڤيست.
//
// GET  : قائمة التجارب (الإيميل · الواتساب · الرابط · الوقت المتبقي · الحالة)
// POST : إجراءات إدارية — convert | burn_now | release_email
//
// ⚠️ لا يوجد **تمديد زمني** إطلاقاً (القاعدة ١٠): إمّا اشتراك فعلي أو حرق.
// ⚠️ لا يمسّ هذا المسار أي رابط لمشترك حقيقي — روابط الڤيست فقط.

import { NextResponse } from "next/server";
import { ADMIN_EMAIL, getAdminSession } from "@/app/lib/adminAuth";
import { isDeviceApproved } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getPublishedMeta, getPublishedProduct, setPublishedMeta } from "@/app/lib/publishStore";
import { ensureSubscription, setSubscription, PLAN_QUOTAS, type Plan } from "@/app/lib/subsStore";
import {
  burnTrial,
  convertTrial,
  listTrials,
  releaseTrial,
  getTrial,
  isTrialsDisabled,
  setTrialsDisabled,
} from "@/app/lib/trialStore";
import type { PublishMeta } from "@/app/lib/publishStore";

export const dynamic = "force-dynamic";

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// بوابة الأدمن — نفس منطق مسارات الأدمن الأخرى:
//   1) جلسة موقّعة (كوكي)، أو 2) جهاز استوديو معتمد مربوط ببريد ADMIN_EMAIL.
async function assertAdmin(fingerprint?: string): Promise<boolean> {
  if (!ADMIN_EMAIL) return false;
  if (getAdminSession() === ADMIN_EMAIL) return true;
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === ADMIN_EMAIL;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  try {
    const [all, disabled] = await Promise.all([listTrials(), isTrialsDisabled()]);
    const now = Date.now();
    const items = all.map((t) => {
      let remainingMs = 0;
      try {
        remainingMs = Math.max(0, new Date(t.expiresAt).getTime() - now);
      } catch {
        remainingMs = 0;
      }
      return {
        email: t.email,
        whatsapp: t.whatsapp,
        slug: t.slug,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
        remainingMs,
        status: t.status,
      };
    });
    return NextResponse.json({ items, trialsDisabled: disabled });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const fingerprint = String(body.fingerprint ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  const email = String(body.email ?? "").trim().toLowerCase();
  const action = String(body.action ?? "").trim();
  if (!action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  try {
    // تعطيل/تفعيل توليد الروابط التجريبية على الجميع (لا يحتاج إيميلاً).
    if (action === "trials_disable") {
      await setTrialsDisabled(true);
      return NextResponse.json({ ok: true, trialsDisabled: true });
    }
    if (action === "trials_enable") {
      await setTrialsDisabled(false);
      return NextResponse.json({ ok: true, trialsDisabled: false });
    }

    if (!email) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    // تحويل لدائم: الأدمن **يُعيّن اشتراكاً** ⇒ الرابط يصبح دائماً (بلا تمديد زمني)
    if (action === "convert") {
      const rec = await getTrial(email);
      if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const expires = Date.parse(rec.expiresAt);
      if (rec.status !== "active" || !Number.isFinite(expires) || expires <= Date.now()) {
        return NextResponse.json({ error: "trial_not_convertible" }, { status: 409 });
      }
      const [meta, product] = await Promise.all([getPublishedMeta(rec.slug), getPublishedProduct(rec.slug)]);
      if (!meta || !product || meta.owner !== email || !meta.trialUntil) {
        return NextResponse.json({ error: "trial_page_missing" }, { status: 409 });
      }

      const PLAN_VALUES: Plan[] = ["basic", "pro", "gold"];
      const requested = String(body.plan ?? "").trim() as Plan;
      const plan: Plan = PLAN_VALUES.includes(requested) ? requested : "basic";

      const sub = await ensureSubscription(email);
      // تعيين الخطة التي اختارها الأدمن (القاعدة ١١)
      if (sub.plan !== plan) {
        // تغيير الخطة يستبدل الحصص القديمة؛ الحفظ العام يحتفظ بالحصص المخصصة.
        await setSubscription({ ...sub, plan, ...PLAN_QUOTAS[plan] });
      }

      // حذف trialUntil ⇒ الصفحة لم تعُد تجربة
      const cleared: PublishMeta = { ...meta };
      delete cleared.trialUntil;
      await setPublishedMeta(rec.slug, cleared);

      const updated = await convertTrial(email);
      if (!updated) return NextResponse.json({ error: "storage" }, { status: 502 });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    // حرق فوري — حذف نهائي لبيانات المنتج
    if (action === "burn_now") {
      const updated = await burnTrial(email);
      if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    // استثناء إداري نادر: تحرير إيميل/جهاز محجوز بالخطأ
    if (action === "release_email") {
      const done = await releaseTrial(email);
      if (!done) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, released: true });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && ["converted", "trial_not_releasable"].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
