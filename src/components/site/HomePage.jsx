"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FEATURES } from "./site-shared";
import { tr } from "@/lib/i18n-app";

/** r13: الصفحة الرئيسية للموقع العام — بطل + إحصاءات + مزايا + الشركات + تيعير المؤسس
 *  r16: بانر «مجاناً لأول 100 مشترك» بعداد مقاعد حيّ + دعوة تسجيل */
export default function HomePage({ stats, companies, content, authed, onEnterApp }) {
  // r16: عدّاد المقاعد المجانية (GET /api/auth/register)
  const [seats, setSeats] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/register")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setSeats(s))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const statsRow = [
    { label: tr("شركات مُدارة"), value: stats?.companies ?? companies.length ?? 4 },
    { label: tr("فاتورة مُصدَرة"), value: stats?.invoices ?? "—" },
    { label: tr("عميل مسجّل"), value: stats?.clients ?? "—" },
    { label: tr("عملات مدعومة"), value: stats?.currencies ?? 1 },
  ];

  const goLogin = (e) => {
    e.preventDefault();
    location.hash = "#/login";
  };
  const goTeam = (e) => {
    e.preventDefault();
    location.hash = "#/team";
  };
  const goFounder = (e) => {
    e.preventDefault();
    location.hash = "#/founder";
  };

  return (
    <div>
      {/* ── البطل ── */}
      <section style={{ padding: "84px 20px 30px", textAlign: "center", position: "relative" }}>
        {/* بطاقة فاتورة عائمة — لمسة بصرية */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", top: 70, insetInlineEnd: "6%", width: 210, padding: "16px 18px",
            background: "rgba(255,255,255,.045)", border: "1px solid rgba(201,162,39,.22)", borderRadius: 14,
            animation: "sFloat 5s ease-in-out infinite", display: "none",
            boxShadow: "0 20px 50px rgba(0,0,0,.4)", textAlign: "start", fontSize: 12,
          }}
          className="s-float-card"
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <b style={{ color: "#e5c558" }}>INV10014</b>
            <span style={{ color: "rgba(255,255,255,.5)" }}>{tr("مدفوعة")}</span>
          </div>
          {[
            [tr("منتج A"), "4 × 2.500"],
            [tr("منتج B"), "2 × 1.750"],
            [tr("التوصيل"), "1.000"],
          ].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,.55)", marginBottom: 6 }}>
              <span>{a}</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px dashed rgba(201,162,39,.3)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <b>{tr("الإجمالي")}</b>
            <b style={{ color: "#e5c558" }}>{tr("15.000 د.ك")}</b>
          </div>
        </div>

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <div className="s-chip s-fade">✦ {tr(content.hero_badge)}</div>
          <h1 className="s-hero-title s-fade s-fade-1">{tr(content.hero_title)}</h1>
          <p className="s-hero-sub s-fade s-fade-2">{tr(content.hero_sub)}</p>

          <div className="s-hero-cta s-fade s-fade-3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {authed ? (
              <button className="s-btn s-btn-gold" onClick={onEnterApp}>{tr("دخول النظام ←")}</button>
            ) : (
              <a className="s-btn s-btn-gold" href="#/login" onClick={goLogin}>{tr("ابدأ الآن — مجاناً ←")}</a>
            )}
            <a className="s-btn s-btn-outline" href="#/team" onClick={goTeam}>{tr("تعرّف على الفريق")}</a>
          </div>
        </div>

        {/* r16: بانر مجاناً لأول 100 مشترك — عدّاد حيّ */}
        {seats && seats.freeOpen && !authed && (
          <div
            className="s-fade s-fade-4"
            style={{
              maxWidth: 620, margin: "34px auto 0", padding: "16px 22px", borderRadius: 16,
              background: "linear-gradient(135deg,rgba(201,162,39,.16),rgba(201,162,39,.05))",
              border: "1px solid rgba(201,162,39,.4)", display: "flex", alignItems: "center",
              gap: 16, flexWrap: "wrap", justifyContent: "center", textAlign: "center",
            }}
          >
            <div style={{ fontSize: 30 }}>🎁</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b style={{ fontSize: 15, display: "block", marginBottom: 4, color: "#e5c558" }}>
                {tr("مجاناً لأول")} {seats.limit} {tr("مشترك")}
              </b>
              <span style={{ color: "rgba(255,255,255,.65)", fontSize: 12.5 }}>
                {tr("متبقي")} <b style={{ color: "#e5c558", fontSize: 14 }}>{seats.remaining}</b> {tr("مقعداً — سجّل الآن واحصل على شركتك الخاصة بفواتير وعملاء وتقارير")}
              </span>
              {/* شريط تقدّم المقاعد المحجوزة */}
              <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,.12)", marginTop: 10, overflow: "hidden", direction: "ltr" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${((seats.limit - seats.remaining) / seats.limit) * 100}%`,
                  background: "linear-gradient(90deg,#c9a227,#e5c558)",
                  transition: "width .6s ease",
                }} />
              </div>
            </div>
            <a className="s-btn s-btn-gold" href="#/login" onClick={goLogin} style={{ flexShrink: 0, padding: "10px 22px", fontSize: 13 }}>
              {tr("أنشئ حسابك ←")}
            </a>
          </div>
        )}

        {/* شريط الإحصاءات */}
        <div className="s-fade s-fade-4" style={{ display: "flex", gap: 14, flexWrap: "wrap", maxWidth: 860, margin: "54px auto 0", justifyContent: "center" }}>
          {statsRow.map((s) => (
            <div key={s.label} className="s-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── المزايا ── */}
      <section className="s-section">
        <h2 className="s-section-title">{tr("كل ما تحتاجه إدارة مالية كاملة")}</h2>
        <p className="s-section-sub">{tr("مصمّم لطريقة عمل التجار الكويتيين فعلاً — لا شاشات معقّدة ولا مصطلحات مترجمة حرفياً")}</p>
        <div className="s-features">
          {DEFAULT_FEATURES.map((f) => (
            <div key={f.title} className="s-card s-card-hover">
              <div style={{ fontSize: 34, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800 }}>{tr(f.title)}</h3>
              <p style={{ margin: 0, color: "rgba(255,255,255,.58)", fontSize: 13.5, lineHeight: 1.9 }}>{tr(f.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── الشركات ── */}
      {companies.length > 0 && (
        <section className="s-section" style={{ paddingTop: 0 }}>
          <h2 className="s-section-title">{tr("شركات المجموعة")}</h2>
          <p className="s-section-sub">{tr("كل شركة بحسابها المستقل وعملتها الخاصة — وتُدار من لوحة واحدة")}</p>
          <div className="s-companies">
            {companies.map((c) => (
              <div key={c.slug} className="s-card s-card-hover" style={{ textAlign: "center", padding: "22px 14px" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{c.emoji || c.logo || "🏢"}</div>
                <b style={{ display: "block", fontSize: 15.5, marginBottom: 6 }}>{tr(c.nameAr || c.name)}</b>
                <span className="s-chip" style={{ fontSize: 10.5, padding: "3px 10px" }}>
                  💱 {c.currency || "KWD"}
                </span>
                {c.manager && (
                  <div style={{ marginTop: 10, color: "rgba(255,255,255,.45)", fontSize: 11.5 }}>
                    {tr("مدير:")} {c.manager}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── تيعير رسالة المؤسس ── */}
      <section className="s-section" style={{ paddingTop: 0 }}>
        <div className="s-card" style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", borderColor: "rgba(201,162,39,.3)" }}>
          <div
            style={{
              width: 92, height: 92, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#c9a227,#a07c1a)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40, boxShadow: "0 8px 30px rgba(201,162,39,.45)", animation: "sPulse 3.4s ease-in-out infinite",
            }}
            aria-hidden="true"
          >
            {content.founder_emoji || "👨‍💼"}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="s-quote-mark" style={{ fontSize: 54, marginBottom: 4 }} aria-hidden="true">❝</div>
            <p style={{ margin: "0 0 14px", fontSize: 15.5, lineHeight: 2, color: "rgba(255,255,255,.75)", fontWeight: 600 }}>
              {tr("«إدارة المال ليست جداول وأرقاماً — بل ثقة تُبنى بفاتورة واضحة ورصيد محسوب بدقة.»")}
            </p>
            <b style={{ fontSize: 14.5 }}>{tr(content.founder_name)}</b>
            <div style={{ color: "#c9a227", fontSize: 12, marginTop: 3, fontWeight: 700 }}>{tr(content.founder_title)}</div>
          </div>
          <a className="s-btn s-btn-outline" href="#/founder" onClick={goFounder} style={{ flexShrink: 0 }}>
            {tr("اقرأ رسالة المؤسس ←")}
          </a>
        </div>
      </section>

      {/* ── دعوة أخيرة ── */}
      <section className="s-section" style={{ paddingTop: 0, paddingBottom: 80 }}>
        <div
          style={{
            textAlign: "center", padding: "44px 24px", borderRadius: 20,
            background: "linear-gradient(135deg,rgba(201,162,39,.14),rgba(201,162,39,.04))",
            border: "1px solid rgba(201,162,39,.3)",
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,27px)", fontWeight: 900 }}>
            {tr("جاهز تنظّم مالية شركاتك؟")}
          </h2>
          <p style={{ color: "rgba(255,255,255,.6)", margin: "0 0 22px", fontSize: 14 }}>
            {seats && seats.freeOpen
              ? tr("أنشئ حسابك الآن — مجاناً لأول 100 مشترك، بدون بطاقة ولا التزام.")
              : tr("سجّل الدخول الآن — بياناتك بانتظارك في لوحة واحدة.")}
          </p>
          {authed ? (
            <button className="s-btn s-btn-gold" onClick={onEnterApp}>{tr("دخول النظام ←")}</button>
          ) : (
            <a className="s-btn s-btn-gold" href="#/login" onClick={goLogin}>{tr("أنشئ حسابك المجاني ←")}</a>
          )}
        </div>
      </section>

      <style>{`
        @media(min-width:960px){.s-float-card{display:block!important}}
        @media(max-width:960px){.s-float-card{display:none!important}}
      `}</style>
    </div>
  );
}
