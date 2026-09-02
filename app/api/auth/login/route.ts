// مقارنة ثابتة زمنياً (timing-safe equal) لحماية من تسريب البادئات عبر توقيت الاستجابة.
import { timingSafeEqual } from "crypto";
import { MASTER_USERNAME, MASTER_PASSWORD } from "@/app/lib/credentials";
import {
  addApprovedDevice,
  createPendingCode,
  getDeviceOwner,
  getPendingCode,
  hasAnyApprovedDevice,
  isDeviceApproved,
  isDeviceBanned,
  pepperFingerprint,
} from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { recomputeStatus } from "@/app/lib/subsStore";
import { hasEmailConfig, sendVerificationCodeEmail } from "@/app/lib/email";
import { getKv, setKv } from "@/app/lib/kvStore";
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

// ── حدّ إيقاع لكل بصمة (KV — أفضل جهد، لا يحجب الشرعيين عند عطب التخزين) ──
// غرضه الأساسي: منع قصف بريد المشرف برموز تحقق متكررة باستغلال بيانات
// الدخول العامة (project/SPECTRE ظاهرة في حزمة العميل بحكم التصميم).
const RL_FLOOD_PREFIX = "ratelimit/login-flood/"; // طلبات الدخول عموماً
const RL_SEND_PREFIX = "ratelimit/login-send/"; // إنشاء رموز جديدة وإرسالها

async function hitLimit(
  prefix: string,
  rawFp: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  try {
    const key = `${prefix}${pepperFingerprint(rawFp)}.json`;
    const now = Date.now();
    const cur = await getKv<{ c?: number; t?: number }>(key);
    if (!cur || typeof cur.t !== "number" || now - cur.t > windowMs) {
      await setKv(key, { c: 1, t: now });
      return false;
    }
    const next = (typeof cur.c === "number" ? cur.c : 0) + 1;
    await setKv(key, { c: next, t: cur.t });
    return next > max;
  } catch {
    // فشل العدّاد لا يجب أن يعاقب المستخدم الشرعي
    return false;
  }
}

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

  if (username.toLowerCase() !== MASTER_USERNAME) {
    return unauthorizedResponse("invalid_credentials");
  }
  // مقارنة كلمة المرور بـ timingSafeEqual لمنع تسريب البادئات عبر التوقيت.
  // حارس الطول يمنع رمي ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH (نفس النمط في adminAuth).
  const expected = Buffer.from(MASTER_PASSWORD, "utf-8");
  const provided = Buffer.from(password, "utf-8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return unauthorizedResponse("invalid_credentials");
  }
  if (!isNonEmptyString(fingerprint) || fingerprint.length < 8) {
    return errorResponse("missing_fingerprint", HTTP_STATUS.BAD_REQUEST);
  }

  // حدّ الإيقاع العام: 30 طلب دخول/دقيقة لكل بصمة كحدّ أقصى
  if (await hitLimit(RL_FLOOD_PREFIX, fingerprint, 30, 60_000)) {
    return errorResponse("rate_limited", HTTP_STATUS.TOO_MANY_REQUESTS);
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
    // أول جهاز يُعتمد تلقائياً — فقط إذا لم يوجد أي جهاز معتمد في كامل
    // النظام (الصفوف المستقلة أو المصفوفة القديمة). الفحص المزدوج fail-closed
    // يغلق ثغرة «فقدان سجل الحساب ⇒ اعتماد تلقائي لأول مَن يعرف الباص».
    if (!(await hasAnyApprovedDevice())) {
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

    // حدّ إرسال الرموز: 3 رموز كحدّ أقصى كل 15 دقيقة لكل بصمة
    if (await hitLimit(RL_SEND_PREFIX, fingerprint, 3, 15 * 60_000)) {
      return errorResponse("too_many_code_requests", HTTP_STATUS.TOO_MANY_REQUESTS);
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
