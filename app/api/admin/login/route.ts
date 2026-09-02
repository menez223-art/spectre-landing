import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  signAdminSession,
  verifyAdminCredentials,
} from "@/app/lib/adminAuth";

export const dynamic = "force-dynamic";

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

  if (!verifyAdminCredentials(email, password)) {
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
