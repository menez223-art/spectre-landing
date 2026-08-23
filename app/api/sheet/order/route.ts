// نقطة وكيل الطلبات — نقطة ثابتة لا تتغير. تستلم طلب الزبون + هوية الجدول
// الثابتة (sheetKey/sheetEmail)، تحلّ الرابط الحيّ الحالي لـ Apps Script (يتغيّر
// عند كل إعادة نشر) ثم تُعيد توجيه الطلب إلى هناك. هكذا لا يعتمد أي منتج منشور
// على رابط /exec المتقلّب، بل على هذه النقطة الثابتة فقط.
import { NextResponse } from "next/server";
import { resolveOrderTarget } from "@/app/lib/sheetResolver";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const sheetKey = typeof body.sheetKey === "string" ? body.sheetKey.trim() : "";
  const sheetEmail = typeof body.sheetEmail === "string" ? body.sheetEmail.trim().toLowerCase() : "";
  const order = body.order;

  if (!sheetKey && !(sheetEmail && EMAIL_RE.test(sheetEmail))) {
    return NextResponse.json({ error: "missing_identity" }, { status: 400 });
  }
  if (!order || typeof order !== "object") {
    return NextResponse.json({ error: "missing_order" }, { status: 400 });
  }

  const target = await resolveOrderTarget({
    sheetKey: sheetKey || null,
    sheetEmail: sheetEmail || null,
  });
  if (!target) {
    return NextResponse.json({ error: "no_webhook" }, { status: 502 });
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(15000),
    });
    const text = await upstream.text();
    if (text.trim().startsWith("ERR")) {
      return NextResponse.json({ error: "upstream_error", detail: text.trim() }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sheet/order] فشل إعادة التوجيه:", err);
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
}
