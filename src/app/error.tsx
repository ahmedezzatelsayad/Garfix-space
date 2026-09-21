"use client";

/**
 * r29 (F1): حدّ أخطاء عالمي لمسار / — قبل هذا الملف كان أي خطأ رندر (مثل انهيار
 * InvPreview على صف مجمّع بلا items) يترك شاشة بيضاء صامتة بلا أي استرجاع.
 * بطاقة استرجاع عربية RTL متناسقة مع هوية GarfiX: اعتذار + إعادة المحاولة
 * (reset) + تحديث الصفحة (location.reload) — بلا أي اعتماد على مكونات قد تكون
 * هي نفسها المتسببة في الخطأ (أنماط مضمّنة بالكامل).
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // للتشخيص في وحدة تحكم المتصفح وسجلات dev — بلا كشف تفاصيل للمستخدم
    console.error("[garfix-error-boundary]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      lang="ar"
      role="alert"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(150deg,#07111f 0%,#0b1e3a 45%,#070e1c 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Cairo','Tajawal',system-ui,sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(201,162,39,.22)",
          borderRadius: "20px",
          padding: "34px 28px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,.5)",
          animation: "garfixErrIn .35s ease both",
        }}
      >
        <style>{`@keyframes garfixErrIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(220,38,38,.12)",
            border: "1px solid rgba(220,38,38,.3)",
            fontSize: 30,
          }}
        >
          ⚠️
        </div>
        <div style={{ color: "#fff", fontSize: 19, fontWeight: 900, marginBottom: 8 }}>
          عذراً، حدث خطأ غير متوقع
        </div>
        <div style={{ color: "rgba(255,255,255,.55)", fontSize: 13, lineHeight: 1.9, marginBottom: 22 }}>
          لقد انقطع عرض هذه الشاشة مؤقتاً. بياناتك محفوظة وآمنة على الخادم —
          جرّب إعادة المحاولة، وإن تكرر الخطأ حدّث الصفحة.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 22px",
              background: "linear-gradient(135deg,#d4af37,#9a7318)",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 22px rgba(201,162,39,.4)",
              transition: "filter .15s",
            }}
          >
            🔄 إعادة المحاولة
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 12,
              padding: "12px 22px",
              background: "rgba(255,255,255,.06)",
              color: "rgba(255,255,255,.8)",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            🗂️ تحديث الصفحة
          </button>
        </div>
        {error?.digest && (
          <div style={{ marginTop: 18, fontSize: 10.5, color: "rgba(255,255,255,.28)", direction: "ltr" }}>
            digest: {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
