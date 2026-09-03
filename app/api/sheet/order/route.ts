// نقطة وكيل الطلبات — نقطة ثابتة لا تتغير. تستلم طلب الزبون + هوية الجدول
// الثابتة (sheetKey/sheetEmail)، تحلّ الرابط الحيّ الحالي لـ Apps Script (يتغيّر
// عند كل إعادة نشر) ثم تُعيد توجيه الطلب إلى هناك. هكذا لا يعتمد أي منتج منشور
// على رابط /exec المتقلّب، بل على هذه النقطة الثابتة فقط.
import { NextResponse } from "next/server";
import { resolveOrderTarget } from "@/app/lib/sheetResolver";
import { buildMetaUserData, splitFullName } from "@/app/lib/utils/metaHash";

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
  // كتلة اختيارية من العميل: event_id + user_data (مُجزّأ مسبقاً وفق مواصفات Meta).
  // غيابها لا يُفشل الطلب — تكامل Meta اختياري ولا يحجب مسار Sheets.
  const metaRaw = (body as { meta?: unknown }).meta;
  const meta =
    metaRaw && typeof metaRaw === "object"
      ? (metaRaw as { eventId?: unknown; userData?: unknown })
      : {};
  const eventId = typeof meta.eventId === "string" && meta.eventId ? meta.eventId : "";
  const userData =
    meta.userData && typeof meta.userData === "object"
      ? (meta.userData as Record<string, string>)
      : {};

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

    // === Meta Conversions API (CAPI) — تكامل حصري لمالك AMINE فقط، يفشل بصمت ===
    // يُطلق بعد نجاح التحويل لـ Apps Script ولا يحبس ردّ العميل. شروط الإطلاق
    // كلها يجب أن تتحقق معاً كي لا يحدث أي خلط بين بيكسلات المستخدمين:
    //   1. META_AMINE_PIXEL_ID + META_ACCESS_TOKEN معرّفان في البيئة
    //   2. sheetEmail المُقدّم يطابق بريد مالك AMINE الكنسي
    //   3. eventId مرره OrderForm (يمنع الإطلاق بدون قصد المتصفح)
    // غياب أي شرط = CAPI لا يُطلق (سلوك آمن لكل الـ tenants).
    const pixelId = process.env.META_AMINE_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const AMINE_OWNER_EMAIL = "spectre1v99@gmail.com";
    if (
      pixelId &&
      accessToken &&
      /^\d{5,30}$/.test(pixelId) &&
      eventId &&
      sheetEmail === AMINE_OWNER_EMAIL
    ) {
      const o = order as Record<string, unknown>;
      const nameStr = typeof o.name === "string" ? o.name : "";
      const split = splitFullName(nameStr);
      const fallbackUserData = await buildMetaUserData({
        phone: typeof o.phone === "string" ? o.phone : "",
        firstName: split.first,
        lastName: split.last,
      });
      const mergedUserData: Record<string, string> = { ...fallbackUserData, ...userData };

      const capiPayload = {
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: typeof o._landingUrl === "string" ? o._landingUrl : undefined,
            action_source: "website",
            user_data: mergedUserData,
            custom_data: {
              currency: "DZD",
              value: typeof o.totalPrice === "number" ? o.totalPrice : Number(o.totalPrice) || 0,
              content_name: typeof o.product === "string" ? o.product : "",
              content_type: "product",
              content_ids: typeof o._productId === "string" ? [o._productId] : undefined,
            },
          },
        ],
      };

      // CAPI: نطلقه متزامناً مع حد أقصى 5 ثوانٍ. Vercel serverless يقتل الخلفية
    // (fire-and-forget) بعد إرسال الرد، فلا خيار سوى الانتظار هنا.
    // Apps Script نفسه يأخذ 5-15s، فالـ 5s إضافية لا تأثير يذكر على UX.
    const capiCtrl = new AbortController();
    const capiTimeout = setTimeout(() => capiCtrl.abort(), 5000);
    try {
      // أمان: الـ access_token في Authorization header وليس في URL (لا يظهر في logs/proxies)
      const capiRes = await fetch(
        `https://graph.facebook.com/v18.0/${encodeURIComponent(pixelId)}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(capiPayload),
          signal: capiCtrl.signal,
        }
      );
      const capiBody = await capiRes.text().catch(() => "");
      if (!capiRes.ok) {
        console.error("[capi] Meta رفض الطلب:", capiRes.status, capiBody.slice(0, 200));
      } else {
        console.info("[capi] Meta ok:", capiBody.slice(0, 200));
      }
    } catch (err) {
      console.warn("[capi] فشل/انتهت المهلة:", err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(capiTimeout);
    }
    }
    // === END CAPI ===

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sheet/order] فشل إعادة التوجيه:", err);
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
}
