// نقطة إعلان سكريبت Apps Script برابطه الحيّ الحالي — يُستدعى من السكريبت نفسه
// (داخل doPost) لحفظ أحدث رابط /exec في Blob. هكذا يبقى متغيّر البيئة FACTORY_URL
// دائماً محدّثاً تلقائياً بعد أي "نشر جديد"، دون تدخل يدوي.
import { NextResponse } from "next/server";
import { saveFactoryUrl } from "@/app/lib/sheetResolver";

export const dynamic = "force-dynamic";

const WEBHOOK_RE = /^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const secret = String(body.secret ?? "").trim();
  if (secret !== process.env.FACTORY_SECRET) {
    return NextResponse.json({ error: "bad_secret" }, { status: 401 });
  }
  const url = String(body.url ?? "").trim();
  if (!WEBHOOK_RE.test(url)) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  try {
    await saveFactoryUrl(url);
  } catch (err) {
    console.error("[sheet/announce] فشل الحفظ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
