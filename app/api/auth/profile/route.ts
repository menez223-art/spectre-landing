import { NextResponse } from "next/server";
import {
  isDeviceApproved,
  getDeviceOwner,
  createManualPendingCode,
  getManualPendingCode,
  incrementManualTries,
  deleteManualPendingCode,
  MAX_TRIES,
} from "@/app/lib/authStore";
import { getProfile, saveProfile, getProfileByEmail } from "@/app/lib/profileStore";
import { reassignOwner } from "@/app/lib/publishStore";
import { createSheetForEmail, hasSheetFactory } from "@/app/lib/sheetFactory";
import { ensureSubscription, migrateSubscription } from "@/app/lib/subsStore";
import { hasEmailConfig, sendVerificationCodeEmail } from "@/app/lib/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBHOOK_RE = /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;

function badFingerprint(): NextResponse {
  return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
}

// قراءة ملف تعريف الجهاز (البريد + رابط الجدول)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) return badFingerprint();

  try {
    const profile = await getProfile(fingerprint);
    return NextResponse.json({ ok: true, profile: profile ?? null });
  } catch (err) {
    console.error("[auth/profile] خطأ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// ── دوال مساعدة لربط البريد مع المصادقة المزدوجة ──

// يُنهي ربط بريد بعد اجتياز الكودين: إعادة استخدام جدول قائم إن وُجد
// (idempotent) أو إنشاء جدول جديد، ثم يحفظ الملف وينقل الملكية والاشتراك.
async function finalizeLinkEmail(fingerprint: string, email: string): Promise<NextResponse> {
  const profile = await getProfile(fingerprint);
  // نفس البريد مربوط أصلًا على هذا الجهاز وله جدول → أعد الحالة دون إنشاء.
  // أما إن لم يوجد جدول (بعد إزالة الرابط مثلًا) فنتركه يمرّ لإنشائه أدناه.
  if (profile?.email === email && profile?.sheetUrl) {
    return NextResponse.json({ ok: true, profile });
  }

  // idempotent: إن كان البريد مربوطاً سابقاً من أي جهاز، أعِد استخدام
  // جدوله (sheetUrl/sheetId/sheetKey) دون استدعاء المصنع — حتى يتسنّى
  // للمستخدم إعادة إدخال إيميله القديم من أي جهاز دون رفض بـ factory_error.
  const existing = await getProfileByEmail(email);
  if (existing?.sheetUrl) {
    const saved = await saveProfile(fingerprint, {
      email,
      sheetUrl: existing.sheetUrl,
      sheetId: existing.sheetId,
      sheetKey: existing.sheetKey ?? null,
    });
    try {
      await reassignOwner(getDeviceOwner(fingerprint), email);
    } catch {
      // تجاهل فشل النقل
    }
    try {
      await migrateSubscription(getDeviceOwner(fingerprint), email);
      await ensureSubscription(email);
    } catch {
      // فشل التهيئة لا يوقف الربط
    }
    return NextResponse.json({ ok: true, profile: saved });
  }

  if (!hasSheetFactory()) {
    return NextResponse.json({ error: "config" }, { status: 503 });
  }
  const result = await createSheetForEmail(email);
  if (!result) {
    return NextResponse.json({ error: "factory_error" }, { status: 502 });
  }
  const saved = await saveProfile(fingerprint, {
    email,
    sheetUrl: result.url,
    sheetId: result.sheetId,
    sheetKey: result.key,
  });
  try {
    await reassignOwner(getDeviceOwner(fingerprint), email);
  } catch {
    // تجاهل فشل النقل
  }
  try {
    await migrateSubscription(getDeviceOwner(fingerprint), email);
    await ensureSubscription(email);
  } catch {
    // فشل التهيئة لا يوقف الربط
  }
  return NextResponse.json({ ok: true, profile: saved });
}

// ربط بريد (إنشاء جدول تلقائي) أو لصق رابط webhook يدوي أو مسح الربط
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const fingerprint = String(body.fingerprint ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) return badFingerprint();

  try {
    const approved = await isDeviceApproved(fingerprint);
    if (!approved) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }

  const action = String(body.action ?? "").trim();

  try {
    if (action === "link_email") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: "bad_email" }, { status: 400 });
      }
      // إن كان البريد نفسه مربوطاً أصلًا على هذا الجهاز → نعيد ربطه مباشرةً
      // دون أبواب تحقق (سواء بجدول قائم أو بعد إزالة الرابط ثم إعادة الإيميل
      // نفسه): finalizeLinkEmail تعيد استخدام الجدول إن وُجد أو تُنشئه عبر
      // المصنع (المصنع نفسه idempotent ويعيد الجدول القديم لنفس البريد).
      const profile = await getProfile(fingerprint);
      // نفس البريد مربوط أصلًا على نفس الجهاز → أعد الحالة دون أكواد (إعادة
      // إدخال نفس الإيميل على نفس المتصفح/الجهاز، بما فيه بعد إزالة الرابط ثم
      // إعادته — يُعاد إنشاء الجدول عند اللزوم). أي تغيير في المتصفح/الجهاز
      // يُنتج بصمة جديدة، فيمرّ المستخدم بكود المشرف من جديد.
      if (profile?.email === email) {
        return finalizeLinkEmail(fingerprint, email);
      }

      // — بروتوكول المصادقة المفردة (كود مشرف واحد) —
      // عند ربط إيميل جديد أو تغييره أو تغيير المتصفح/الجهاز لأول مرة، نطلب
      // كود تأكيد مكوّن من 6 أرقام يُرسَل إلى بريد الأونر (المشرف) للموافقة.
      // يُطلب في المرة الأولى فقط: بمجرد تأكيده على هذا الجهاز نثبّت
      // adminVerified=true فلا يُعاد الطلب لاحقًا على نفس الجهاز (يُعفى أيضًا
      // من هجرة الرابط القديم عبر migrate). تغيير المتصفح/الجهاز يُنتج بصمة
      // جديدة فيمرّ بالكود مجددًا (أمان كامل عبر الأجهزة).
      const adminCode = String(body.adminCode ?? "").trim();
      const migrate = Boolean(body.migrate);
      if (!profile?.adminVerified && !migrate) {
        if (!adminCode) {
          if (!hasEmailConfig()) {
            return NextResponse.json({ error: "email_config" }, { status: 503 });
          }
          const created = await createManualPendingCode(fingerprint);
          if (!created) {
            return NextResponse.json({ error: "storage" }, { status: 502 });
          }
          const sent = await sendVerificationCodeEmail(created, "link_email");
          if (!sent.ok) {
            return NextResponse.json({ error: "email_failed" }, { status: 502 });
          }
          return NextResponse.json({ ok: true, pending: true, step: "admin" });
        }
        const pending = await getManualPendingCode(fingerprint);
        if (!pending) {
          return NextResponse.json({ error: "no_pending" }, { status: 404 });
        }
        if (new Date(pending.expiresAt).getTime() < Date.now()) {
          await deleteManualPendingCode(fingerprint);
          return NextResponse.json({ error: "code_expired" }, { status: 410 });
        }
        if (pending.tries >= MAX_TRIES) {
          await deleteManualPendingCode(fingerprint);
          return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
        }
        if (pending.code !== adminCode) {
          await incrementManualTries(fingerprint);
          return NextResponse.json({ error: "wrong_admin_code" }, { status: 401 });
        }
        // كود المشرف صحيح → نحذف الرمز المعلّق ونمضي لإنهاء الربط.
        await deleteManualPendingCode(fingerprint);
        await saveProfile(fingerprint, { adminVerified: true });
      }
      return finalizeLinkEmail(fingerprint, email);
    }

    if (action === "set_webhook") {
      const sheetUrl = String(body.sheetUrl ?? "").trim();
      if (!WEBHOOK_RE.test(sheetUrl)) {
        return NextResponse.json({ error: "bad_webhook" }, { status: 400 });
      }
      const profile = await getProfile(fingerprint);
      // بروتوكول المشرف للربط اليدوي: كود واحد لبريد المشرف، مرة واحدة فقط
      // على هذا الجهاز (أول مرة). بمجرد تأكيد الكود على الجهاز يُسجَّل
      // adminVerified=true فلا يُعاد الطلب لاحقًا (لا عند استبدال الرابط
      // ولا عند مسحه وإعادة لصقه على نفس الجهاز). تغيّر المتصفح/الجهاز يُنتج
      // بصمة جديدة فيمرّ بالكود مجددًا (أمان كامل عبر الأجهزة). علم migrate
      // يُعفي هجرة الرابط القديم من localStorage على جهاز مُسجَّل أصلًا.
      const adminCode = String(body.adminCode ?? "").trim();
      const migrate = Boolean(body.migrate);
      if (!profile?.adminVerified && !migrate) {
        if (!adminCode) {
          if (!hasEmailConfig()) {
            return NextResponse.json({ error: "email_config" }, { status: 503 });
          }
          const created = await createManualPendingCode(fingerprint);
          if (!created) {
            return NextResponse.json({ error: "storage" }, { status: 502 });
          }
          const sent = await sendVerificationCodeEmail(created, "link_email");
          if (!sent.ok) {
            return NextResponse.json({ error: "email_failed" }, { status: 502 });
          }
          return NextResponse.json({ ok: true, pending: true, step: "manual" });
        }
        const pending = await getManualPendingCode(fingerprint);
        if (!pending) {
          return NextResponse.json({ error: "no_pending" }, { status: 404 });
        }
        if (new Date(pending.expiresAt).getTime() < Date.now()) {
          await deleteManualPendingCode(fingerprint);
          return NextResponse.json({ error: "code_expired" }, { status: 410 });
        }
        if (pending.tries >= MAX_TRIES) {
          await deleteManualPendingCode(fingerprint);
          return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
        }
        if (pending.code !== adminCode) {
          await incrementManualTries(fingerprint);
          return NextResponse.json({ error: "wrong_admin_code" }, { status: 401 });
        }
        // كود المشرف صحيح → نحذف الرمز المعلّق ونمضي لحفظ الرابط.
        await deleteManualPendingCode(fingerprint);
        // نُثبّت أن هذا الجهاز تحقّق مرة واحدة فلا يُعاد الطلب مستقبلًا عليه.
        await saveProfile(fingerprint, { adminVerified: true });
      }
      const saved = await saveProfile(fingerprint, { sheetUrl, email: null, sheetId: null });
      return NextResponse.json({ ok: true, profile: saved });
    }

    if (action === "clear") {
      const saved = await saveProfile(fingerprint, { email: null, sheetUrl: null, sheetId: null });
      return NextResponse.json({ ok: true, profile: saved });
    }

    // إزالة رابط الجدول فقط مع الإبقاء على البريد المربوط
    if (action === "clear_link") {
      const profile = await getProfile(fingerprint);
      const saved = await saveProfile(fingerprint, {
        email: profile?.email ?? null,
        sheetUrl: null,
        sheetId: null,
      });
      return NextResponse.json({ ok: true, profile: saved });
    }

    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  } catch (err) {
    console.error("[auth/profile] خطأ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
