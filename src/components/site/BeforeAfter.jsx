"use client";

/**
 * r24: BeforeAfter — «من فوضى واتساب إلى محاسبة نظيفة في ثوانٍ».
 * لوحتان متقابلتان: قبل (رسائل متفرقة/Excel/أرقام ناقصة) وبعد
 * (فواتير PDF، عملاء موحّدون، تذكيرات تلقائية، تقارير) — بأسلوب السوق
 * الخليجي والعربي وفي نفس الوقت مفهوم عالمياً.
 */
import { ArrowLeftRight, BellRing, FileSpreadsheet, FileText, MessagesSquare, TrendingUp, Users } from "lucide-react";
import { tr } from "@/lib/i18n-app";

function Panel({ tone, title, children, items }) {
  const isBefore = tone === "before";
  return (
    <div
      className="s-card"
      style={{
        flex: 1, minWidth: 260, padding: 22, display: "flex", flexDirection: "column", gap: 14,
        background: isBefore ? "rgba(239,68,68,.045)" : "rgba(16,185,129,.05)",
        borderColor: isBefore ? "rgba(239,68,68,.22)" : "rgba(16,185,129,.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 11, display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: isBefore ? "rgba(239,68,68,.14)" : "rgba(16,185,129,.14)",
          border: `1px solid ${isBefore ? "rgba(239,68,68,.35)" : "rgba(16,185,129,.4)"}`,
          color: isBefore ? "#f87171" : "#34d399", flexShrink: 0,
        }}>
          {isBefore ? <MessagesSquare size={17} aria-hidden="true" /> : <FileText size={17} aria-hidden="true" />}
        </span>
        <b style={{ fontSize: 15.5, fontWeight: 900, color: isBefore ? "#fca5a5" : "#6ee7b7" }}>{title}</b>
      </div>
      {children}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((it) => (
          <div key={it} style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "rgba(255,255,255,.66)", fontWeight: 600,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3, flexShrink: 0,
              background: isBefore ? "#ef4444" : "#10b981", opacity: .85,
            }} aria-hidden="true" />
            {tr(it)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BeforeAfter() {
  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "stretch" }}>
      {/* قبل */}
      <Panel
        tone="before"
        title={tr("قبل — الوضع الحالي")}
        items={[
          "طلبات واتساب متفرقة تضيع بين الشاتات",
          "ملفات Excel غير متزامنة بين الفريق",
          "أرقام ناقصة ومبالغ غير محدَّثة",
          "تحصيل متأخر بلا تذكير منظم",
        ]}
      >
        {/* فقاعات واتساب متناثرة */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {[
            [tr("العميل"), tr("محتاج فاتورة آخر شهر 🙏")],
            [tr("أنت"), tr("أرسلها لك بكرة إن شاء الله")],
            [tr("العميل"), tr("آخر دفعة كانت كام بالضبط؟")],
          ].map(([who, msg], i) => (
            <div key={i} style={{ display: "flex", justifyContent: i % 2 ? "flex-end" : "flex-start" }}>
              <span style={{
                maxWidth: "78%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: i % 2 ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                padding: "6px 11px", fontSize: 11.5, color: "rgba(255,255,255,.6)", lineHeight: 1.7,
              }}>
                <b style={{ fontSize: 9, color: "rgba(255,255,255,.35)", display: "block", marginBottom: 1 }}>{who}</b>
                {msg}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "rgba(255,255,255,.4)",
          background: "rgba(255,255,255,.03)", border: "1px dashed rgba(255,255,255,.12)", borderRadius: 10, padding: "7px 11px",
        }}>
          <FileSpreadsheet size={14} aria-hidden="true" />
          {tr("نسخة نهائية_v7 (محدثة 2).xlsx")}
        </div>
      </Panel>

      {/* السهم */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
        <span style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg,#e5c558,#9a7318)", color: "#07111f",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 26px rgba(201,162,39,.45)", animation: "sPulse 2.8s ease-in-out infinite",
        }} aria-hidden="true">
          <ArrowLeftRight size={19} strokeWidth={2.4} />
        </span>
      </div>

      {/* بعد */}
      <Panel
        tone="after"
        title={tr("بعد — مع GarfiX")}
        items={[
          "كل طلب يتحول لفاتورة PDF منظمة في ثوانٍ",
          "سجل عميل موحّد مع كشف حساب كامل",
          "تذكيرات واتساب تلقائية للحوال المتأخرة",
          "تقارير لحظية للإيراد والتحصيل",
        ]}
      >
        {/* فاتورة مصغرة + تذكير + مؤشر */}
        <div style={{
          background: "#f8fafc", color: "#0f172a", borderRadius: 14, padding: "10px 13px",
          boxShadow: "0 10px 30px rgba(0,0,0,.3)", fontFamily: "'Inter','Cairo',sans-serif",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <b dir="ltr" style={{ fontSize: 11, fontFamily: "'Inter',sans-serif" }}>INV-1024</b>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#059669", background: "rgba(16,185,129,.14)", borderRadius: 6, padding: "2px 7px" }}>
              {tr("مدفوعة")}
            </span>
          </div>
          {[
            [tr("بنك طاقة ×3"), "87.00"],
            [tr("شاحن سريع ×2"), "38.00"],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#475569", marginBottom: 3 }}>
              <span>{a}</span>
              <span className="s-num" style={{ fontWeight: 700 }}>${b}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed #e2e8f0", marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700 }}>{tr("الإجمالي")}</span>
            <span className="s-num" style={{ fontSize: 12, fontWeight: 900, color: "#b45309" }}>$125.00</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="s-chip" style={{ fontSize: 10.5, padding: "4px 10px" }}>
            <BellRing size={11} aria-hidden="true" /> {tr("تذكير أُرسل تلقائياً")}
          </span>
          <span className="s-chip s-chip-blue" style={{ fontSize: 10.5, padding: "4px 10px" }}>
            <TrendingUp size={11} aria-hidden="true" /> {tr("التحصيل +34%")}
          </span>
          <span className="s-chip" style={{ fontSize: 10.5, padding: "4px 10px" }}>
            <Users size={11} aria-hidden="true" /> {tr("عميل موحّد 360°")}
          </span>
        </div>
      </Panel>
    </div>
  );
}
