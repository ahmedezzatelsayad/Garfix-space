import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * r16: /sitemap.xml — ديناميكي (يقرأ مضيف الطلب الفعلي خلف البوابة)
 * التطبيق صفحة واحدة (مسار /) بتنقّل hash داخلي — لذا مدخل واحد أولوية 1.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let base = process.env.SITE_URL;
  if (!base) {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
      const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
      base = `${proto}://${host}`;
    } catch {
      base = "http://localhost:3000";
    }
  }
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
