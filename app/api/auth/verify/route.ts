import { MASTER_USERNAME } from "@/app/lib/credentials";
import {
  MAX_TRIES,
  addApprovedDevice,
  deletePendingCode,
  getDeviceOwner,
  getPendingCode,
  incrementPendingTries,
  listPendingCodes,
} from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { ensureSubscription, migrateSubscription } from "@/app/lib/subsStore";
import {
  errorResponse,
  extractJsonBody,
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  HTTP_STATUS,
} from "@/app/lib/utils/api";
import { isValidCode, isNonEmptyString } from "@/app/lib/utils/validation";
import { isExpired, nowISO } from "@/app/lib/utils/date";

export const dynamic = "force-dynamic";

interface VerifyBody {
  username?: unknown;
  code?: unknown;
  fingerprint?: unknown;
}

// إدخال رمز التفعيل من جهاز جديد → ربط البصمة بالحساب للأبد
export async function POST(request: Request) {
  const body = await extractJsonBody<VerifyBody>(request);
  if (!body) {
    return errorResponse("bad_request", HTTP_STATUS.BAD_REQUEST);
  }

  const username = String(body.username ?? "").trim();
  const code = String(body.code ?? "").trim();
  const fingerprint = String(body.fingerprint ?? "").trim();

  if (username.toLowerCase() !== MASTER_USERNAME) {
    return unauthorizedResponse("invalid_credentials");
  }
  if (!isValidCode(code)) {
    return errorResponse("invalid_code", HTTP_STATUS.BAD_REQUEST);
  }
  if (!isNonEmptyString(fingerprint) || fingerprint.length < 8) {
    return errorResponse("missing_fingerprint", HTTP_STATUS.BAD_REQUEST);
  }

  try {
    // أولاً: البحث بالبصمة الحالية (السيناريو العادي - نفس المتصفح)
    let pending = await getPendingCode(fingerprint);
    let pendingFingerprint = fingerprint;

    // ثانياً: إذا لم يوجد، البحث عن كود مطابق بنفس اسم المستخدم (السيناريو عبر متصفحات)
    // نسمح بذلك فقط للأكواد حديثة الإنشاء (أقل من 5 دقائق) لأمان إضافي
    if (!pending) {
      const allPending = await listPendingCodes();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const match = allPending.find(
        (p) => p.username === MASTER_USERNAME && p.code === code && !isExpired(p.expiresAt) && p.createdAt >= fiveMinutesAgo
      );
      if (match) {
        pending = match;
        pendingFingerprint = match.fingerprint; // البصمة الأصلية التي طلبت الكود
      }
    }

    if (!pending) {
      return notFoundResponse("no_pending");
    }
    if (isExpired(pending.expiresAt)) {
      await deletePendingCode(pendingFingerprint);
      return errorResponse("code_expired", 410);
    }
    if (pending.tries >= MAX_TRIES) {
      await deletePendingCode(pendingFingerprint);
      return errorResponse("too_many_attempts", HTTP_STATUS.TOO_MANY_REQUESTS);
    }
    if (pending.code !== code) {
      await incrementPendingTries(pendingFingerprint);
      return unauthorizedResponse("wrong_code");
    }

    // صحيح → ربط الجهاز الحالي (الذي أدخل الكود) وإلغاء الرمز
    await addApprovedDevice(fingerprint);
    await deletePendingCode(pendingFingerprint);

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

    return successResponse({ approved: true, username: MASTER_USERNAME });
  } catch (err) {
    console.error("[auth/verify] خطأ:", err);
    return errorResponse("storage", 502);
  }
}
