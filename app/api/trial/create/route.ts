// إنشاء رابط تجربة الڤيست — «مرة واحدة للأبد» لكل إيميل ولكل جهاز.
//
// الشروط بالترتيب (حسب docs/SPEC-guest-trial.md §6.1):
//   1) إيميل صالح · 2) ليس مشتركاً أصلاً (حماية المشتركين) · 3) لا سجل سابق للإيميل
//   4) لا سجل سابق للجهاز · 5) رقم واتساب إجباري · 6) صورة واحدة فقط
//
// الناتج: منتج منشور بلا sheet وبلا GitHub + trialUntil بعد 24 ساعة + سجل تجربة.

import { NextResponse } from "next/server";
import { hasPublishStore } from "@/app/lib/publishStore";
import { getKv } from "@/app/lib/kvStore";
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
