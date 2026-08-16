// مسار إداري محمي — التحكم بوضع الاحتياط (GitHub Pages) وإنذار السعة.
// نفس بوابة الأمان الصارمة لمسار الاشتراكات: يعمل فقط للمشرف (كوكي أو جهاز مربوط
// بـ ADMIN_EMAIL). لا يُثق بالعميل — كل طلب يُتحقَّق منه خادمياً.

import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/adminAuth";
import { isDeviceApproved } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";
import { getKv, setKv } from "@/app/lib/kvStore";
import { hasGithubPages } from "@/app/lib/githubPages";
import {
  BANDWIDTH_WARN_BYTES,
  clearBandwidthWarning,
  getBandwidthBytes,
  isBandwidthWarning,
} from "@/app/lib/statsStore";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();
const FALLBACK_MODE_KEY = "fallback_mode";

async function assertAdmin(fingerprint?: string): Promise<boolean> {
  if (!ADMIN_EMAIL) return false;
  if (getAdminSession() === ADMIN_EMAIL) return true;
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === ADMIN_EMAIL;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// قراءة الحالة: السعة المستهلكة + الإنذار + وضع الاحتياط.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  try {
    const [bytes, warning, mode] = await Promise.all([
      getBandwidthBytes(),
      isBandwidthWarning(),
      getKv<boolean>(FALLBACK_MODE_KEY),
    ]);
    return NextResponse.json({
      bytes,
      warnBytes: BANDWIDTH_WARN_BYTES,
      warning: Boolean(warning),
      fallbackMode: Boolean(mode),
    });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// تبديل وضع الاحتياط أو مسح الإنذار.
// action: "enable" | "disable" | "clear_warning"
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = (searchParams.get("fingerprint") ?? "").trim();
  if (!(await assertAdmin(fingerprint || undefined))) return forbidden();

  let action = "";
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    action = body.action ?? "";
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (action === "enable") {
      await setKv(FALLBACK_MODE_KEY, true);
      // تحذير إن لم يُضبط GitHub Pages — يظل الوضع مفعّلاً لكنه لن يرفع فعلياً.
      const ghReady = hasGithubPages();
      return NextResponse.json({
        ok: true,
        fallbackMode: true,
        githubConfigured: ghReady,
        warning: ghReady ? undefined : "github_not_configured",
      });
    }
    if (action === "disable") {
      await setKv(FALLBACK_MODE_KEY, false);
      return NextResponse.json({ ok: true, fallbackMode: false });
    }
    if (action === "clear_warning") {
      await clearBandwidthWarning();
      // رجوع تلقائي لـ Vercel: عند مسح الإنذار صراحةً من المشرف (عادة بداية
      // شهر جديد) نطفئ وضع الاحتياط إن كانت السعة فعلاً دون الحد — كي تعود
      // المنشورات الجديدة للخدمة على Vercel. لا يمسّ نظام الحظر.
      try {
        const bytes = await getBandwidthBytes();
        if (bytes < BANDWIDTH_WARN_BYTES) {
          await setKv(FALLBACK_MODE_KEY, false);
        }
      } catch {
        // تجاهل — يبقى الوضع كما هو عند فشل القراءة
      }
      return NextResponse.json({ ok: true, warning: false });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
