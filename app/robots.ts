// robots.txt — نسمح لكل الزواحف، ونشير لخريطة الموقع.
// مسارات الأدمن والـ API ليست سرّية لكنها بلا قيمة بحثية فنمنعها.
import type { MetadataRoute } from "next";

const SITE = "https://spectre-dz.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
