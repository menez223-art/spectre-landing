// خريطة الموقع — تُولَّد في وقت البناء/الطلب من المنتجات المنشورة القابلة
// للتصفّح العام (ليست محظورة ولا تجربة منتهية). الصفحات الثابتة + كل /p/<slug>.
//
// ملاحظة: مسار sitemap يعمل في بيئة العقدة فقط (يقرأ KV) — لا يُصدر شيئاً
// أثناء تطوير الواجهة.

import type { MetadataRoute } from "next";
import { listPublishedProducts, getPublishedMeta } from "@/app/lib/publishStore";

const SITE = "https://spectre-dz.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/store`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE}/pricing`, changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const products = await listPublishedProducts();
    const productPaths: MetadataRoute.Sitemap = [];
    for (const { slug } of products) {
      // المحظور وتجارب الـ Agent المنتهية لا تُفهرَس (ترجع 404 للزائر).
      const meta = await getPublishedMeta(slug).catch(() => null);
      if (meta?.banned) continue;
      if (meta?.trialUntil && new Date(meta.trialUntil).getTime() < Date.now()) continue;
      productPaths.push({
        url: `${SITE}/p/${slug}`,
        lastModified: meta?.createdAt ? new Date(meta.createdAt) : undefined,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    return [...staticPaths, ...productPaths];
  } catch {
    // فشل القراءة لا يجب أن يحرم الصفحات الثابتة من الخريطة
    return staticPaths;
  }
}
