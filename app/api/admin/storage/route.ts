// لوحة الأدمن — «إدارة التخزين»: حذف فئات بيانات محددة أو الكل.
//
// GET  : عدّ المفاتيح في كل فئة (لعرضها قبل الحذف) — لا يُرجع أي قيم.
// POST : حذف الفئات المختارة. يتطلب تأكيداً نصياً صريحاً (حذف/DELETE).
//
// ⚠️ لا رجعة في الحذف — الواجهة تعرض تأكيداً إلزامياً + تحذيرات حسب الخطورة.

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { assertAdminSession } from "@/app/lib/adminAuth";
import { deleteKvMany, listKvKeys } from "@/app/lib/kvStore";
import { SITE_COPY_TAG } from "@/app/lib/siteCopyShared";

export const dynamic = "force-dynamic";

// فئات الحذف — كل فئة بادئة أو أكثر.
// danger: critical | high | med | low — تُستخدم للتحذير في الواجهة فقط.
interface Category {
  id: string;
  prefixes: string[];
  danger: "critical" | "high" | "med" | "low";
}

const CATEGORIES: Category[] = [
  { id: "pages", prefixes: ["published/", "published-meta/"], danger: "high" },
  { id: "trials", prefixes: ["trials/", "trials-device/", "trials-whatsapp/", "trial-code/"], danger: "med" },
  { id: "subs", prefixes: ["subs/"], danger: "high" },
  { id: "auth", prefixes: ["studio-auth/"], danger: "critical" },
  { id: "stats", prefixes: ["stats/"], danger: "low" },
  { id: "limits", prefixes: ["ratelimit/"], danger: "low" },
  { id: "copy", prefixes: ["site-copy"], danger: "low" },
  { id: "creds", prefixes: ["credentials/"], danger: "med" },
  { id: "flags", prefixes: ["fallback_mode", "fallback_warning", "trials_disabled", "sheet-factory/", "owner-slug/"], danger: "med" },
];

const CHUNK = 200; // حدّ حجم كل نداء حذف (يتفادى استعلامات ضخمة)

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

// عدّ المفاتيح لكل فئة (بلا قيم — خفيف).
async function countCategory(c: Category): Promise<number> {
  let n = 0;
  for (const p of c.prefixes) {
    try {
      n += (await listKvKeys(p)).length;
    } catch {
      // فشل بادئة واحدة لا يُسقط العدّ كله
    }
  }
  return n;
}

export async function GET() {
  if (!(await assertAdminSession())) return forbidden();
  try {
    const counts: Record<string, number> = {};
    for (const c of CATEGORIES) {
      counts[c.id] = await countCategory(c);
    }
    return NextResponse.json({
      ok: true,
      counts,
      categories: CATEGORIES.map((c) => ({ id: c.id, danger: c.danger })),
    });
  } catch {
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!(await assertAdminSession())) return forbidden();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("invalid_json");

  const targets = Array.isArray(body.targets)
    ? body.targets.filter((t): t is string => typeof t === "string")
    : [];
  const confirm = String(body.confirm ?? "").trim();

  // تأكيد نصي صريح — يمنع الحذف بالخطأ
  if (confirm !== "حذف" && confirm.toUpperCase() !== "DELETE") return bad("bad_confirm");
  if (targets.length === 0) return bad("no_targets");

  const selected = CATEGORIES.filter((c) => targets.includes(c.id));
  if (selected.length === 0) return bad("unknown_targets");

  try {
    const perCategory: Record<string, number> = {};
    let deleted = 0;

    for (const c of selected) {
      let n = 0;
      for (const p of c.prefixes) {
        try {
          const keys = await listKvKeys(p);
          for (let i = 0; i < keys.length; i += CHUNK) {
            const slice = keys.slice(i, i + CHUNK);
            await deleteKvMany(slice);
            n += slice.length;
          }
        } catch {
          // فشل بادئة لا يوقف البقية
        }
      }
      perCategory[c.id] = n;
      deleted += n;
    }

    // الرئيسية تقرأ site-copy — نُبطل الكاش (وسم + مسار) بعد أي حذف.
    // الوسم ضروري: بدون إسقاط مدخل unstable_cache تبقى الرئيسية بنصوص محذوفة.
    revalidateTag(SITE_COPY_TAG);
    revalidatePath("/");

    return NextResponse.json({ ok: true, deleted, perCategory });
  } catch (err) {
    console.error("[admin/storage] فشل الحذف:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
