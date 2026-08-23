import { MASTER_USERNAME, MASTER_PASSWORD } from "@/app/lib/credentials";
import {
  addApprovedDevice,
  createPendingCode,
  ensureAccount,
  getDeviceOwner,
  getPendingCode,
  isDeviceApproved,
  isDeviceBanned,
} from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { recomputeStatus } from "@/app/lib/subsStore";
import { hasEmailConfig, sendVerificationCodeEmail } from "@/app/lib/email";
import {
  errorResponse,
  extractJsonBody,
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  HTTP_STATUS,
} from "@/app/lib/utils/api";
import { isNonEmptyString } from "@/app/lib/utils/validation";
import { isExpired, nowISO } from "@/app/lib/utils/date";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

interface LoginBody {
  username?: unknown;
  password?: unknown;
  fingerprint?: unknown;
}

// تسجيل الدخول الموحّد + كشف الجهاز الجديد
// - بيانات صحيحة + جهاز معتمد → دخول مباشر
// - بيانات صحيحة + جهاز جديد → يُنشأ رمز ويُرسل لبريد المشرف (لا يُرى من العميل)
// - أول جهاز في النظام يُعتمد تلقائيًا (حتى لا تُقفل نفسك)
// - اقتراح 2: مستخدم محظور (إيميل/جهاز) يُمنع تمامًا برسالة «banned» — يُستثنى
//   المشرف (ADMIN_EMAIL) دائمًا كي يبقى الدخول متاحًا لإدارة النظام.
export async function POST(request: Request) {
  const body = await extractJsonBody<LoginBody>(request);
  if (!body) {
    return errorResponse("bad_request", HTTP_STATUS.BAD_REQUEST);
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const fingerprint = String(body.fingerprint ?? "").trim();

  if (username.toLowerCase() !== MASTER_USERNAME || password !== MASTER_PASSWORD) {
    return unauthorizedResponse("invalid_credentials");
  }
  if (!isNonEmptyString(fingerprint) || fingerprint.length < 8) {
    return errorResponse("missing_fingerprint", HTTP_STATUS.BAD_REQUEST);
  }

  // فحص الحظر الشامل (اقتراح 2): إيميل محظور أو صفّ جهاز محظور → يُمنع الدخول.
  // نُستثني المشرف (بريده يطابق ADMIN_EMAIL) كي لا يُغلق النظام على نفسه.
  const email = await getProfileEmail(fingerprint);
  const isAdminUser = Boolean(email) && email!.toLowerCase() === ADMIN_EMAIL;
  if (!isAdminUser) {
    // حظر صفّ الجهاز المستقل — يشمل الأجهزة التي ليس لها إيميل مربوط
    // (هوية device:<hash> فقط) فيُمنع من الدخول فوراً رغم غياب البريد.
    let deviceBanned = false;
    try {
      deviceBanned = await isDeviceBanned(fingerprint);
    } catch {
      // فشل القراءة → نفترض غير محظور (لا نمنع الدخول بسبب خطأ تخزين)
    }
    if (deviceBanned) {
      return forbiddenResponse("banned");
    }
    // حظر الاشتراك (إيميل محظور أو هوية الجهاز محظورة) عبر مفتاح الكنسي.
    const subUserId = email ?? getDeviceOwner(fingerprint);
    try {
      const sub = await recomputeStatus(subUserId);
      if (sub && sub.status === "banned") {
        return forbiddenResponse("banned");
      }
    } catch {
      // فشل القراءة → نفترض غير محظور (لا نمنع الدخول بسبب خطأ تخزين)
    }
  }

  try {
    const account = await ensureAccount();

    // أول جهاز يُعتمد تلقائيًا
    if (account.devices.length === 0) {
      await addApprovedDevice(fingerprint);
      return successResponse({ approved: true, username: MASTER_USERNAME });
    }

    // جهاز معتمد → دخول مباشر
    if (await isDeviceApproved(fingerprint)) {
      return successResponse({ approved: true, username: MASTER_USERNAME });
    }

    // جهاز جديد: رمز معلّق وصالح → لا نرسل بريدًا جديدًا (تفادي تكرار الإزعاج)
    const pending = await getPendingCode(fingerprint);
    if (pending && !isExpired(pending.expiresAt)) {
      return successResponse({ approved: false, codeRequestedAt: pending.createdAt });
    }

    // لا رمز أو منتهٍ → ننشئ رمزًا ونرسله لبريد المشرف
    const code = await createPendingCode(fingerprint);
    if (!code) {
      return errorResponse("storage", 502);
    }

    if (!hasEmailConfig()) {
      return errorResponse("email_config", 503);
    }
    const sent = await sendVerificationCodeEmail(code);
    if (!sent.ok) {
      return errorResponse("email_failed", 502);
    }

    return successResponse({ approved: false, codeRequestedAt: nowISO() });
  } catch (err) {
    console.error("[auth/login] خطأ:", err);
    return errorResponse("storage", 502);
  }
}
