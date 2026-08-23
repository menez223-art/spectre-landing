import { NextResponse } from "next/server";
import { ensureAccount, isDeviceApproved, isDeviceBanned, getDeviceOwner } from "@/app/lib/authStore";
import { getProfile, getProfileEmail } from "@/app/lib/profileStore";
import { reassignOwner } from "@/app/lib/publishStore";
import { getSubscription, ensureSubscription, recomputeStatus, remainingDays, reconcileSubscription } from "@/app/lib/subsStore";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

// فحص حالة الجهاز عند فتح الاستوديو — معتمد؟ يُعرض المحتوى، وإلا فالعميل يعرض تسجيل الدخول.
// كما يتحقّق من حالة اشتراك المستخدم: محظور/موقوف/منتهٍ → يُمنع الدخول حتى لو الجهاز معتمد.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();

  // منع تخزين حالة الجهاز مؤقتًا على الحافة — تُقرأ دائمًا من المصدر.
  const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate" };

  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ ok: true, approved: false }, { status: 400, headers: noStore });
  }

  try {
    const approved = await isDeviceApproved(fingerprint);
    if (!approved) {
      // اقتراح 2: تمييز «جهاز محظور على صفّه المستقل» (بما فيه الأجهزة بلا إيميل،
      // أو جهاز معتمد حُظر لاحقاً) عن «غير معتمد أصلاً». المحظور يُرجع blocked:true
      // كي يطرده AuthGate إلى الرئيسية، لا أن يعرض له شاشة تفعيل الرمز.
      // نُستثني المشرف (ADMIN_EMAIL) كي لا يُقفل نظامه على نفسه.
      const email0 = await getProfileEmail(fingerprint);
      const isAdminUser = Boolean(email0) && email0!.toLowerCase() === ADMIN_EMAIL;
      if (!isAdminUser) {
        let deviceBanned = false;
        try { deviceBanned = await isDeviceBanned(fingerprint); } catch {}
        if (deviceBanned) {
          return NextResponse.json({
            ok: true,
            approved: false,
            blocked: true,
            reason: "تم حظر هذا الجهاز.",
          }, { headers: noStore });
        }
      }
      return NextResponse.json({ ok: true, approved: false }, { headers: noStore });
    }

    // معرّف المشترك المستقر: البريد المربوط إن وُجد، وإلا هوية الجهاز.
    const email = await getProfileEmail(fingerprint);
    const subUserId = email ?? getDeviceOwner(fingerprint);

    // المشرف = البريد المربوط يطابق ADMIN_EMAIL (يُحسب خادميًا فقط).
    const isAdmin = Boolean(email) && email!.toLowerCase() === ADMIN_EMAIL;

    // ضمان وجود صف اشتراك لكل مستخدم يدخل الستوديو (بما فيه المشرف)
    // كي يعرض العميل تفاصيل اشتراكه دائماً.
    // نوحّد الهوية: ننقل أي صف تحت هوية الجهاز إلى البريد الكنسي إن وُجد،
    // كي يطابق مفتاح الاشتراك مفتاح المالك المخزّن في المنشورات — وهذا
    // الحل الجذري لتطابق الحظر وعدّاد الأيام بين الأدمن والعميل.
    try {
      const deviceOwner = getDeviceOwner(fingerprint);
      await reconcileSubscription(email ?? null, deviceOwner);
      // نوحّد أيضاً ملكية المنشورات: ننقل منشورات هوية الجهاز إلى البريد
      // الكنسي كي يطابق مفتاح المنشور مفتاح الاشتراك المحظور — وهذا يضمن
      // توقّف كل الروابط فوراً عند حظر الأدمن للبريد (كانت تستمر لأنها
      // مملوكة بـ device:hash الذي لا يُطابق اشتراك الإيميل المحظور).
      if (email) {
        await reassignOwner(deviceOwner, email);
      }
    } catch {
      // فشل التوحيد لا يوقف فتح الاستوديو
    }

    // نعيد الحساب خادمياً (توقيف تلقائي بصلاحية منتهية) قبل أي حكم.
    const sub = await recomputeStatus(subUserId);
    if (sub && sub.status === "banned") {
      return NextResponse.json({
        ok: true,
        approved: false,
        blocked: true,
        reason: sub.reason ?? "تم حظر هذا الحساب.",
      });
    }
    if (sub && (sub.status === "suspended" || sub.status === "expired")) {
      return NextResponse.json({
        ok: true,
        approved: false,
        suspended: true,
        reason: sub.reason ?? (sub.status === "expired" ? "انتهت صلاحية اشتراكك." : "تم إيقاف اشتراكك مؤقتًا."),
      });
    }

    const account = await ensureAccount();
    const profile = await getProfile(fingerprint);
    return NextResponse.json({
      ok: true,
      approved: true,
      isAdmin,
      username: account.username,
      profile: profile ?? null,
      // نرسل الاشتراك بحقول الصلاحية كي يعرض العميل التفاصيل بدقة.
      subscription: sub
        ? {
            ...sub,
            remainingDays: remainingDays(sub),
            notice: sub.notice ?? null,
          }
        : null,
    });
  } catch (err) {
    console.error("[auth/account] خطأ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
