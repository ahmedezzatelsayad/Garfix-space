"use client";

/**
 * r24: HeroDashboardMockup — موكاب لوحة GarfiX داخل إطار متصفح فاخر.
 *  - كروت بيضاء نظيفة على خلفية فاتحة (نظام تصميم «داشبورد أبيض»).
 *  - مؤشرات KPI بعملة شريط التحكم (fxFromUsd) وأرقام جدولية.
 *  - رسم إيرادات SVG منحني بمنطقة متدرجة (Catmull-Rom → Bezier).
 *  - بطاقة فاتورة + نافذة GarfiX AI عائمة زجاجية.
 * المحتوى يتبع لغة/اتجاه الواجهة (يعرض دعم RTL/LTR أمام الزائر).
 */
import {
  BarChart3, Bell, Check, FileText, LayoutDashboard, Search, Settings,
  Sparkles, Users, Wallet,
} from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";
import { fxFromUsd } from "./site-shared";

/* منحنى سلس (Catmull-Rom → cubic Bezier) داخل viewBox */
function smoothPath(pts) {
  if (!pts.length) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

const REV = [42, 51, 48, 63, 74, 71, 89, 96, 88, 104, 116, 125]; // ألف دولار/شهر

export default function HeroDashboardMockup({ currency = "USD" }) {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const W = 300, H = 92;
  const pts = REV.map((v, i) => [
    +(i * (W / (REV.length - 1))).toFixed(1),
    +(H - 8 - (v / 125) * (H - 22)).toFixed(1),
  ]);
  const line = smoothPath(pts);
  const area = `${line} L ${W},${H} L 0,${H} Z`;

  const kpis = [
    { label: tr("إجمالي الإيراد"), value: fxFromUsd(12480, currency, lang), delta: "+12.5%", tone: "up" },
    { label: tr("محصَّل"), value: fxFromUsd(8320, currency, lang), delta: "66.8%", tone: "flat" },
    { label: tr("معلَّق"), value: fxFromUsd(4160, currency, lang), delta: "33.2%", tone: "down" },
  ];

  const sideIcons = [LayoutDashboard, FileText, Users, Wallet, BarChart3, Sparkles];

  return (
    <div
      className="s-hero-mock s-fade s-fade-3"
      style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", animation: "sFloat 7s ease-in-out infinite" }}
      aria-hidden="true"
    >
      {/* هالة توهج خلف النافذة */}
      <div style={{
        position: "absolute", inset: "-34px -18px", pointerEvents: "none",
        background: "radial-gradient(58% 55% at 60% 38%, rgba(37,99,235,.16) 0%, transparent 70%), radial-gradient(42% 40% at 30% 70%, rgba(201,162,39,.12) 0%, transparent 70%)",
        filter: "blur(6px)",
      }} />

      {/* إطار المتصفح */}
      <div style={{
        position: "relative", borderRadius: 20, overflow: "hidden",
        border: "1px solid rgba(201,162,39,.28)",
        boxShadow: "0 30px 80px rgba(0,0,0,.6), 0 4px 18px rgba(201,162,39,.12), inset 0 1px 0 rgba(255,255,255,.06)",
        background: "#07111f",
      }}>
        {/* شريط الكروم */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
          background: "linear-gradient(180deg,#0d1e35,#091527)", borderBottom: "1px solid rgba(255,255,255,.06)",
        }}>
          <span style={{ display: "flex", gap: 5 }}>
            {["#ef4444", "#f59e0b", "#10b981"].map((c) => (
              <span key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c, opacity: .9 }} />
            ))}
          </span>
          <span dir="ltr" style={{
            flex: 1, maxWidth: 240, margin: "0 auto", textAlign: "center",
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20,
            padding: "3px 12px", fontSize: 10, color: "rgba(255,255,255,.55)", fontFamily: "'Inter',sans-serif",
          }}>
            app.garfix.space
          </span>
        </div>

        {/* الجسم: شريط جانبي + منطقة فاتحة */}
        <div style={{ display: "flex", minHeight: 328, background: "#f8fafc" }} dir={dir}>
          {/* الشريط الجانبي (يخفي في الجوال) */}
          <div className="s-mock-side" style={{
            width: 46, flexShrink: 0, background: "#07111f", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 4, padding: "10px 0", borderInlineEnd: "1px solid rgba(255,255,255,.06)",
          }}>
            <span style={{
              width: 26, height: 26, borderRadius: 8, marginBottom: 8,
              background: "linear-gradient(135deg,#e5c558,#9a7318)", color: "#07111f",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 13, fontFamily: "'Inter',sans-serif",
            }}>G</span>
            {sideIcons.map((Ic, i) => (
              <span key={i} style={{
                width: 30, height: 30, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: i === 1 ? "rgba(201,162,39,.18)" : "transparent",
                color: i === 1 ? "#e5c558" : "rgba(255,255,255,.5)",
              }}>
                <Ic size={15} strokeWidth={2.1} />
              </span>
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ width: 30, height: 30, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.4)" }}>
              <Settings size={14} />
            </span>
          </div>

          {/* المنطقة الرئيسية الفاتحة */}
          <div style={{ flex: 1, padding: "12px 14px 14px", minWidth: 0, position: "relative" }}>
            {/* ترحيب + بحث */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 12.5, color: "#0f172a", fontWeight: 800, flex: 1, minWidth: 120 }}>
                {tr("صباح الخير، أحمد")} ✦
              </b>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 20, padding: "4px 10px", fontSize: 10, color: "#64748b",
              }}>
                <Search size={11} /> {tr("بحث…")}
              </span>
              <span style={{ position: "relative", color: "#64748b", display: "inline-flex" }}>
                <Bell size={14} />
                <span style={{ position: "absolute", top: -3, insetInlineEnd: -3, width: 7, height: 7, borderRadius: 4, background: "#ef4444", border: "1.5px solid #fff" }} />
              </span>
            </div>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 9 }}>
              {kpis.map((k) => (
                <div key={k.label} style={{
                  background: "#fff", borderRadius: 12, padding: "8px 9px",
                  border: "1px solid #e8edf3", boxShadow: "0 2px 8px rgba(15,23,42,.05)",
                }}>
                  <div style={{ fontSize: 8.5, color: "#64748b", fontWeight: 700, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.label}</div>
                  <div className="s-num" style={{ fontSize: 11.5, fontWeight: 900, color: "#0f172a", fontFamily: "'Inter','Cairo',sans-serif", whiteSpace: "nowrap" }}>{k.value}</div>
                  <div className="s-num" style={{
                    marginTop: 2, display: "inline-block", fontSize: 8, fontWeight: 800, borderRadius: 6, padding: "1px 5px",
                    background: k.tone === "up" ? "rgba(16,185,129,.12)" : k.tone === "down" ? "rgba(239,68,68,.1)" : "rgba(37,99,235,.1)",
                    color: k.tone === "up" ? "#059669" : k.tone === "down" ? "#dc2626" : "#2563eb",
                  }}>{k.delta}</div>
                </div>
              ))}
            </div>

            {/* الرسم + الفاتورة */}
            <div style={{ display: "flex", gap: 7, alignItems: "stretch" }}>
              {/* رسم الإيرادات */}
              <div style={{
                flex: 2.1, minWidth: 0, background: "#fff", borderRadius: 12, padding: "9px 10px 6px",
                border: "1px solid #e8edf3", boxShadow: "0 2px 8px rgba(15,23,42,.05)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#0f172a" }}>{tr("نظرة على الإيراد")}</span>
                  <span className="s-num" style={{ fontSize: 8, color: "#059669", fontWeight: 800, background: "rgba(16,185,129,.12)", borderRadius: 6, padding: "1px 5px" }}>+18.4%</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="76" preserveAspectRatio="none" style={{ display: "block" }}>
                  <defs>
                    <linearGradient id="mockArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity=".02" />
                    </linearGradient>
                    <linearGradient id="mockLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#c9a227" />
                    </linearGradient>
                  </defs>
                  {[18, 46, 74].map((y) => (
                    <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="#eef2f7" strokeWidth="1" strokeDasharray="3 4" />
                  ))}
                  <path d={area} fill="url(#mockArea)" />
                  <path d={line} fill="none" stroke="url(#mockLine)" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx={pts[pts.length - 1][0] - 1} cy={pts[pts.length - 1][1]} r="3.4" fill="#c9a227" stroke="#fff" strokeWidth="1.6" />
                </svg>
                <div dir="ltr" style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#94a3b8", fontFamily: "'Inter',sans-serif", fontWeight: 600, marginTop: 2 }}>
                  {["JAN", "APR", "JUL", "OCT", "DEC"].map((m) => <span key={m}>{m}</span>)}
                </div>
              </div>

              {/* بطاقة الفاتورة */}
              <div style={{
                flex: 1, minWidth: 108, background: "#fff", borderRadius: 12, padding: "9px 10px",
                border: "1px solid #e8edf3", boxShadow: "0 2px 8px rgba(15,23,42,.05)",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span dir="ltr" style={{ fontSize: 9, fontWeight: 900, color: "#0f172a", fontFamily: "'Inter',sans-serif" }}>INV-1024</span>
                  <span style={{ fontSize: 7.5, fontWeight: 800, color: "#b45309", background: "rgba(245,158,11,.14)", borderRadius: 6, padding: "1px 5px" }}>
                    {tr("بانتظار الموافقة")}
                  </span>
                </div>
                {[
                  [tr("بنك طاقة") + " ×3", fxFromUsd(87, currency, lang)],
                  [tr("شاحن سريع") + " ×2", fxFromUsd(38, currency, lang)],
                  [tr("التوصيل"), tr("مجاني")],
                ].map(([a, b]) => (
                  <div key={a} style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#475569", marginBottom: 3 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a}</span>
                    <span className="s-num" style={{ fontWeight: 700, flexShrink: 0 }}>{b}</span>
                  </div>
                ))}
                <div style={{ marginTop: "auto", borderTop: "1px dashed #e2e8f0", paddingTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 8.5, color: "#64748b", fontWeight: 700 }}>{tr("الإجمالي")}</span>
                  <span className="s-num" style={{ fontSize: 10, fontWeight: 900, color: "#b45309" }}>{fxFromUsd(125, currency, lang)}</span>
                </div>
              </div>
            </div>

            {/* نافذة GarfiX AI العائمة (داخل الإطار — لا فوضى خارجية) */}
            <div className="s-mock-ai" style={{
              position: "absolute", bottom: 12, insetInlineEnd: 12, width: 218,
              background: "rgba(7,17,31,.92)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(201,162,39,.35)", borderRadius: 14,
              boxShadow: "0 14px 40px rgba(0,0,0,.45)", padding: "9px 11px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ width: 20, height: 20, borderRadius: 7, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={11} color="#fff" />
                </span>
                <b style={{ fontSize: 10, color: "#fff", fontWeight: 800, fontFamily: "'Inter','Cairo',sans-serif" }}>GarfiX AI</b>
                <span style={{ fontSize: 7, fontWeight: 800, color: "#34d399", background: "rgba(16,185,129,.15)", borderRadius: 5, padding: "1px 5px" }}>● LIVE</span>
              </div>
              <div style={{
                background: "rgba(255,255,255,.07)", borderRadius: "10px 10px 3px 10px",
                padding: "5px 8px", fontSize: 8.5, color: "rgba(255,255,255,.85)", lineHeight: 1.6, marginBottom: 5,
              }}>
                {tr("أنشئ فاتورة لأحمد: 3 بنوك طاقة، شاحنين، والتوصيل مجاني")}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(201,162,39,.12)", border: "1px solid rgba(201,162,39,.3)",
                borderRadius: 8, padding: "4px 8px", fontSize: 8, color: "#e5c558", fontWeight: 700,
              }}>
                <Check size={10} /> {tr("جاهزة للمراجعة — بانتظار موافقتك")}
              </div>
              <div style={{
                marginTop: 7, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8, padding: "4px 8px", fontSize: 8, color: "rgba(255,255,255,.4)",
              }}>
                {tr("اسأل GarfiX AI أي شيء…")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:720px){
          .s-mock-side{display:none!important}
          .s-mock-ai{position:static!important;width:auto!important;margin-top:9px}
        }
        @media(prefers-reduced-motion:reduce){.s-hero-mock{animation:none!important}}
      `}</style>
    </div>
  );
}
