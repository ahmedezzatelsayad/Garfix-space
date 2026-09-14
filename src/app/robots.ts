import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * r16: /robots.txt — يسمح لكل الزواحف الرئيسية ويشير إلى خريطة الموقع.
 * (استُبدل ملف public/robots.txt الثابت بهذا المسار الديناميكي)
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
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
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
