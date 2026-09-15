"use client";

/**
 * r24: AiActionDemo — عرض حيّ لإجراءات GarfiX AI من الشات.
 * سيناريو: طلب المستخدم (يُكتب تلقائياً) → تفكير AI → كارت مراجعة
 * (العميل/البنود/الإجمالي/الضريبة/العملة) → زر «الموافقة والإنشاء» → نجاح.
 *  - الضريبة تتبع الدولة المختارة في شريط التحكم (KW 5% · SA 15% · EG 14%…).
 *  - العملة تتبع الشريط أيضاً (fxFromUsd).
 *  - يبدأ تلقائياً عند الظهور (IntersectionObserver) ويتحترم prefers-reduced-motion.
 *  - بعد الموافقة: حالة نجاح + زر إعادة التشغيل (لا حلقة مزعجة أثناء القراءة).
 */
import { useEffect, useRef, useState } from "react";
import { Check, FileText, MessageSquare, RefreshCw, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";
import { fxFromUsd } from "./site-shared";

const VAT_BY_COUNTRY = { KW: 0.05, SA: 0.15, AE: 0.05, EG: 0.14, PS: 0.16, US: 0 };

export default function AiActionDemo({ currency = "USD", taxOn = true, country = "KW" }) {
  const { lang } = useI18n();
  const [phase, setPhase] = useState("idle");
  const [typed, setTyped] = useState("");
  const boxRef = useRef(null);
  const timerRef = useRef(null);

  const prompt = lang === "ar"
    ? "أنشئ فاتورة لأحمد: 3 بنوك طاقة، 2 شاحن سريع، والتوصيل مجاني"
    : "Create an invoice for Ahmed, 3 power banks, 2 fast chargers, delivery free";

  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  /* بدء العرض عند الظهور (مرة واحدة) */
  useEffect(() => {
    const el = boxRef.current;
    if (!el || phase !== "idle") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        if (reduced) { setPhase("review"); return; }
        setPhase("typing");
      }
    }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* الكتابة التلقائية */
  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length < prompt.length) {
      const id = setTimeout(() => setTyped((s) => prompt.slice(0, s.length + 1)), 26);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setPhase("thinking"), 420);
    return () => clearTimeout(id);
  }, [phase, typed, prompt]);

  /* التفكير → المراجعة */
  useEffect(() => {
    if (phase !== "thinking") return;
    const id = setTimeout(() => setPhase("review"), 900);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => clearTimer, []);

  const replay = () => {
    clearTimer();
    setTyped("");
    setPhase(reduced ? "review" : "typing");
  };

  /* حسابات كارت المراجعة */
  const items = [
    { name: lang === "ar" ? "بنك طاقة" : "Power Bank", qty: 3, unit: 29 },
    { name: lang === "ar" ? "شاحن سريع" : "Fast Charger", qty: 2, unit: 19 },
    { name: lang === "ar" ? "التوصيل" : "Delivery", qty: 1, unit: 0 },
  ];
  const subtotal = items.reduce((s, i) => s + i.qty * i.unit, 0); // 125
  const vat = taxOn ? (VAT_BY_COUNTRY[country] ?? 0) : 0;
  const taxVal = subtotal * vat;
  const total = subtotal + taxVal;

  const showReview = phase === "review" || phase === "approved";

  return (
    <div ref={boxRef} style={{ display: "flex", gap: 22, alignItems: "stretch", flexWrap: "wrap" }}>
      {/* نافذة الشات */}
      <div style={{
        flex: "1.35", minWidth: 300, display: "flex", flexDirection: "column",
        background: "rgba(7,17,31,.75)", backdropFilter: "blur(16px)",
        border: "1px solid rgba(201,162,39,.22)", borderRadius: 20, overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,.45)",
      }}>
        {/* رأس الشات */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9, padding: "11px 16px",
          borderBottom: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)",
        }}>
          <span style={{
            width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(37,99,235,.4)",
          }}>
            <Sparkles size={15} color="#fff" />
          </span>
          <b style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "'Inter','Cairo',sans-serif" }}>GarfiX AI</b>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#34d399", background: "rgba(16,185,129,.15)", borderRadius: 6, padding: "2px 7px", fontFamily: "'Inter',sans-serif" }}>● LIVE</span>
          <span style={{ flex: 1 }} />
          <button
            type="button" onClick={replay} title={tr("إعادة تشغيل العرض")}
            style={{
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.7)",
              borderRadius: 8, padding: "5px 9px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 10.5, fontWeight: 700, fontFamily: "inherit",
            }}
          >
            <RefreshCw size={12} aria-hidden="true" /> {tr("إعادة")}
          </button>
        </div>

        {/* جسم الشات */}
        <div style={{ padding: "16px 16px 18px", display: "flex", flexDirection: "column", gap: 12, minHeight: 250 }}>
          {/* رسالة المستخدم */}
          {(phase !== "idle") && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                maxWidth: "82%", background: "rgba(201,162,39,.14)", border: "1px solid rgba(201,162,39,.3)",
                borderRadius: "14px 14px 4px 14px", padding: "9px 13px", fontSize: 12.5, lineHeight: 1.8, color: "#fff",
              }}>
                {phase === "typing" ? (
                  <>
                    {typed}
                    <span style={{ display: "inline-block", width: 2, height: 14, background: "#e5c558", marginInlineStart: 2, verticalAlign: "-2px", animation: "sBlink .9s steps(2) infinite" }} />
                  </>
                ) : prompt}
              </div>
            </div>
          )}

          {/* تفكير AI */}
          {phase === "thinking" && (
            <div style={{ display: "flex", gap: 5, alignItems: "center", color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 700 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: 5, background: "#93c5fd",
                  animation: `sThink 1s ease-in-out ${i * 0.16}s infinite`,
                }} />
              ))}
              {tr("يحلّل الطلب ويرتب الفاتورة…")}
            </div>
          )}

          {/* رد AI: كارت المراجعة */}
          {showReview && (
            <div style={{
              maxWidth: "94%", background: "#f8fafc", color: "#0f172a", borderRadius: "4px 14px 14px 14px",
              padding: "12px 14px", boxShadow: "0 10px 30px rgba(0,0,0,.35)",
              animation: "sFadeUp .4s ease both", fontFamily: "'Inter','Cairo',sans-serif",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                <FileText size={14} color="#2563eb" aria-hidden="true" />
                <b style={{ fontSize: 12.5, fontWeight: 800 }}>{tr("مسودة فاتورة — بانتظار مراجعتك")}</b>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 8 }}>
                <span style={{ color: "#64748b", fontWeight: 700 }}>{tr("العميل")}</span>
                <b style={{ fontWeight: 800 }}>{tr("أحمد")}</b>
              </div>

              <div style={{ borderTop: "1px solid #e8edf3", paddingTop: 8, display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                {items.map((it) => (
                  <div key={it.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#334155" }}>
                    <span>{it.name} <span className="s-num" style={{ color: "#94a3b8", fontWeight: 700 }}>×{it.qty}</span></span>
                    <span className="s-num" style={{ fontWeight: 700 }}>{it.unit === 0 ? tr("مجاني") : fxFromUsd(it.qty * it.unit, currency, lang)}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                  <span>{tr("المجموع الفرعي")}</span>
                  <span className="s-num" style={{ fontWeight: 700 }}>{fxFromUsd(subtotal, currency, lang)}</span>
                </div>
                {taxOn ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                    <span>{tr("ضريبة القيمة المضافة ({0}%)", [Math.round(vat * 100)])}</span>
                    <span className="s-num" style={{ fontWeight: 700 }}>{fxFromUsd(taxVal, currency, lang)}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                    <span>{tr("الضريبة")}</span>
                    <span>{tr("معطّلة")}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                  <span>{tr("الإجمالي")}</span>
                  <span className="s-num" style={{ color: "#b45309" }}>{fxFromUsd(total, currency, lang)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>{tr("العملة")}:</span>
                  <span className="s-chip" style={{ fontSize: 10, padding: "2px 9px" }}>{currency}</span>
                </div>
              </div>

              {phase === "review" ? (
                <button type="button" className="s-btn s-btn-gold" onClick={() => setPhase("approved")} style={{ width: "100%", marginTop: 11, fontSize: 13, padding: "10px 16px", color: "#fff" }}>
                  <Check size={15} aria-hidden="true" /> {tr("الموافقة والإنشاء")}
                </button>
              ) : (
                <div style={{
                  marginTop: 11, display: "flex", alignItems: "center", gap: 7, justifyContent: "center",
                  background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 10,
                  padding: "9px 12px", color: "#059669", fontSize: 12, fontWeight: 800,
                }}>
                  <Check size={14} aria-hidden="true" /> {tr("تم إنشاء الفاتورة INV-1024 وإرسالها للعميل")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* حقل الإدخال */}
        <div style={{ padding: "10px 14px 13px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 11, padding: "8px 12px",
            color: "rgba(255,255,255,.35)", fontSize: 11.5,
          }}>
            <Sparkles size={13} aria-hidden="true" style={{ opacity: .6 }} />
            {tr("اسأل GarfiX AI أي شيء…")}
          </div>
        </div>
      </div>

      {/* خطوات الأمان (يمين/يسار حسب الاتجاه — جنباً إلى جنب في الشاشات الواسعة) */}
      <div style={{ flex: 1, minWidth: 250, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
        {[
          { icon: MessageSquare, t: "اكتب طلبك بلغتك", d: "فاتورة، عميل، دفعة، أو سؤال تحليلي — من نفس الشات." },
          { icon: Wand2, t: "AI يجهّز الكيان كاملاً", d: "يفهم البنود والكميات والأسعار ويرتب كل الحقول." },
          { icon: ShieldCheck, t: "لا تنفيذ بدون مراجعتك", d: "كل إجراء يظهر كمسودة أولاً — أنت من يوافق وينشئ." },
        ].map((s, i) => (
          <div key={s.t} style={{
            display: "flex", gap: 12, alignItems: "flex-start", padding: "14px 16px",
            background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 16,
          }}>
            <span style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: i === 2 ? "rgba(16,185,129,.12)" : "rgba(37,99,235,.12)",
              border: i === 2 ? "1px solid rgba(16,185,129,.35)" : "1px solid rgba(37,99,235,.35)",
              color: i === 2 ? "#34d399" : "#93c5fd",
            }}>
              <s.icon size={18} aria-hidden="true" />
            </span>
            <div>
              <b style={{ display: "block", fontSize: 13.5, fontWeight: 800, marginBottom: 3 }}>{tr(s.t)}</b>
              <span style={{ color: "rgba(255,255,255,.55)", fontSize: 12, lineHeight: 1.8 }}>{tr(s.d)}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes sBlink{50%{opacity:0}}
        @keyframes sThink{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
        @media(prefers-reduced-motion:reduce){.s-ai-demo *{animation:none!important}}
      `}</style>
    </div>
  );
}
