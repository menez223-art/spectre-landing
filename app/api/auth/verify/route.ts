import { NextResponse } from "next/server";
import { MASTER_USERNAME } from "@/app/lib/credentials";
import {
  MAX_TRIES,
  addApprovedDevice,
  deletePendingCode,
  getDeviceOwner,
  getPendingCode,
  incrementPendingTries,
} from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { ensureSubscription, migrateSubscription } from "@/app/lib/subsStore";

export const dynamic = "force-dynamic";

interface VerifyBody {
  username?: unknown;
  code?: unknown;
  fingerprint?: unknown;
}

// إدخال رمز التفعيل من جهاز جديد → ربط البصمة بالحساب للأبد
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as VerifyBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const code = String(body.code ?? "").trim();
  const fingerprint = String(body.fingerprint ?? "").trim();

  if (username.toLowerCase() !== MASTER_USERNAME) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  try {
    const pending = await getPendingCode(fingerprint);
    if (!pending) {
      return NextResponse.json({ error: "no_pending" }, { status: 404 });
    }
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await deletePendingCode(fingerprint);
      return NextResponse.json({ error: "code_expired" }, { status: 410 });
    }
    if (pending.tries >= MAX_TRIES) {
      await deletePendingCode(fingerprint);
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }
    if (pending.code !== code) {
      await incrementPendingTries(fingerprint);
      return NextResponse.json({ error: "wrong_code" }, { status: 401 });
    }

    // صحيح → ربط الجهاز وإلغاء الرمز
    await addApprovedDevice(fingerprint);
    await deletePendingCode(fingerprint);

    // ضمان ظهور المشترك في لوحة الأدمن: إن وُجد بريد مربوط استخدمه، وإلا هوية الجهاز.
    try {
      const email = await getProfileEmail(fingerprint);
      const userId = email ?? getDeviceOwner(fingerprint);
      if (email) {
        await migrateSubscription(getDeviceOwner(fingerprint), email);
      }
      await ensureSubscription(userId);
    } catch {
      // فشل التهيئة لا يوقف اعتماد الجهاز
    }

    return NextResponse.json({ ok: true, approved: true, username: MASTER_USERNAME });
  } catch (err) {
    console.error("[auth/verify] خطأ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
