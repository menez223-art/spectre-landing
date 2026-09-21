// إرسال رمز تفعيل التجربة عبر واتساب — يولّد رابط wa.me يفتح محادثة
// مع رقم المستخدم ويكتب الرمز فيها (بدون WhatsApp Cloud API — مجاني).
//
// ⚠️ الأمان:
//   - الرمز يُولّد خادمياً ويُخزَّن مؤقتاً (10 دقائق) مربوطاً بالإيميل+الجهاز.
//   - لا يُعاد الرمز في الاستجابة — يُعاد فقط رابط wa.me (العميل يفتحه).
//   - حدّ إيقاع: 3 رموز/15 دقيقة لكل جهاز.

import { NextResponse } from "next/server";
import { getKv, setKv } from "@/app/lib/kvStore";
import { normalizeWhatsapp } from "@/app/lib/trialStore";

export const dynamic = "force-dynamic";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 دقائق
const RL_PREFIX = "ratelimit/trial-code/";
const RL_MAX = 3;
const RL_WINDOW = 15 * 60 * 1000;

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const n = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
  return String(100000 + (n % 900000)); // 100000-999999
}

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
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = normalizeWhatsapp(String(body.whatsapp ?? ""));
  const deviceFp = String(body.deviceFp ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }
  if (!/^\d{8,15}$/.test(whatsapp)) {
    return NextResponse.json({ error: "bad_whatsapp" }, { status: 400 });
  }
  if (!deviceFp || deviceFp.length < 8) {
    return NextResponse.json({ error: "bad_fingerprint" }, { status: 400 });
  }

  if (await hitLimit(deviceFp)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  // نخزن الرمز مربوطاً بالإيميل + الجهاز (لا نرسله في الاستجابة)
  await setKv(`trial-code/${email}.json`, {
    code,
    whatsapp,
    deviceFp,
    tries: 0,
    createdAt: new Date().toISOString(),
    expiresAt,
  });

  // نبني رابط wa.me — العميل يفتحه ليرسل الرمز للمستخدم عبر واتساب
  const text = encodeURIComponent(`رمز تفعيل تجربتك في استوديو صفحات الهبوط: ${code}`);
  const waUrl = `https://wa.me/${whatsapp}?text=${text}`;

  return NextResponse.json({ ok: true, waUrl, expiresAt });
}
