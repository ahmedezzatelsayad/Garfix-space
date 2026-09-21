'use client'

import { AuthProvider } from "@/components/invoice-app/context/AuthContext";
import { LangProvider } from "@/lib/i18n-context";
import App from "@/components/invoice-app/App";
import HelloBoot from "@/components/HelloBoot";

// r29 (F5): HelloBoot — شاشة ترحيب إقلاعية «مرحباً بالعالم» بكل لغات العالم،
// مرة واحدة لكل جلسة متصفح (sessionStorage) كطبقة عميل فوق التطبيق.
// تعرض {children} دائماً (SSR يطابق مرحلة "check") فلا تحجب شيئاً عن
// محركات البحث ولا تؤخر التطبيق — يُحمّل خلفها ويُكشف عند انتهاء العرض.
export default function Home() {
  return (
    <AuthProvider>
      <LangProvider>
        <HelloBoot>
          <App />
        </HelloBoot>
      </LangProvider>
    </AuthProvider>
  );
}
