// لوحة الأدمن — «بيانات الدخول»: تغيير اسم/كلمة دخول الاستوديو وبريد/كلمة الأدمن.
//
// GET  : حالة التجاوزات فقط (overridden: boolean) — **لا تُرجع أي قيمة سرية**.
// POST : حفظ تجاوز أو حذفه (action: "save_studio" | "save_admin" | "reset_studio" | "reset_admin").
//
// ⚠️ الأمان:
//   - كل استجابة تمرّ ببوابة assertAdminSession (جلسة الأدمن الموقّعة فقط).
//   - لا يُعاد أي سرّ للعميل إطلاقاً — حتى للأدمن نفسه (يكتبه ولا يقرأه).
//   - الحد الأدنى للطول 6 أحرف يمنع كلمات ضعيفة.

import { NextResponse } from "next/server";
import { assertAdminSession, getAdminEmail } from "@/app/lib/adminAuth";
import {
  clearAdminOverride,
  clearStudioOverride,
  getCredentialStatus,
  setAdminOverride,
  setStudioOverride,
} from "@/app/lib/credentialOverrides";

export const dynamic = "force-dynamic";

const MIN_LEN = 6;

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// GET — حالة فقط، بلا أي سرّ.
export async function GET() {
  if (!(await assertAdminSession())) return forbidden();
  try {
    const [status, adminEmail] = await Promise.all([getCredentialStatus(), getAdminEmail()]);
    return NextResponse.json({
      studio: status.studio,
      admin: { ...status.admin, email: adminEmail },
    });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// POST — حفظ/حذف تجاوز.
export async function POST(request: Request) {
  if (!(await assertAdminSession())) return forbidden();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return bad("invalid_json");

  const action = String(body.action ?? "").trim();

  try {
    // ── الاستوديو ──
    if (action === "save_studio") {
      const username = String(body.username ?? "").trim();
      const password = String(body.password ?? "");
      if (!username) return bad("bad_username");
      if (username.length < 3) return bad("short_username");
      if (password.length < MIN_LEN) return bad("short_password");
      await setStudioOverride({ username, password });
      return NextResponse.json({ ok: true, overridden: true });
    }
    if (action === "reset_studio") {
      await clearStudioOverride();
      return NextResponse.json({ ok: true, overridden: false });
    }

    // ── الأدمن ─
    if (action === "save_admin") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("bad_email");
      if (password.length < MIN_LEN) return bad("short_password");
      await setAdminOverride({ email, password });
      return NextResponse.json({ ok: true, overridden: true });
    }
    if (action === "reset_admin") {
      await clearAdminOverride();
      return NextResponse.json({ ok: true, overridden: false });
    }

    return bad("unknown_action");
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}