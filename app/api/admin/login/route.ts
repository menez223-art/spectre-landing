import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  signAdminSession,
  verifyAdminCredentials,
} from "@/app/lib/adminAuth";
import { getKv, setKv } from "@/app/lib/kvStore";

export const dynamic = "force-dynamic";

// ── حدّ إيقاع لمحاولات دخول الأدمن (5 محاولات / 15 دقيقة لكل IP) ──
// لوحة الأدمن كانت سطح قصف غير محدود (brute-force). العدّاد في KV
// «أفضل جهد»: عطل التخزين لا يحجب المشرف الشرعي.
const RL_ADMIN_PREFIX = "ratelimit/admin-login/";
const RL_ADMIN_MAX = 5;
const RL_ADMIN_WINDOW = 15 * 60_000;

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  return (request.headers.get("x-real-ip") ?? "unknown").trim();
}

async function hitAdminLimit(ip: string): Promise<boolean> {
  try {
    const key = `${RL_ADMIN_PREFIX}${ip}.json`;
    const now = Date.now();
    const cur = await getKv<{ c?: number; t?: number }>(key);
    if (!cur || typeof cur.t !== "number" || now - cur.t > RL_ADMIN_WINDOW) {
      await setKv(key, { c: 1, t: now });
      return false;
    }
    const next = (typeof cur.c === "number" ? cur.c : 0) + 1;
    await setKv(key, { c: next, t: cur.t });
    return next > RL_ADMIN_MAX;
  } catch {
    // فشل العدّاد لا يعاقب المشرف الشرعي
    return false;
  }
}

// دخول الأدمن عبر البريد + كلمة المرور. يضع جلسة موقّعة httpOnly cookie.
// البريد والكلمة يُتحقَّق منهما خادمياً فقط — لا تُصدَّق أي بيانات من العميل.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (await hitAdminLimit(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // التحقق من البيانات (تجاوز KV أولاً، ثم env)
  const isValid = await verifyAdminCredentials(email, password);
  if (!isValid) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const token = signAdminSession(email);
  const res = NextResponse.json({ ok: true, email: email.toLowerCase() });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
  return res;
}

// تسجيل الخروج من جلسة الأدمن.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { ...adminCookieOptions(), maxAge: 0 });
  return res;
}
