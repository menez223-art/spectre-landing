// نقطة عامة (بلا مصادقة): هل توقّف توليد الروابط التجريبية؟
// تستخدمها لوحة التجربة لتُعطّل خانتي الإيميل والواتساب فوراً عند الإغلاق.

import { NextResponse } from "next/server";
import { isTrialsDisabled } from "@/app/lib/trialStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ disabled: await isTrialsDisabled() });
  } catch {
    return NextResponse.json({ disabled: false });
  }
}
