// التحقق المسبق من رمز التفعيل — زر «تأكيد الرمز» في لوحة التجربة.
//
// يجيب عن سؤال الزائر «هل الرمز الذي أدخلته صحيح؟» **قبل** ضغطة إنشاء الرابط،
// بنفس الحكم الذي سيطبّقه مسار الإنشاء (`checkTrialCodeRecord` — مصدر واحد).
//
// ⚠️ ضمانات ضد الاستغلال كمرآة استعلام:
//   - يتطلب الثلاثية كاملة (إيميل + بصمة جهاز + رقم) — لا يكفي تخمين الرمز وحده.
//   - حدّ إيقاع مستقل: 10 فحوصات / 10 دقائق لكل جهاز (فوق حدّ الإنشاء: 5 محاولات
//     خاطئة تُبطل الرمز) — التنقيب عن 6 أرقام عبر هذه المرآة غير عملي.
//   - لا يستهلك الرمز ولا يزيد العدّاد ولا يحذف شيئاً — قراءة صرفة (فحص واحد).
//   - الرمز يعيش 10 دقائق فقط ثم يُستهلك عند أول إنشاء ناجح.

import { NextResponse } from "next/server";
import { getKv, setKv } from "@/app/lib/kvStore";
import { checkTrialCodeRecord, normalizeWhatsapp } from "@/app/lib/trialStore";

export const dynamic = "force-dynamic";

const RL_PREFIX = "ratelimit/trial-verify/";
const RL_MAX = 10;
const RL_WINDOW = 10 * 60 * 1000;

async function hitLimit(key: string): Promise<boolean> {
  try {
    const k = `${RL_PREFIX}${key}.json`;
    const now = Date.now();
    const cur = await getKv<{ c?: number; t?: number }>(k);
    if (!cur || typeof cur.t !== "number" || now - cur.t > RL_WINDOW) {
      await setKv(k, { c: 1, t: now });
      return false;
    }
    const next = (typeof cur.c === "number" ? cur.c : 0) + 1;
    await setKv(k, { c: next, t: cur.t });
    return next > RL_MAX;
  } catch {
    // fail-open مقصود (نفس نمط auth/login): عطل عدّاد الإيقاع لا يجب
    // أن يحجب المستخدم الشرعي — الحماية الجوهرية (قفل الرمز بعد 5
    // محاولات خاطئة) تبقى fail-closed في checkTrialCodeRecord.
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = normalizeWhatsapp(String(body.whatsapp ?? ""));
  const deviceFp = String(body.deviceFp ?? "").trim();
  const code = String(body.code ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }
  if (!/^\d{8,15}$/.test(whatsapp)) {
    return NextResponse.json({ error: "bad_whatsapp" }, { status: 400 });
  }
  if (!deviceFp || deviceFp.length < 8) {
    return NextResponse.json({ error: "bad_fingerprint" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  if (await hitLimit(deviceFp)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let codeRec: { code?: string; whatsapp?: string; deviceFp?: string; tries?: number; expiresAt?: string } | null = null;
  try {
    codeRec = await getKv(`trial-code/${email}.json`);
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const verdict = checkTrialCodeRecord(codeRec, { code, deviceFp, whatsapp });
  if (!verdict.ok) {
    // نفس رموز مسار الإنشاء — العميل يعرض رسالته لكل حالة.
    // `code_locked` وحده 429 (مطابق للإنشاء)؛ البقية 403.
    return NextResponse.json(
      { error: verdict.error },
      { status: verdict.error === "code_locked" ? 429 : 403 },
    );
  }
  return NextResponse.json({ ok: true });
}
