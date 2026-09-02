// إرسال رمز تفعيل الجهاز إلى بريد المشرف (الأونر) عبر Resend — server only
// القاعدة الصارمة: الرمز يُرسَل حصرياً إلى ADMIN_EMAIL ولا يُرسَل لأي جهة
// أخرى أبداً. لا يُعاد الرمز للعميل الطالب.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// ADMIN_EMAIL is required in production. Defaulting to a personal address in source
// would be a privacy footgun. In dev we still allow a placeholder so local setup works.
const _rawAdminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
if (!_rawAdminEmail && process.env.NODE_ENV === "production") {
  throw new Error("ADMIN_EMAIL is required in production");
}
const ADMIN_EMAIL = _rawAdminEmail;
const FROM = "Studio <onboarding@resend.dev>";

if (typeof window !== "undefined") {
  throw new Error("email.ts is server-only");
}

export function hasEmailConfig(): boolean {
  return Boolean(RESEND_API_KEY);
}

// يُرسل رمز تفعيل/تأكيد إلى بريد المشرف (الأونر) فقط — حصرياً.
// `mode`: "admin_login" لنص تسجيل الدخول، "link_email" لنص ربط البريد.
// ملاحظة أمنية: لا توجد أي وجهة أخرى للإرسال — الرمز لا يغادر صندوق المشرف،
// وهو من يمنحه للمستخدم لإتمام عملية الربط/التأكيد في المرة الأولى.
export async function sendVerificationCodeEmail(
  code: string,
  mode: "admin_login" | "link_email" | "set_whatsapp" = "admin_login"
): Promise<{ ok: boolean; error?: string; deliveredTo?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "no_key" };

  const { subject, text } = (() => {
    if (mode === "link_email") {
      return {
        subject: "استوديو — رمز تأكيد ربط بريد (للمشرف)",
        text: [
          "وصل طلب ربط بريد جديد باستوديو صفحات الهبوط من أحد الأجهزة.",
          "بصفة مشرف (أونر)، أنت الوحيد الذي يتلقى رمز التأكيد.",
          "",
          `رمز تأكيد الربط: ${code}`,
          "",
          "الرمز صالح لمدة 15 دقيقة. شاركه مع المستخدم ليُدخله في خطوة ربط بريده",
          "وتتم العملية بنجاح. إذا لم تكن أنت من أذن بالربط، تجاهل هذه الرسالة.",
        ].join("\n"),
      };
    }
    if (mode === "set_whatsapp") {
      return {
        subject: "استوديو — رمز الموافقة على رقم واتساب لاستلام الطلبات",
        text: [
          "وصل طلب ربط رقم واتساب لاستلام طلبات متجر على أحد الأجهزة.",
          "بصفة مشرف (أونر)، أعطِ الرمز للمستخدم لإقرار رقمه — كل الطلبات ستصل إليه.",
          "",
          `رمز الموافقة: ${code}`,
          "",
          "الرمز صالح لمدة 15 دقيقة ويُطلب مرة واحدة فقط على الجهاز.",
          "إذا لم تكن أنت من أذن به، تجاهل هذه الرسالة فلن يُحفظ أي رقم.",
        ].join("\n"),
      };
    }
    return {
      subject: "استوديو — رمز تفعيل جهاز جديد",
      text: [
        "طلب تسجيل دخول من جهاز جديد في استوديو الصفحات.",
        "",
        `رمز التفعيل: ${code}`,
        "",
        "الرمز صالح لمدة 15 دقيقة. سجّل دخولك من الجهاز الجديد وأدخل الرمز هناك.",
        "إذا لم تكن أنت من طلب الدخول، تجاهل هذه الرسالة.",
      ].join("\n"),
    };
  })();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN_EMAIL],
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] فشل الإرسال:", res.status, body);
      return { ok: false, error: `resend_${res.status}` };
    }
    return { ok: true, deliveredTo: ADMIN_EMAIL };
  } catch (err) {
    console.error("[email] استثناء أثناء الإرسال:", err);
    return { ok: false, error: "exception" };
  }
}
