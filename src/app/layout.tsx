import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  // r13: عنوان افتراضي = علامة الموقع (الزائر غير المسجّل يرى الموقع العام أولاً)؛
  // داخل النظام يضبط App.jsx عنواناً ديناميكياً لكل قسم/شركة بعد الإنعاش (hydration)
  title: "الشركة القابضة المتحدة",
  description:
    "نظام إدارة الفواتير والحسابات المتعدد الشركات — فواتير، عملاء، مشتريات، معالجة ذكية للمنتجات، ومساعد ذكي",
  icons: {
    icon: "/favicon.svg",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
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
