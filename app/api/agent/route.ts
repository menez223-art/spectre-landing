import { NextResponse } from "next/server";
import {
  deletePublishedProduct,
  getPublishedMeta,
  getPublishedProduct,
  reassignOwner,
  setPublishedMeta,
  setPublishedProduct,
  hasPublishStore,
  type PublishMeta,
} from "@/app/lib/publishStore";
import { getKv, setKv, deleteKv } from "@/app/lib/kvStore";
import { PLAN_QUOTAS, setSubscription } from "@/app/lib/subsStore";
import type { Product, Theme } from "@/app/lib/types";
import { categoryLabel } from "@/app/lib/categoryLabels";
import { paletteForCategory } from "@/app/lib/trialPalette";

export const dynamic = "force-dynamic";

// جسر Agent → Spectre — نشر صفحات التجربة (24 ساعة) وتحويلها لدائمة بعد الدفع.
// الحماية: مفتاح مشترك خادمي واحد (AGENT_TRIAL_KEY) — أي طلب بلا المفتاح يُرفض.
// هذا المسار لا يمنح صلاحيات أدمن عامة؛ ثلاث عمليات فقط: publish / confirm / burn.

const AGENT_KEY = process.env.AGENT_TRIAL_KEY ?? "";
const TRIAL_HOURS = 24;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

const ownerSlugKey = (owner: string) => `owner-slug/${owner}`;

async function freshSlug(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const c =
      globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 10) ??
      Math.random().toString(36).slice(2, 12);
    if (!(await getPublishedProduct(c))) return c;
  }
  return `t${Date.now().toString(36)}`;
}

interface TrialLead {
  leadId?: string;
  name?: string;
  city?: string;
  phone?: string;
  category?: string;
  address?: string;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function waDigits(raw: string | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `213${d.slice(1)}`;
  return d.length >= 9 ? d : "";
}

function placeholderImage(theme: Theme, name: string): string {
  const initial = name.trim().charAt(0) || "★";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${theme.primary}"/><stop offset="1" stop-color="${theme.accent}"/>` +
    `</linearGradient></defs>` +
    `<rect width="1200" height="800" fill="${theme.bg}"/>` +
    `<circle cx="600" cy="360" r="230" fill="url(#g)" opacity="0.95"/>` +
    `<text x="600" y="445" font-size="240" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="Segoe UI,Tahoma,Arial">${esc(initial)}</text>` +
    `<rect x="200" y="660" width="800" height="8" rx="4" fill="url(#g)"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function buildTrialProduct(lead: TrialLead): Promise<Product> {
  const name = (lead.name ?? "").trim().slice(0, 60);
  const city = (lead.city ?? "").trim().slice(0, 40);
  const catAr = categoryLabel((lead.category ?? "").trim());
  const label = catAr || "نشاط محلي";
  const theme = paletteForCategory((lead.category ?? "").trim());
  const wa = waDigits(lead.phone);

  return {
    id: "pending",
    name,
    brand: name,
    // صفحة التجربة عرض قدرة فقط: السعر 0 يُخفي فكرة الشراء، والطلب كله واتساب
    price: 0,
    eyebrow: `${label} · ${city}`,
    tagline: `${name} — ${label} في ${city}`,
    description: `${name}: ${label} موثوق في ${city}. اطلب الآن عبر واتساب ويصلك رد فوراً.`,
    badge: "عرض خاص للمنطقة",
    image: placeholderImage(theme, name),
    features: [
      { title: "طلب عبر واتساب", copy: wa ? "اضغط الزر واكتب طلبك — نرد خلال دقائق." : "تواصل معنا مباشرة لمعرفة التفاصيل." },
      { title: "خدمة قريبة منك", copy: lead.address ? `${lead.address} — ${city}` : `نخدم ${city} وما حولها.` },
      { title: "جودة يحكي عنها الناس", copy: "تجربة خدمة يعتمد عليها أهالي المنطقة." },
    ],
    testimonials: [
      { quote: "تعامل راقٍ وسرعة في الاستجابة — أنصح بهم بقوة.", name: "أمين ب.", city },
      { quote: "أفضل تجربة مررت بها في المنطقة، شكراً لكم.", name: "سارة م.", city },
    ],
    stats: [
      { value: "24/7", label: "استقبال الطلبات" },
      { value: "+100", label: "زبون سعيد" },
      { value: "5★", label: "ثقة المنطقة" },
    ],
    theme,
    whatsapp: wa || undefined,
  };
}

export async function POST(request: Request) {
  if (!AGENT_KEY || !hasPublishStore()) return bad("config", 503);

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "";
  const key = searchParams.get("key") ?? "";
  if (key !== AGENT_KEY) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("invalid_json");

  // ── نشر تجربة 24 ساعة ──
  if (action === "publish") {
    const lead = (body.lead ?? {}) as TrialLead;
    const name = (lead.name ?? "").trim();
    const leadId = (lead.leadId ?? "").replace(/[^a-zA-Z0-9_-]/g, "-");
    if (!name || !leadId) return bad("missing_lead");

    const product = await buildTrialProduct(lead);
    const owner = `agent:${leadId}`;

    // قاعدة spectre الصارمة: رابط واحد لكل مالك — إعادة العرض لنفس النشاط
    // تعيد استعمال نفس السلاغ وتحدّث الصفحة في مكانها (وتجدّد الـ24 ساعة).
    let slug: string | null = null;
    try {
      const bound = await getKv<string>(ownerSlugKey(owner));
      if (typeof bound === "string" && bound.length > 0 && (await getPublishedProduct(bound))) {
        slug = bound;
      }
    } catch {
      slug = null;
    }
    if (!slug) {
      slug = await freshSlug();
      await setKv(ownerSlugKey(owner), slug);
    }
    product.id = slug;

    const trialUntil = new Date(Date.now() + TRIAL_HOURS * 3600_000).toISOString();

    await setPublishedProduct(product);
    const meta: PublishMeta & { trialUntil?: string } = {
      owner,
      createdAt: new Date().toISOString(),
      listed: false,
      host: "vercel",
      trialUntil,
    };
    await setPublishedMeta(slug, meta);

    const origin = new URL(request.url).origin;
    return NextResponse.json({
      url: `${origin}/p/${slug}`,
      slug,
      owner,
      trialUntil,
    });
  }

  // ── تأكيد الدفع: نفس الرابط يصبح دائماً (اشتراك سنوي basic) ──
  if (action === "confirm") {
    const slug = String(body.slug ?? "");
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("invalid_email");

    const meta = await getPublishedMeta(slug);
    if (!meta) return bad("not_found", 404);
    if (!meta.owner.startsWith("agent:")) return bad("already_permanent", 409);

    // حماية قاعدة «رابط واحد لكل حساب»: إن كان للبريد رابطٌ مثبَّت سابقاً
    // مختلفاً نرفض — القرار للمالك (يحرق القديم أولاً من لوحة الأدمن).
    try {
      const existingBound = await getKv<string>(ownerSlugKey(email));
      if (typeof existingBound === "string" && existingBound.length > 0 && existingBound !== slug) {
        return bad("owner_has_other_link", 409);
      }
    } catch {
      // تعذر القراءة — المتابعة آمنة (setKv سيكتب القيمة الصحيحة)
    }

    await reassignOwner(meta.owner, email);

    // تثبيت الرابط كرابط الحساب الرسمي الوحيد — أي نشر لاحق من الاستوديو
    // يحدث نفس الرابط في مكانه (سلوك resolveOwnerSlug الأصلي).
    await setKv(ownerSlugKey(email), slug);

    const now = new Date();
    const in1y = new Date(now.getTime() + 365 * 86_400_000);
    await setSubscription({
      userId: email,
      plan: "basic",
      status: "active",
      startsAt: now.toISOString(),
      expiresAt: in1y.toISOString(),
      reason: null,
      updatedAt: now.toISOString(),
      validityUnit: "day",
      validityDays: 365,
      validityStartsAt: now.toISOString(),
      validityExpiresAt: in1y.toISOString(),
      notice: null,
      maxProducts: PLAN_QUOTAS.basic.maxProducts,
      maxImages: PLAN_QUOTAS.basic.maxImages,
    });

    const cleared: PublishMeta = { ...meta, owner: email };
    delete (cleared as PublishMeta & { trialUntil?: string }).trialUntil;
    await setPublishedMeta(slug, cleared);

    return NextResponse.json({
      ok: true,
      url: `${new URL(request.url).origin}/p/${slug}`,
      plan: "basic",
      expiresAt: in1y.toISOString(),
    });
  }

  // ── حرق فوري (رابط ميت نهائياً) ──
  if (action === "burn") {
    const slug = String(body.slug ?? "");
    const meta = await getPublishedMeta(slug);
    if (!meta) return bad("not_found", 404);
    await deletePublishedProduct(slug);
    try {
      const bound = await getKv<string>(ownerSlugKey(meta.owner));
      if (bound === slug) await deleteKv(ownerSlugKey(meta.owner));
    } catch {
      // تحرير الربط إضافي — الحرق تم
    }
    return NextResponse.json({ ok: true, burned: slug });
  }

  return bad("unknown_action");
}
