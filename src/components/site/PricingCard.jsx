"use client";

/**
 * r24: PricingCard — باقة واحدة واضحة كما اقتضت الاستراتيجية:
 * $10 / شركة / شهرياً (تُحوَّل لعملة شريط التحكم بتفريب تقريبي)
 * + شريط «مجاناً لأول 100 شركة» بعداد مقاعد حي من الخادم.
 */
import { Check, Gift, Rocket } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";
import { fxFromUsd } from "./site-shared";

export default function PricingCard({ currency = "USD", taxOn = true, seats = null, onGo }) {
  const { lang } = useI18n();

  const features = [
    tr("فواتير غير محدودة مع PDF عربي كامل"),
    tr("عملاء غير محدودون مع سجل 360°"),
    tr("مساعد ذكي جاهز — ينفذ بعد مراجعتك"),
    tr("تعدد العملات والشركات"),
    tr("تحصيل وتذكيرات واتساب"),
    tr("إلغاء في أي وقت — بلا التزام"),
  ];
  if (taxOn) features.splice(4, 0, tr("دعم ضريبة القيمة المضافة"));

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", width: "100%" }}>
      <div
        className="s-fade"
        style={{
          position: "relative", borderRadius: 24, padding: "30px 28px", textAlign: "center",
          background: "linear-gradient(165deg,rgba(201,162,39,.14) 0%,rgba(255,255,255,.035) 40%,rgba(37,99,235,.08) 100%)",
          border: "1.5px solid rgba(201,162,39,.4)", backdropFilter: "blur(16px)",
          boxShadow: "0 28px 70px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08)",
        }}
      >
        {/* شريط الباقة */}
        <span className="s-chip" style={{ marginBottom: 16 }}>{tr("باقة واحدة واضحة")}</span>

        {/* السعر */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span className="s-num" style={{ fontSize: 46, fontWeight: 900, color: "#e5c558", fontFamily: "'Inter','Cairo',sans-serif", textShadow: "0 4px 26px rgba(201,162,39,.35)" }}>
            {fxFromUsd(10, currency, lang)}
          </span>
          <span style={{ color: "rgba(255,255,255,.6)", fontSize: 13.5, fontWeight: 700 }}>{tr("/ شركة / شهرياً")}</span>
        </div>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginBottom: 20, fontFamily: "'Inter','Cairo',sans-serif" }}>
          {currency === "USD"
            ? tr("أساس التسعير — بالدولار الأمريكي")
            : tr("تقريب تقريبي بعملة العرض — الأساس بالدولار")}
        </div>

        {/* المزايا */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9, textAlign: "start", marginBottom: 22 }}>
          {features.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
              <span style={{
                width: 20, height: 20, borderRadius: 7, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "rgba(16,185,129,.14)", border: "1px solid rgba(16,185,129,.35)", color: "#34d399",
              }}>
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              </span>
              <span style={{ color: "rgba(255,255,255,.82)", fontWeight: 600 }}>{f}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a className="s-btn s-btn-gold" href="#/login?mode=register" onClick={onGo} style={{ width: "100%", fontSize: 15, padding: "14px 20px" }}>
          <Rocket size={17} aria-hidden="true" /> {tr("ابدأ مجاناً — بلا بطاقة")}
        </a>

        {/* عدّاد المقاعد الحي */}
        {seats && seats.freeOpen && (
          <div style={{
            marginTop: 14, display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap",
            background: "rgba(201,162,39,.1)", border: "1px solid rgba(201,162,39,.3)", borderRadius: 12, padding: "8px 13px",
          }}>
            <Gift size={14} color="#e5c558" aria-hidden="true" />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#e5c558" }}>
              {tr("مجاناً لأول {0} شركة", [seats.limit])}
            </span>
            <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", fontWeight: 700 }}>
              {tr("— متبقي")} <b className="s-num" style={{ color: "#e5c558" }}>{seats.remaining}</b> {tr("مقعداً")}
            </span>
          </div>
        )}
      </div>

      <p style={{ textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 11.5, margin: "14px 4px 0", lineHeight: 1.8 }}>
        {tr("تفاصيل الباقات حسب بلدك في صفحة التسعير — التسجيل الذاتي مفتوح الآن لأول 100 شركة.")}
      </p>
    </div>
  );
}
