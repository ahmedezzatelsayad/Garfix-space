import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // r13: ترويسات أمان عامة (بدون X-Frame-Options حتى لا يتعطل لوحة المعاينة)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // الكوكيز لا تُحفظ معها ترويسة خاصة — لكن نمنع تخزين الاستجابات الإدارية في الوسيط
        source: "/api/backup",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/recovery",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/auth/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
