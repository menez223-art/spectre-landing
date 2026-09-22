// حذف رابط التجربة يدوياً من الڤيست قبل انتهاء المدة.
// ⚠️ وفق القاعدة (٧): الحذف **نهائي** — لا يمكنه أخذ رابط جديد بعده.
//    لذلك الواجهة تعرض نافذة تأكيد إلزامية قبل الاستدعاء.

import { NextResponse } from "next/server";
import { deleteTrialByUser, getTrial } from "@/app/lib/trialStore";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  const deviceFp = String(body.deviceFp ?? "").trim();
  if (!email || !deviceFp) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const rec = await getTrial(email);
  if (!rec || rec.deviceFp !== deviceFp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // التجربة المحوّلة لاشتراك لا تُحذف من هنا — رابط المشترك يُدار من الستوديو.
  if (rec.status === "converted") {
    return NextResponse.json({ error: "converted" }, { status: 409 });
  }

  const updated = await deleteTrialByUser(email);
  if (!updated) return NextResponse.json({ error: "storage" }, { status: 502 });

  return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    const converted = error instanceof Error && error.message === "converted";
    return NextResponse.json({ error: converted ? "converted" : "storage" }, { status: converted ? 409 : 502 });
  }
}
