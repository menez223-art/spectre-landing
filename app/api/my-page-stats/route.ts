// إحصائيات زيارات صفحة المالك — GET محمي بالبصمة، يعيد بيانات صاحب المتجر فقط
// (لا تسريب: الربط slug↔owner يُقرأ خادمياً من ملفات الملكية لا من العميل).
import { NextResponse } from "next/server";
import { getKv } from "@/app/lib/kvStore";
import { getPageVisits } from "@/app/lib/statsStore";
import { getProfileEmail } from "@/app/lib/profileStore";

export const dynamic = "force-dynamic";

const OWNER_SLUG_KEY = (owner: string) => `owner-slug/${owner}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!fingerprint || fingerprint.length < 8) {
    return NextResponse.json({ error: "missing_fingerprint" }, { status: 400 });
  }

  try {
    // هوية المالك = البريد المربوط إن وُجد، وإلا هوية الجهاز (توافق قديم)
    const email = await getProfileEmail(fingerprint);
    let owner: string | null = email ?? null;
    if (!owner) {
      try {
        const { getDeviceOwner } = await import("@/app/lib/authStore");
        owner = getDeviceOwner(fingerprint);
      } catch {
        owner = null;
      }
    }
    if (!owner) {
      return NextResponse.json({ ok: true, slug: null, visits: 0, ym: null });
    }

    const boundSlug = await getKv<string>(OWNER_SLUG_KEY(owner));
    if (!boundSlug || typeof boundSlug !== "string") {
      return NextResponse.json({ ok: true, slug: null, visits: 0, ym: null });
    }

    const stats = await getPageVisits(boundSlug);
    return NextResponse.json({
      ok: true,
      slug: boundSlug,
      visits: stats?.visits ?? 0,
      ym: stats?.ym ?? null,
    });
  } catch (err) {
    console.error("[my-page-stats] خطأ:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
