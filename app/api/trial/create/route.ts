// إنشاء رابط تجربة الڤيست — «مرة واحدة للأبد» لكل إيميل ولكل جهاز.
//
// الشروط بالترتيب (حسب docs/SPEC-guest-trial.md §6.1):
//   1) إيميل صالح · 2) ليس مشتركاً أصلاً (حماية المشتركين) · 3) لا سجل سابق للإيميل
//   4) لا سجل سابق للجهاز · 5) رقم واتساب إجباري · 6) صورة واحدة فقط
//   7) رمز تفعيل عبر واتساب — إلزامي
//   8) **الإيميل والجهاز والرقم لا تنتمي إلى مشترك حقيقي** (شرط المالك الصريح
//      2026-09-21: غياب أي طرف من الأطراف الثلاثة ⇒ لا رابط) — trialGuard.ts.
//      استثناء وحيد: جلسة أدمن موقّعة (لاختبار المالك)، ولا يتجاوز قواعد «مرة واحدة».
//
// الناتج: منتج منشور بلا sheet وبلا GitHub + trialUntil بعد 24 ساعة + سجل تجربة.

import { NextResponse } from "next/server";
import { hasPublishStore } from "@/app/lib/publishStore";
import { getKv, setKv, deleteKv } from "@/app/lib/kvStore";
import {
  createTrial,
  getTrial,
  getTrialByDevice,
  getTrialByWhatsapp,
  isTrialsDisabled,
  normalizeWhatsapp,
  TRIAL_HOURS,
} from "@/app/lib/trialStore";
import { paletteForCategory } from "@/app/lib/trialPalette";
import { findSubscriberConflict } from "@/app/lib/trialGuard";
import { assertAdminSession } from "@/app/lib/adminAuth";
import { normalizeTheme, sanitizeTheme } from "@/app/lib/theme";
import type { Product } from "@/app/lib/types";
import type { PublishMeta } from "@/app/lib/publishStore";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newSlug(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const bad = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/** هل الطلب صادر بجلسة أدمن موقّعة؟ (تُستخدم لاستثناء اختبار المالك فقط) */
async function isAdminRequest(): Promise<boolean> {
  try {
    return await assertAdminSession();
  } catch {
    return false; // أي تعثّر في قراءة الجلسة = ليس أدمن (الأصل: الفحص يُطبَّق)
  }
}

export async function POST(request: Request) {
  if (!hasPublishStore()) return bad("storage", 503);

  // المالك أوقف توليد الروابط التجريبية على الجميع — نرفض قبل أي معالجة.
  if (await isTrialsDisabled()) {
    return NextResponse.json({ error: "trials_disabled" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("invalid_json");

  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp ?? "").trim();
  const deviceFp = String(body.deviceFp ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 60);
  const category = String(body.category ?? "").trim();
  const image = String(body.image ?? "").trim();
  const priceRaw = Number(body.price ?? 0);
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? Math.floor(priceRaw) : 0;

  if (!EMAIL_RE.test(email)) return bad("bad_email");
  // شروط المالك: لا رابط حتى تكتمل خانات المنتج الأساسية (حماية على الخادم).
  const tagline = String(body.tagline ?? "").trim();
  const description = String(body.description ?? "").trim();
  const features = Array.isArray(body.features) ? body.features
    .filter((f): f is { title: string; copy: string } =>
      f != null && typeof f === "object" && typeof f.title === "string" &&
      typeof f.copy === "string" && !!f.title.trim() && !!f.copy.trim())
    .map((f) => ({ title: f.title.trim(), copy: f.copy.trim() })) : [];
  const featuresCount = features.length;
  // الترتيب مقصود: حقول الهوية أولاً (واتساب · جهاز) ثم محتوى المنتج،
  // كي تعبّر رسالة الخطأ عن أول نقص فعلي لا عن لاحقه.
  // ٥) الواتساب إجباري — تصل إليه الطلبات التجريبية
  if (!/^\d{8,15}$/.test(whatsapp.replace(/[^\d]/g, ""))) return bad("bad_whatsapp");
  if (!deviceFp || deviceFp.length < 8) return bad("bad_fingerprint");
  if (!name) return bad("bad_name");
  if (!(price > 0)) return bad("bad_price");
  if (!image) return bad("bad_image");
  if (!tagline) return bad("bad_tagline");
  if (!description) return bad("bad_description");
  if (featuresCount === 0) return bad("bad_features");
  // ٦) صورة واحدة فقط (الصورة اختيارية — تُستخدم صورة بديلة إن غابت)
  if (image && image.length > 6_000_000) return bad("image_too_large");

  try {
    // ٢) حماية المشتركين: إن كان الإيميل مشتركاً أصلاً فلا تجربة
    // القراءة الصارمة: خطأ التخزين لا يعني أن البريد غير مشترك.
    const existingSub = await getKv(`subs/${email}.json`);
    if (existingSub) {
      return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
    }

    // ٣) لا سجل سابق للإيميل (حتى بعد الحرق أو الحذف)
    const byEmail = await getTrial(email);
    if (byEmail) return NextResponse.json({ error: "trial_used" }, { status: 409 });

    // ٤) لا سجل سابق للجهاز
    const byDevice = await getTrialByDevice(deviceFp);
    if (byDevice) return NextResponse.json({ error: "device_used" }, { status: 409 });

    // ٤ب) رقم الواتساب أيضاً **مرة واحدة** (منع التلاعب — قرار المالك)
    const wa = normalizeWhatsapp(whatsapp);
    const byWa = await getTrialByWhatsapp(wa);
    if (byWa) return NextResponse.json({ error: "whatsapp_used" }, { status: 409 });

    // ٤ج) شروط المالك الثلاثة: الإيميل والجهاز والرقم يجب أن تكون **جديدة**،
    //     أي لا تنتمي إلى مشترك حقيقي. كان الفحص يقتصر على `subs/` للإيميل،
    //     فيمرّ زائر برقم مشترك (بإيميل وجهاز جديدين) ويأخذ رابطاً تجريبياً.
    //
    //     استثناء واحد: **جلسة أدمن موقّعة**. المالك جهازه ورقمه مسجّلان
    //     بطبيعة الحال، فبدون هذا الاستثناء يفقد قدرته على اختبار مسار
    //     التجربة من متصفحه. الجلسة موقّعة بـ ADMIN_SESSION_SECRET فلا
    //     يُنال الاستثناء من الخارج. الاستثناء **لا** يشمل قواعد
    //     «مرة واحدة» أعلاه (لا تجربتان لنفس الإيميل/الجهاز/الرقم أبداً).
    if (!(await isAdminRequest())) {
      const conflict = await findSubscriberConflict({ email, whatsapp: wa, deviceFp });
      if (conflict === "email") return NextResponse.json({ error: "already_subscribed" }, { status: 409 });
      if (conflict === "whatsapp") return NextResponse.json({ error: "whatsapp_subscribed" }, { status: 409 });
      if (conflict === "device") return NextResponse.json({ error: "device_subscribed" }, { status: 409 });
    }

    // ٧) رمز التفعيل عبر واتساب — **شرط أساسي** لإنشاء رابط التجربة.
    //    يُطلب بالرمز، ويُربط بالإيميل + الجهاز + الواتساب معاً (لا يكفي الرمز وحده).
    //    حدّ المحاولات 5 ثم يُبطَل الرمز (منع التخمين).
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return bad("bad_code");

    const codeKey = `trial-code/${email}.json`;
    let codeRec: { code?: string; whatsapp?: string; deviceFp?: string; tries?: number; expiresAt?: string } | null = null;
    try {
      codeRec = await getKv(codeKey);
    } catch {
      return bad("storage", 502);
    }
    if (!codeRec || typeof codeRec.code !== "string") {
      return NextResponse.json({ error: "code_required" }, { status: 403 });
    }
    if (codeRec.deviceFp !== deviceFp || codeRec.whatsapp !== wa) {
      return NextResponse.json({ error: "code_mismatch" }, { status: 403 });
    }
    const codeExp = Date.parse(String(codeRec.expiresAt ?? ""));
    if (!Number.isFinite(codeExp) || codeExp <= Date.now()) {
      try { await deleteKv(codeKey); } catch { /* تنظيف اختياري */ }
      return NextResponse.json({ error: "code_expired" }, { status: 403 });
    }
    const tries = typeof codeRec.tries === "number" ? codeRec.tries : 0;
    if (tries >= 5) {
      try { await deleteKv(codeKey); } catch { /* تنظيف اختياري */ }
      return NextResponse.json({ error: "code_locked" }, { status: 429 });
    }
    if (codeRec.code !== code) {
      try { await setKv(codeKey, { ...codeRec, tries: tries + 1 }); } catch { /* عدّ اختياري */ }
      return NextResponse.json({ error: "bad_code" }, { status: 403 });
    }

    const slug = newSlug();
    // ثيم الزائر المختار في الاستوديو (معقّم خادمياً) — وإلا لوحة الصنف الجاهزة.
    const chosen = sanitizeTheme(body.theme);
    const theme = Object.keys(chosen).length
      ? normalizeTheme(chosen)
      : paletteForCategory(category);

    const product: Product = {
      id: slug,
      name,
      brand: name,
      price,
      tagline,
      description,
      features,
      badge: "تجربة",
      // صورة واحدة فقط — لا معرض
      image: image || "",
      images: [],
      theme,
      // ٥) واتساب الڤيست — داخلي (لا يظهر كزر تواصل للزائر)
      whatsapp: wa,
      category: category || null,
      // بلا sheetKey/sheetEmail/sheetWebhook ⇒ الطلبات واتساب فقط
    };

    const trialUntil = new Date(Date.now() + TRIAL_HOURS * 3600_000).toISOString();
    const meta: PublishMeta & { trialUntil?: string } = {
      owner: email,
      createdAt: new Date().toISOString(),
      listed: false,
      hidden: true, // لا يظهر في المتجر العام
      host: "vercel",
      trialUntil,
    };
    const rec = await createTrial({ email, whatsapp: wa, deviceFp, slug }, { product, meta });

    // استهلاك الرمز — يُحذف فور النجاح كي لا يُستعمل ثانيةً
    try { await deleteKv(codeKey); } catch { /* تنظيف اختياري */ }

    const origin = new URL(request.url).origin;

    return NextResponse.json({
      ok: true,
      url: `${origin}/p/${slug}`,
      slug,
      expiresAt: rec.expiresAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "trial_conflict") return bad("trial_used", 409);
    return bad("storage", 502);
  }
}
