'use client'

import { AuthProvider } from "@/components/invoice-app/context/AuthContext";
import { LangProvider } from "@/lib/i18n-context";
import HelloBoot from "@/components/HelloBoot";
import App from "@/components/invoice-app/App";

export default function Home() {
  return (
    <AuthProvider>
      <LangProvider>
        {/* r22: شاشة إقلاع «Hello, World» بأسلوب آيفون بكل لغات العالم — مرة لكل جلسة */}
        <HelloBoot>
          <App />
        </HelloBoot>
      </LangProvider>
    </AuthProvider>
  );
}
