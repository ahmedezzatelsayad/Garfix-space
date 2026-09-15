"use client";

/**
 * r24: FounderTrustBlock — قسم الثقة: اقتباس المؤسس (من محتوى مدير الموقع)
 * + إحصاءات الجاهزية العالمية (196 دولة · 28 لغة · أي عملة · مراجعة AI).
 */
import { Coins, FileCheck2, Globe, Languages, Quote } from "lucide-react";
import { tr } from "@/lib/i18n-app";

export default function FounderTrustBlock({ content, onGoFounder }) {
  const stats = [
    { icon: Globe, value: "196", label: "دولة بتغطية تسعيرية حسب بلد الزائر" },
    { icon: Languages, value: "28", label: "لغة لواجهة الموقع مع RTL/LTR كامل" },
    { icon: Coins, value: "أي عملة", label: "لكل شركة عملتها ورمزها وكسورها" },
    { icon: FileCheck2, value: "PDF عربي", label: "فواتير جاهزة للطباعة والإرسال" },
  ];

  return (
    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "stretch" }}>
      {/* اقتباس المؤسس */}
      <div
        className="s-card s-card-hover"
        style={{ flex: "1.2", minWidth: 280, padding: "26px 28px", borderColor: "rgba(201,162,39,.3)", display: "flex", flexDirection: "column" }}
      >
        <Quote size={30} color="rgba(201,162,39,.4)" aria-hidden="true" style={{ marginBottom: 8 }} />
        <p style={{ margin: "0 0 16px", fontSize: 15.5, lineHeight: 2, color: "rgba(255,255,255,.8)", fontWeight: 600, flex: 1 }}>
          {tr("«إدارة المال ليست جداول وأرقاماً — بل ثقة تُبنى بفاتورة واضحة ورصيد محسوب بدقة.»")}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#e5c558,#9a7318)", display: "inline-flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 26px rgba(201,162,39,.4)", color: "#07111f", fontWeight: 900, fontSize: 22,
              fontFamily: "'Inter','Cairo',sans-serif",
            }}
          >
            {(content.founder_name || "A").trim().charAt(0)}
          </span>
          <div style={{ flex: 1, minWidth: 150 }}>
            <b style={{ fontSize: 14.5, display: "block" }}>{tr(content.founder_name)}</b>
            <div style={{ color: "#c9a227", fontSize: 12, marginTop: 2, fontWeight: 700 }}>{tr(content.founder_title)}</div>
          </div>
          <a className="s-btn s-btn-outline" href="#/founder" onClick={onGoFounder} style={{ flexShrink: 0, fontSize: 12.5 }}>
            {tr("رسالة المؤسس")}
          </a>
        </div>
      </div>

      {/* إحصاءات الجاهزية العالمية */}
      <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {stats.map((s) => (
          <div key={s.label} className="s-card s-card-hover" style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <s.icon size={20} color="#e5c558" aria-hidden="true" />
            <b style={{ fontSize: 21, fontWeight: 900, fontFamily: "'Inter','Cairo',sans-serif", lineHeight: 1.2 }}>{tr(s.value)}</b>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11.5, lineHeight: 1.7 }}>{tr(s.label)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
