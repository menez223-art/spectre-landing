// لوحة الأدمن — «الإعدادات المتقدمة»: تعديل نصوص الصفحة الرئيسية باللغتين.
//
// GET  : التجاوزات الحالية + القيم الافتراضية من القاموس المدمج
// POST : حفظ التجاوزات (القيمة الفارغة = استرجاع الافتراضي)
//
// ⚠️ المفاتيح القابلة للتعديل محصورة في SITE_COPY_KEYS (٣٧ نصاً) — أي مفتاح
//    خارجها يُتجاهَل في طبقة التخزين نفسها، فلا يمكن تخريب بقية الواجهة.

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminEmail, assertAdminSession } from "@/app/lib/adminAuth";
import { isDeviceApproved } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getSiteCopy, saveSiteCopy } from "@/app/lib/siteCopy";
import { SITE_COPY_GROUPS, SITE_COPY_KEYS, SITE_COPY_TAG, type SiteCopy } from "@/app/lib/siteCopyShared";
import { translate } from "@/app/lib/i18n";

export const dynamic = "force-dynamic";

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// بوابة الأدمن — نفس منطق مسارات الأدمن الأخرى:
//   1) جلسة موقّعة (كوكي)، أو 2) جهاز استوديو معتمد مربوط ببريد الأدمن الفعلي.
async function assertAdmin(fingerprint?: string): Promise<boolean> {
  if (await assertAdminSession()) return true;
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return false;
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === adminEmail;
}

// القيم الافتراضية لكل مفتاح قابل للتعديل، باللغتين — تُعرض في اللوحة كمرجع
// و«قيمة تُسترجع». تُحسب من القاموس المدمج مباشرةً فلا تتقادم.
function defaults(): { ar: Record<string, string>; en: Record<string, string> } {
  const ar: Record<string, string> = {};
  const en: Record<string, string> = {};
  for (const key of SITE_COPY_KEYS) {
    ar[key] = translate("ar", key);
    en[key] = translate("en", key);
  }
  return { ar, en };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  try {
    const copy = await getSiteCopy();
    return NextResponse.json({ ok: true, copy, defaults: defaults(), groups: SITE_COPY_GROUPS });
  } catch (err) {
    console.error("[admin/site-copy] خطأ قراءة:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const fingerprint = String(body.fingerprint ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  const incoming = body.copy;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "bad_copy" }, { status: 400 });
  }

  try {
    // طبقة التخزين تُنقّي المفاتيح والقيم بنفسها (sanitize) — لا نثق بالمدخل.
    const saved = await saveSiteCopy(incoming as SiteCopy);
    // إبطال الكاش **بوسم** + إبطال كاش المسار. الاثنان معاً مقصودان:
    //   • revalidateTag يُسقط مدخل unstable_cache فوراً ⇒ القراءة التالية بالقيمة الجديدة
    //     (revalidatePath وحده كان لا يكفي: الطبقة الداخلية تبقى بائتة فتظل الصفحة
    //      تُبنى من نص قديم بلا نهاية — علّة «غيّرت ولم تتغير»).
    //   • revalidatePath يُبطل كاش مسار الرئيسية (ISR) ⇒ لا انتظار ٦٠ ثانية.
    revalidateTag(SITE_COPY_TAG);
    revalidatePath("/");
    return NextResponse.json({ ok: true, copy: saved });
  } catch (err) {
    console.error("[admin/site-copy] خطأ حفظ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
