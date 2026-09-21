// مسار فحص صحة تكامل البيكسل — يتحقق من env + اتصال CAPI + اشتقاق
// event_source_url من Vercel. يجيب مباشرة: هل البيكسل يعمل احترافياً في
// الإنتاج الآن، أم في حالة خطأ؟
//
// بوابة أمان: جلسة كوكي الأدمن + CRON_SECRET (مثل بقية مسارات الأدمن).

import { NextResponse } from "next/server";
import { getAdminEmail, assertAdminSession } from "@/app/lib/adminAuth";
import { safeSecretEqual } from "@/app/lib/utils/security";
import { isDeviceApproved } from "@/app/lib/authStore";
import { getProfileEmail } from "@/app/lib/profileStore";

export const dynamic = "force-dynamic";
// فحص سريع (CAPI ping + env check) — أقل من 10 ثوانٍ.
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET || "";

interface HealthCheck {
  ok: boolean;
  detail: string;
}

async function assertAdmin(request: Request, fingerprint?: string): Promise<boolean> {
  if (CRON_SECRET && safeSecretEqual(request.headers.get("authorization") ?? "", `Bearer ${CRON_SECRET}`)) {
    return true;
  }
  if (await assertAdminSession()) return true;
  const adminEmail = await getAdminEmail();
  if (!adminEmail) return false;
  if (!fingerprint) return false;
  if (!(await isDeviceApproved(fingerprint))) return false;
  const email = await getProfileEmail(fingerprint);
  return email?.toLowerCase() === adminEmail;
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function checkEnv(): {
  pixelId: HealthCheck;
  accessToken: HealthCheck;
} {
  const pixelId = process.env.META_AMINE_PIXEL_ID ?? "";
  const accessToken = process.env.META_ACCESS_TOKEN ?? "";
  return {
    pixelId: {
      ok: /^\d{5,30}$/.test(pixelId),
      detail: pixelId ? `${pixelId.slice(0, 6)}… (${pixelId.length} رقم)` : "غير معرّف",
    },
    accessToken: {
      ok: accessToken.length >= 50,
      detail: accessToken
        ? `${accessToken.slice(0, 6)}… (${accessToken.length} حرف)`
        : "غير معرّف",
    },
  };
}

// يفحص اتصال CAPI عبر GET على endpoint الـpixel. Meta يعيد بيانات الـpixel
// إن كان الـtoken صحيحاً ومربوطاً. هذا يكفي للتحقق من أن الـtoken فعّال
// بدون إرسال حدث زائف أو تعديل عدّاد stats.
async function pingCapi(
  pixelId: string,
  accessToken: string
): Promise<{ reachable: boolean; detail: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${encodeURIComponent(pixelId)}?fields=id,name,creation_time`,
      {
        signal: ctrl.signal,
        cache: "no-store",
        // أمان: token في Authorization header لا في URL — لا يظهر في
        // logs/proxies (نفس نمط /api/sheet/order).
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    clearTimeout(t);
    const text = await res.text();
    if (!res.ok) {
      return { reachable: false, detail: `Meta ${res.status}: ${text.slice(0, 150)}` };
    }
    try {
      const json = JSON.parse(text);
      if (json?.id === pixelId) {
        const created = json.creation_time ? `, أُنشئ ${json.creation_time}` : "";
        return {
          reachable: true,
          detail: `Pixel ${pixelId} نشط على Meta${created}`,
        };
      }
      return { reachable: false, detail: `استجابة غير متوقعة: ${text.slice(0, 150)}` };
    } catch {
      return { reachable: false, detail: `JSON غير صالح: ${text.slice(0, 150)}` };
    }
  } catch (err) {
    return {
      reachable: false,
      detail: err instanceof Error ? err.message : "فشل الاتصال",
    };
  }
}

// يفحص توليد event_source_url من رؤوس Vercel — يحاكي ما يفعله route.ts.
function deriveEventSourceUrl(request: Request): {
  source: string;
  valid: boolean;
} {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "";
  const ref = request.headers.get("referer") || "";
  if (ref) {
    try {
      const u = new URL(ref);
      return {
        source: `${u.protocol}//${u.host}${u.pathname}${u.search}`,
        valid: Boolean(u.host),
      };
    } catch {
      // referer غير صالح، نسقط على host
    }
  }
  if (host) return { source: `${proto}://${host}/`, valid: true };
  return { source: "", valid: false };
}

export async function GET(request: Request) {
  if (!(await assertAdmin(request))) return forbidden();

  const env = checkEnv();
  const url = deriveEventSourceUrl(request);
  const capi = env.pixelId.ok && env.accessToken.ok
    ? await pingCapi(process.env.META_AMINE_PIXEL_ID ?? "", process.env.META_ACCESS_TOKEN ?? "")
    : { reachable: false, detail: "تخطّي — env غير مكتمل" };

  const overall = env.pixelId.ok && env.accessToken.ok && capi.reachable && url.valid;
  return NextResponse.json({
    ok: overall,
    checkedAt: new Date().toISOString(),
    env,
    eventSourceUrl: url,
    capi,
    summary: overall
      ? "Pixel + CAPI يعملان في الإنتاج"
      : `مشكلة: ${[
          !env.pixelId.ok && "META_AMINE_PIXEL_ID",
          !env.accessToken.ok && "META_ACCESS_TOKEN",
          env.pixelId.ok && env.accessToken.ok && !capi.reachable && "CAPI غير متاح",
          !url.valid && "event_source_url",
        ]
          .filter(Boolean)
          .join(", ")}`,
  });
}