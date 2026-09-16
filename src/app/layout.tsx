import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/**
 * r16: SEO + GEO كامل:
 *  - Metadata شاملة: عنوان/وصف/كلمات مفتاحية + OpenGraph + Twitter Card
 *  - GEO tags للسوق الكويتي (geo.region KW + الإحداثيات + ICBM)
 *  - JSON-LD منظّم: Organization + WebSite + SoftwareApplication (مؤسس أحمد عزت الصياد)
 *  - sitemap.xml (app/sitemap.ts) + robots.txt (app/robots.ts) ديناميكياً
 */
const SITE_NAME = "الشركة القابضة المتحدة";
const SITE_NAME_EN = "Garfix — United Holding Group";
const SITE_DESC =
  "نظام إدارة الفواتير والحسابات المتعدد الشركات في الكويت — فواتير فورية، مدفوعات جزئية، تذكيرات واتساب، تقارير لحظية، إدخال مجمع بالذكاء الاصطناعي، ومساعد ذكي ينفّذ الإجراءات. مجاناً لأول 100 مشترك.";
const FOUNDER = "أحمد عزت الصياد";

// metadataBase: يحل المسارات النسبية للصور (OG) — يُبطَّل بمتغير البيئة في الإنتاج
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | نظام إدارة الفواتير والحسابات — الكويت`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME_EN,
  keywords: [
    "فواتير الكويت",
    "برنامج محاسبة",
    "نظام إدارة حسابات",
    "فاتورة إلكترونية",
    "إدارة عملاء",
    "فواتير متعددة الشركات",
    "تذكير واتساب",
    "مساعد ذكي محاسبي",
    "Kuwait invoicing",
    "accounting software Kuwait",
    "Garfix",
    "أحمد عزت الصياد",
  ],
  authors: [{ name: FOUNDER }],
  creator: FOUNDER,
  publisher: SITE_NAME,
  category: "business software",
  formatDetection: { telephone: false },

  openGraph: {
    type: "website",
    locale: "ar_KW",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | نظام إدارة الفواتير والحسابات`,
    description: SITE_DESC,
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1344,
        height: 768,
        alt: `${SITE_NAME} — نظام إدارة الفواتير والحسابات المتعدد الشركات`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | نظام إدارة الفواتير والحسابات`,
    description: SITE_DESC,
    images: ["/og.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  alternates: {
    canonical: "/",
    languages: { ar: "/" },
  },

  // ── GEO: استهداف السوق الكويتي ──
  other: {
    "geo.region": "KW",
    "geo.placename": "الكويت",
    "geo.position": "29.3759;47.9774",
    ICBM: "29.3759, 47.9774",
    "og:country-name": "الكويت",
    "og:locality": "الكويت",
    "author": FOUNDER,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // r15: ثبات كامل بلا تكبير — طلب المستخدم: التطبيق ثابت بدون zoom في المتصفح.
  // منع pinch-zoom يمنع أيضاً قفزة iOS التلقائية عند التركيز على حقول بحجم خط < 16px.
  maximumScale: 1,
  userScalable: false,
  // سلوك موحّد عند فتح لوحة المفاتيح على الجوال: المحتوى يتقلص بدل قفز viewport
  interactiveWidget: "resizes-content",
};

// r16: بيانات منظّمة JSON-LD — تعرّف محركات البحث بالكيان والمؤسس والعرض
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    founder: {
      "@type": "Person",
      name: FOUNDER,
      jobTitle: "المؤسس والرئيس التنفيذي",
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "KW",
      addressLocality: "الكويت",
      streetAddress: "حولي",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+96598737207",
      email: "ahmedezzatelsayad@gmail.com",
      areaServed: "KW",
      availableLanguage: ["ar", "en"],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_NAME_EN,
    url: SITE_URL,
    inLanguage: "ar",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME_EN,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ar",
    description: SITE_DESC,
    author: { "@type": "Person", name: FOUNDER },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KWD",
      description: "مجاناً لأول 100 مشترك",
    },
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* بيانات منظّمة لمحركات البحث (SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* r22: قبل أول رسم — لغة الزائر المخزنة (اتجاه + lang) بلا وميض عربي */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var gl=localStorage.getItem("garfix_lang")||"ar";var rtl=["ar","fa","ur","pa"].indexOf(gl)>=0;document.documentElement.lang=gl;document.documentElement.dir=rtl?"rtl":"ltr";}catch(e){}',
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {/* Apply stored light/dark theme before first paint (no flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("tw_theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light";}catch(e){}',
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
