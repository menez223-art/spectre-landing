import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/adminAuth";
import {
  listPublishedProducts,
  getPublishedProduct,
  setPublishedProduct,
  getPublishedMeta,
  setPublishedMeta,
  deletePublishedProduct,
} from "@/app/lib/publishStore";
import type { Product } from "@/app/lib/types";

export const dynamic = "force-dynamic";

// مصادقة المشرف عبر جلسة الكوكي فقط (getAdminSession) — بلا أي فرع بصمة جهاز،
// كي يبقى هذا المسار بعيداً كلياً عن نظام حظر/سماح الأجهزة.
function isAdmin(): boolean {
  return getAdminSession() !== null;
}

// GET: قائمة كل منتجات المتجر للإشراف (منتج + مالك + أعلام الإدراج/الإخفاء/الحرق).
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const entries = await listPublishedProducts();
    const items = await Promise.all(
      entries.map(async ({ slug, product }) => {
        const meta = await getPublishedMeta(slug);
        return {
          slug,
          id: product.id,
          name: product.name,
          price: product.price,
          oldPrice: product.oldPrice ?? null,
          image: product.image ?? null,
          badge: product.badge ?? null,
          eyebrow: product.eyebrow ?? null,
          owner: meta?.owner ?? null,
          listed: Boolean(meta?.listed),
          hidden: Boolean(meta?.hidden),
          banned: Boolean(meta?.banned),
        };
      })
    );
    return NextResponse.json({ products: items });
  } catch (err) {
    console.error("[admin/products] فشل القراءة:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}

// POST: أفعال إشرافية — edit | hide | unhide | delete.
// - edit: يعدّل حقول العرض الأساسية للمنتج (name, price, oldPrice, image, badge, eyebrow).
// - hide/unhide: يضبط علَم الإخفاء من المتجر فقط (لا يمسّ صفحة /p/<slug> ولا الحظر).
// - delete: يحذف المنتج وصفحته /p/<slug> نهائياً (لا يمكن التراجع).
export async function POST(request: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const slug = String(body.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "missing_slug" }, { status: 400 });

  try {
    if (action === "edit") {
      const product = await getPublishedProduct(slug);
      if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const patch = (body.product ?? {}) as Record<string, unknown>;
      // تعديل مركّز على حقول العرض الأساسية فقط (نطاق v1) — الثيم وباقي الحقول تبقى.
      const updated: Product = { ...product };
      if (typeof patch.name === "string") updated.name = patch.name;
      if (typeof patch.price === "number" && Number.isFinite(patch.price)) updated.price = patch.price;
      if (patch.oldPrice === null) updated.oldPrice = undefined;
      else if (typeof patch.oldPrice === "number" && Number.isFinite(patch.oldPrice)) updated.oldPrice = patch.oldPrice;
      if (typeof patch.image === "string" && patch.image.length > 0) updated.image = patch.image;
      if (patch.badge === null) updated.badge = undefined;
      else if (typeof patch.badge === "string") updated.badge = patch.badge;
      if (patch.eyebrow === null) updated.eyebrow = undefined;
      else if (typeof patch.eyebrow === "string") updated.eyebrow = patch.eyebrow;
      // نثبّت المعرّف على السلاغ (لا يتغيّر عبر التعديل).
      updated.id = product.id;
      await setPublishedProduct(updated);
      return NextResponse.json({ ok: true });
    }

    if (action === "hide" || action === "unhide") {
      const meta = await getPublishedMeta(slug);
      if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });
      // نشر الميتا الموجودة كاملة للحفاظ على owner/createdAt/listed/host/banned.
      await setPublishedMeta(slug, { ...meta, hidden: action === "hide" });
      return NextResponse.json({ ok: true, hidden: action === "hide" });
    }

    if (action === "delete") {
      const removed = await deletePublishedProduct(slug);
      if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ ok: true, deleted: true });
    }

    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  } catch (err) {
    console.error("[admin/products] فشل الفعل:", err);
    return NextResponse.json({ error: "storage" }, { status: 502 });
  }
}
