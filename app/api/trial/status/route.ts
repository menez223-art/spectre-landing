// حالة تجربة الڤيست — الوقت المتبقي للعدّاد.
// يتطلّب الإيميل **والجهاز** معاً كي لا يكشف تفاصيل تجربة غيره.

import { NextResponse } from "next/server";
import { getTrial } from "@/app/lib/trialStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  const deviceFp = (searchParams.get("fingerprint") ?? "").trim();

  if (!email || !deviceFp) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
  const rec = await getTrial(email);
  if (!rec || rec.deviceFp !== deviceFp) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const expires = new Date(rec.expiresAt).getTime();
  const remainingMs = Math.max(0, expires - Date.now());

  return NextResponse.json({
    status: rec.status,
    slug: rec.slug,
    expiresAt: rec.expiresAt,
    remainingMs,
    expired: rec.status !== "converted" && remainingMs <= 0,
  });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
