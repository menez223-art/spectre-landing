// نقطة عامة تُرجع الرابط الأساسي للمصنع (FACTORY_URL) — تُستعمل لتوليد رابط
// تسليم الطلبات في HTML الثابت (الذي يُولَّد في المتصفح ولا يقرأ متغيّرات الخادم).
// الرابط الأساسي ليس سرّاً (هو رابط Web App منشور للعموم)، لذا هذه النقطة عامة.
import { NextResponse } from "next/server";
import { getFactoryBaseUrl } from "@/app/lib/sheetResolver";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = await getFactoryBaseUrl();
  return NextResponse.json({ base: base ?? null });
}
