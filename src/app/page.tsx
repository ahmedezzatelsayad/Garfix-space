'use client'

import { AuthProvider } from "@/components/invoice-app/context/AuthContext";
import { LangProvider } from "@/lib/i18n-context";
import App from "@/components/invoice-app/App";

export default function Home() {
  return (
    <AuthProvider>
      <LangProvider>
        <App />
      </LangProvider>
    </AuthProvider>
  );
}
