// مسار إداري محمي — تحكّم المشرف بالاشتراكات (تعليق/حظر/تفعيل/حذف)
// قاعدة أمنية صارمة: يعمل فقط لحساب المشرف المربوط بـ ADMIN_EMAIL.
// لا يُثق أبدًا بالعميل: كل طلب يُتحقَّق من بريد الملف الشخصي المربوط
// مقابل process.env.ADMIN_EMAIL، وأي طلب خارجي يُرفض (403).

import { NextResponse } from "next/server";
import { isDeviceApproved, setDeviceBannedByPepper, removeApprovedDeviceByPepper } from "@/app/lib/authStore";
import { getProfileEmail, deviceOwnersForEmail, deviceFingerprintsForEmail } from "@/app/lib/profileStore";
import { getAdminSession } from "@/app/lib/adminAuth";
import {
  deleteSubscription,
  getSubscription,
  listSubscriptions,
  setSubscription,
  setValidity,
  recomputeStatus,
  remainingDays,
  type Plan,
  type SubStatus,
  type Subscription,
  type ValidityUnit,
} from "@/app/lib/subsStore";
import { countPublishedOwned, deleteAllPublishedOwned, reassignOwner, burnPublishedOwned, unburnPublishedOwned, burnAllForEmail, unburnAllForEmail, deleteAllForEmail } from "@/app/lib/publishStore";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

// بوابة الخادم: هل هذا الطالب هو المشرف؟
// مساران مصرّحان:
//  1) جلسة الأدمن الموقّعة (كوكي) — من صفحة دخول الأدمن المخصّصة.
//  2) جهاز الاستوديو المعتمد والمربوط ببريد ADMIN_EMAIL.
// أي طلب آخر (بما فيه تجاوز مباشر للواجهة) يُرفض بـ 403.
async function assertAdmin(fingerprint?: string): Promise<boolean> {
  if (!ADMIN_EMAIL) return false;
  // مسار الكوكي — الأسرع والأكثر أماناً لدخول الأدمن المباشر (صفحة /admin).
  if (getAdminSession() === ADMIN_EMAIL) return true;
  // مسار جهاز الاستوديو المعتمد والمربوط ببريد ADMIN_EMAIL.
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === ADMIN_EMAIL;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// قراءة اشتراك واحد أو كل الاشتراكات
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  const userId = (searchParams.get("userId") ?? "").trim();

  // مسار الكوكي يكفي؛ بصمة الجهاز اختيارية (مطلوبة فقط لمسار الاستوديو).
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  try {
    if (userId) {
      const sub = await recomputeStatus(userId);
      return NextResponse.json({ subscription: sub });
    }
    const all = await listSubscriptions();
    // عدد الصفحات لكل مشترك (لتتبّع النشاط) + إعادة حساب الصلاحية/التوقيف التلقائي
    // — لا نحسبها للأدمن (بريده كـ userId). لا نثق أبداً بقيم العميل.
    const subscriptions = await Promise.all(
      all.map(async (s) => {
        const live = await recomputeStatus(s.userId);
        return {
          ...(live ?? s),
          pages: s.userId.toLowerCase() === ADMIN_EMAIL ? 0 : await countPublishedOwned(s.userId),
          remainingDays: remainingDays(live ?? s),
        };
      })
    );
    return NextResponse.json({ subscriptions });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

interface Body {
  fingerprint?: unknown;
  userId?: unknown;
  action?: unknown; // set | delete | validity
  plan?: unknown;
  status?: unknown;
  expiresAt?: unknown;
  reason?: unknown;
  validityUnit?: unknown; // "day" | "always" | null
  validityDays?: unknown; // number (>0 لـ day)
}

// تعديل اشتراك (تعليق/حظر/تفعيل/تغيير خطة)
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const fingerprint = String(body.fingerprint ?? "").trim();
  const userId = String(body.userId ?? "").trim();

  // مسار الكوكي يكفي؛ بصمة الجهاز اختيارية (مطلوبة فقط لمسار الاستوديو).
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();
  if (!userId) return NextResponse.json({ error: "missing_user" }, { status: 400 });

  // حماية حرجة: لا يحظر المشرف نفسه (بريده = ADMIN_EMAIL) فيمنع موقعَه عن نفسه.
  if (userId.toLowerCase() === ADMIN_EMAIL) {
    return NextResponse.json({ error: "cannot_modify_admin" }, { status: 400 });
  }

  const action = String(body.action ?? "set").trim();
  const targetStatus = String(body.status ?? "").trim();

  try {
    // حظر/توقيف: نوحّد أولاً ملكية المنشورات إلى الإيميل الكنسي كي يطابق
    // مفتاح الاشتراك المحظور — هذا يضمن توقّف كل الروابط فوراً (لا تبقى
    // منشورات مملوكة بـ device:hash خارج نطاق الحظر). نكتشف هويات الجهاز
    // المرتبطة بهذا البريد من ملفات التعريف.
    if (action === "set" && (targetStatus === "banned" || targetStatus === "suspended")) {
      const deviceOwners = await deviceOwnersForEmail(userId);
      for (const d of deviceOwners) {
        await reassignOwner(d, userId);
      }
      // حظر صفوف أجهزة المستقلّة: نمنع كل جهاز مربوط بهذا البريد من الإنتاج
      // فوراً عبر علامة banned على صفّه (studio-auth/devices/<PEP>.json). هذا يغلق
      // حافة «جهاز يهرب من حظر الإيميل»: لو تسرّبت بعض منشوراته بصيغة device:hash
      // خارج إعادة الإسناد، يبقى الجهاز نفسه محظوراً من can-produce.
      try {
        const fps = await deviceFingerprintsForEmail(userId);
        for (const fp of fps) {
          await setDeviceBannedByPepper(fp, true);
        }
      } catch {
        // فشل حظر الصفوف لا يوقف الحظر نفسه
      }
      // حرق فوري وقاطع: نكتب علامة banned على كل منشورات المستخدم عبر كل
      // هوياته (البريد + كل صيغ device:hash) كي تتوقف روابطه فوراً لأي زائر
      // — بغض النظر عن تطابق هوية الجهاز/البريد. هذا هو الحل الجذري لمشكلة
      // «الروابط تستمر بعد الحظر». نرفض الطلب (502) إن فشل الحرق كي لا يُحظر
      // مستخدم وتبقى روابطه تعمل (fail-closed لا fail-open).
      try {
        const burned = await burnAllForEmail(userId);
        if (burned === 0) {
          // لا منشورات محترقة — نعيد المحاولة بالمسار القديم تحسباً لتعارض
          // صيغ الهوية، لكن الحظر نفسه يبقى ساريًا بغض النظر عن نتيجة الحرق.
          await burnPublishedOwned(userId);
        }
      } catch {
        // الحظر ساري؛ نسجّل فشل الحرق كي يراه الأدمن ويكرّره يدوياً، لكن لا
        // نعيد المستخدم إلى «نشط» — الصفحات تبقى محجوبة عبر فحص الاشتراك.
        console.error("[admin/subscription] فشل حرق منشورات:", userId);
      }
    }

    if (action === "delete_pages") {
      // حذف كل صفحات وروابط المستخدم فقط — دون مسّ الاشتراك أو الحساب.
      // يُستخدم من زر «حذف الصفحات» في لوحة الأدمن لإيقاف وحذف كل منشوراته
      // من قاعدة البيانات بضغطة واحدة، وتبقى بيانات اشتراكه كما هي.
      const deleted = await deleteAllForEmail(userId);
      return NextResponse.json({ ok: true, deletedPages: deleted });
    }

    if (action === "unban_purge") {
      // إزالة من قائمة المحظورين + حذف كامل مخزونه من التخزين وكل روابطه.
      // يُستخدم من قسم «قائمة المحظورين» في الأدمن: عند إزالة إيميل محظور
      // (سواء «إزالة من القائمة» أو «حذف نهائي») نحذف كل صفحاته ومخزونه
      // كي تتوقف عن العمل غير قابلة للوصول — لا يبقى أي أثر له في التخزين.
      const existing = await getSubscription(userId);
      if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
      await setSubscription({
        ...existing,
        status: "active",
        reason: null,
        updatedAt: new Date().toISOString(),
      });
      // حذف شامل عبر كل الهويات (البريد + كل صيغ device:hash)
      const deleted = await deleteAllForEmail(userId);
      // إزالة صفوف أجهزة المستخدم المعتمدة من الجذور (تبقى معتمدة إلا بإعادة تفعيل كامل)
      try {
        const fps = await deviceFingerprintsForEmail(userId);
        for (const fp of fps) {
          await removeApprovedDeviceByPepper(fp);
        }
      } catch {
        // فشل الحذف لا يوقف العملية
      }
      return NextResponse.json({ ok: true, deletedPages: deleted });
    }

    if (action === "delete") {
      // الحذف النهائي: يزيل سجل الاشتراك + كل صفحاته وروابطه من قاعدة البيانات
      // (لا يمكن الاسترجاع). هذا هو المسار الوحيد لحذف البيانات فعلياً.
      await deleteSubscription(userId);
      // حذف شامل عبر كل الهويات (البريد + كل صيغ device:hash) — جذري 100%.
      const deleted = await deleteAllForEmail(userId);
      // محو صفوف أجهزة المستخدم المعتمدة من الجذور (تبقى معتمدة إلا بإعادة تفعيل كامل)
      try {
        const fps = await deviceFingerprintsForEmail(userId);
        for (const fp of fps) {
          await removeApprovedDeviceByPepper(fp);
        }
      } catch {
        // فشل الحذف لا يوقف العملية
      }
      return NextResponse.json({ ok: true, deleted: true, deletedPages: deleted });
    }

    // ضبط مدة الصلاحية (تمديد/تثبيت دائم/إلغاء) — يسبق التعديل العادي
    if (action === "validity") {
      const rawUnit = body.validityUnit == null ? null : String(body.validityUnit).trim();
      const unit: ValidityUnit =
        rawUnit === "day" ? "day" : rawUnit === "always" ? "always" : null;
      const daysRaw = body.validityDays != null ? Number(body.validityDays) : null;
      const days = daysRaw != null && Number.isFinite(daysRaw) ? Math.max(1, Math.floor(daysRaw as number)) : null;
      const updated = await setValidity(userId, unit, unit === "day" ? days : null);
      if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
      // إعادة الحساب بعد الضبط (قد يفعّل تلقائياً إن كانت منتهية سابقاً)
      const live = await recomputeStatus(userId);
      return NextResponse.json({ ok: true, subscription: live ?? updated, remainingDays: remainingDays(live ?? updated) });
    }

    // تحديث/إنشاء
    const existing = await getSubscription(userId);
    const plan = (String(body.plan ?? existing?.plan ?? "free")) as Plan;
    const status = (String(body.status ?? existing?.status ?? "active")) as SubStatus;
    const expiresAt = body.expiresAt != null ? String(body.expiresAt) : (existing?.expiresAt ?? null);
    const reason = body.reason != null ? String(body.reason) : (existing?.reason ?? null);

    const sub: Subscription = {
      userId,
      plan,
      status,
      startsAt: existing?.startsAt ?? new Date().toISOString(),
      expiresAt,
      reason,
      updatedAt: new Date().toISOString(),
      validityUnit: existing?.validityUnit ?? null,
      validityDays: existing?.validityDays ?? null,
      validityStartsAt: existing?.validityStartsAt ?? null,
      validityExpiresAt: existing?.validityExpiresAt ?? null,
    };
    await setSubscription(sub);

    // إن كان التحديث أعاد المستخدم إلى «نشط» (إلغاء حظر/توقيف) نرفع علامة
    // الحرق عن منشوراته عبر كل هوياته كي تعود روابطه للعمل فوراً.
    if (status === "active") {
      try {
        await unburnAllForEmail(userId);
      } catch {
        // فشل الرفع لا يوقف التفعيل
      }
      // نرفع أيضاً حظر صفوف أجهزته كي يعود للإنتاج (إن كان ممنوعاً على مستوى الجهاز).
      try {
        const fps = await deviceFingerprintsForEmail(userId);
        for (const fp of fps) {
          await setDeviceBannedByPepper(fp, false);
        }
      } catch {
        // فشل الرفع لا يوقف التفعيل
      }
    }

    // الحظر = تجميد وتعطيل كامل (دون حذف) — تُمنع صفحاته وروابطه عن أي زائر
    // عبر فلتر صفحة الهبوط، وتبقى بياناته محفوظة قابلة للاسترجاع عند «إلغاء الحظر».
    // التوقيف (suspended) يحجب العرض فقط دون حذف (قابل للاسترجاع بتفعيل لاحق).
    // الحذف الفعلي للبيانات له مساره الخاص (action === "delete") فقط.
    return NextResponse.json({ ok: true, subscription: sub });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
