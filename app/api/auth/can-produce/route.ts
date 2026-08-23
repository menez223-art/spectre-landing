import { NextResponse } from "next/server";
import { isDeviceApprovedOnly, isDeviceBanned } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getSubscription } from "@/app/lib/subsStore";

export const dynamic = "force-dynamic";

// بوابة خادمية قطعية: هل يُسمح لهذا الجهاز بإنتاج محتوى (تحميل HTML / نشر)؟
// تُستدعى من زر «تحميل HTML» قبل التوليد كي لا يعتمد الحظر على حارس عميل
// قابل للالتفاف. قاعدة fail-closed: أي خطأ/عدم اكتمال → غير مسموح.
//   - غير معتمد → غير مسموح
//   - بلا بريد مربوط → غير مسموح (هوية غير مكتملة)
//   - موقوف/محظور → غير مسموح
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ allowed: false, reason: "missing_fingerprint" }, { status: 400 });
  }

  // الجهاز معتمد؟ (بغض النظر عن حالة الحظر — لنميّز بين غير المعتمد والمحظور)
  let approved = false;
  try {
    approved = await isDeviceApprovedOnly(fingerprint);
  } catch {
    // فشل القراءة → غير مسموح احتياطياً
    return NextResponse.json({ allowed: false, reason: "storage" }, { status: 502 });
  }
  if (!approved) {
    return NextResponse.json({ allowed: false, reason: "unauthorized" }, { status: 401 });
  }

  // الجهاز محظور على مستوى صفّه المستقل؟ (يغلق حافة «جهاز يهرب من حظر الإيميل»)
  let deviceBanned = false;
  try {
    deviceBanned = await isDeviceBanned(fingerprint);
  } catch {
    // فشل القراءة → نفترض غير محظور (لا نمنع الإنتاج بسبب خطأ تخزين)
  }
  if (deviceBanned) {
    return NextResponse.json({ allowed: false, reason: "banned", status: "banned" }, { status: 403 });
  }

  // مكتمل الهوية (بريد مربوط)؟
  let email: string | null = null;
  try {
    email = await getProfileEmail(fingerprint);
  } catch {
    return NextResponse.json({ allowed: false, reason: "storage" }, { status: 502 });
  }
  if (!email) {
    // لا بريد → غير مكتمل → لا إنتاج (يمنع التفاف تعطيل الأزرار عبر طلب مباشر)
    return NextResponse.json({ allowed: false, reason: "incomplete" }, { status: 403 });
  }

  // محظور/موقوف؟
  let status: string | null = null;
  try {
    const sub = await getSubscription(email);
    status = sub?.status ?? null;
  } catch {
    // فشل قراءة الاشتراك → غير مسموح احتياطياً (fail-closed)
    return NextResponse.json({ allowed: false, reason: "banned" }, { status: 403 });
  }
  if (status === "banned" || status === "suspended") {
    return NextResponse.json(
      { allowed: false, reason: status === "banned" ? "banned" : "suspended", status },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true, email });
}
