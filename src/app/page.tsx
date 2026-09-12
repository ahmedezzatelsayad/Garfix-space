'use client'

import { AuthProvider } from "@/components/invoice-app/context/AuthContext";
import App from "@/components/invoice-app/App";

export default function Home() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
