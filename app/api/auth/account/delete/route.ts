// إلغاء اشتراك بمبادرة المستخدم — يحذف كل بياناته وروابطه نهائياً.
// الجهاز لا يُحظر: يمكن للمستخدم إنشاء حساب جديد من نفس المتصفح مستقبلاً.
// تأكيد الهوية عبر مطابقة البريد (case-insensitive + trim).

import { NextResponse } from "next/server";
import {
  isDeviceApprovedOnly,
  isDeviceBanned,
  pepperFingerprint,
  removeApprovedDeviceByPepper,
  deletePendingCode,
  deleteManualPendingCode,
} from "@/app/lib/authStore";
import { getProfileEmail, deleteProfile } from "@/app/lib/profileStore";
import { deleteAllForEmail } from "@/app/lib/publishStore";
import { deleteSubscriptionAllForEmail } from "@/app/lib/subsStore";

export const dynamic = "force-dynamic";

interface DeleteAccountBody {
  fingerprint?: unknown;
  confirmEmail?: unknown;
}

// تسلسل الحذف — كل خطوة معزولة في try/catch (لا فشل جزئي يوقف اللاحقة).
// لا يحظر الجهاز (قرار المستخدم صراحةً).
async function purgeAccountForEmail(
  email: string,
  rawFingerprint: string
): Promise<{ published: number; subscriptions: number; device: boolean; profile: boolean; codes: boolean }> {
  const results = { published: 0, subscriptions: 0, device: false, profile: false, codes: false };
  // 1) كل منشورات المالك (المنتجات + الميتا) عبر كل هوياته
  try {
    results.published = await deleteAllForEmail(email);
  } catch (err) {
    console.error("[purge] فشل حذف المنشورات:", err);
  }
  // 2) كل صفوف الاشتراك عبر كل هوياته
  try {
    results.subscriptions = await deleteSubscriptionAllForEmail(email);
  } catch (err) {
    console.error("[purge] فشل حذف الاشتراك:", err);
  }
  // 3) صف الجهاز المعتمد (يحذف من المصفوفة القديمة أيضاً)
  try {
    const fp = pepperFingerprint(rawFingerprint);
    await removeApprovedDeviceByPepper(fp);
    results.device = true;
  } catch (err) {
    console.error("[purge] فشل حذف صف الجهاز:", err);
  }
  // 4) ملف التعريف (البريد + البيكسل + الواتساب + اسم المتجر + الجدول)
  try {
    await deleteProfile(rawFingerprint);
    results.profile = true;
  } catch (err) {
    console.error("[purge] فشل حذف ملف التعريف:", err);
  }
  // 5) رموز الدخول/الربط المعلّقة على هذا الجهاز
  try {
    await deletePendingCode(rawFingerprint);
    await deleteManualPendingCode(rawFingerprint);
    results.codes = true;
  } catch (err) {
    console.error("[purge] فشل حذف الرموز:", err);
  }
  return results;
}

export async function POST(request: Request) {
  let body: DeleteAccountBody;
  try {
    body = (await request.json()) as DeleteAccountBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
  const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";

  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }
  if (!confirmEmail) {
    return NextResponse.json({ error: "missing_confirm_email" }, { status: 400 });
  }

  try {
    const approved = await isDeviceApprovedOnly(fingerprint);
    if (!approved) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const banned = await isDeviceBanned(fingerprint);
    if (banned) {
      return NextResponse.json({ error: "banned" }, { status: 403 });
    }
    const email = await getProfileEmail(fingerprint);
    if (!email) {
      return NextResponse.json({ error: "no_email" }, { status: 403 });
    }
    if (email.trim().toLowerCase() !== confirmEmail) {
      return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
    }

    const result = await purgeAccountForEmail(email, fingerprint);
    return NextResponse.json({ ok: true, purged: result });
  } catch (err) {
    console.error("[account/delete] فشل تنظيف الحساب:", err);
    return NextResponse.json({ error: "purge_failed" }, { status: 500 });
  }
}
