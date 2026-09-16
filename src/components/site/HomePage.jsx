"use client";

/**
 * r24: الصفحة الرئيسية العالمية — «GarfiX — AI Business OS».
 * التحول من «نظام فواتير كويتي» إلى SaaS عالمي فاخر يبيع الاشتراك من أول شاشة:
 *  1. شريط الجاهزية (196 دولة · 27 لغة · أي عملة) فوق البطل.
 *  2. بطل مقسوم: سلايدر «مرحباً بالعالم» + العنوان الجديد + CTA (ابدأ مجاناً / شاهد العرض)
 *     + موكاب لوحة GarfiX (فواتير + AI + مؤشرات) — الاتجاه يتبع لغة الزائر.
 *  3. شريط التحكم العالمي التفاعلي (لغة/اتجاه/عملة/ضريبة/دولة) — حالة مرفوعة تُغذي
 *     الموكاب وعرض الـAI والتسعير بالعملة المختارة.
 *  4. وحدات المنتج الست · عرض GarfiX AI الحي (كتابة → مراجعة → موافقة)
 *     · قبل/بعد (واتساب → محاسبة نظيفة) · تسعير باقة واحدة · ثقة المؤسس · دعوة أخيرة.
 * يُحافظ على: عدّاد المقاعد الحي، إحصاءات الخادم، شركات المجموعة، ومحتوى مدير الموقع.
 */
import { useEffect, useState } from "react";
import { Coins, Globe, Languages, Play, Rocket, Sparkles } from "lucide-react";
import HelloSlider from "./HelloSlider";
import HeroDashboardMockup from "./HeroDashboardMockup";
import GlobalControlStrip from "./GlobalControlStrip";
import FeatureModuleCard, { MODULES } from "./FeatureModuleCard";
import AiActionDemo from "./AiActionDemo";
import BeforeAfter from "./BeforeAfter";
import PricingCard from "./PricingCard";
import FounderTrustBlock from "./FounderTrustBlock";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";
import { fxFromUsd } from "./site-shared";

/* عنوان قسم موحّد (خارج جسم المكوّن — بلا إنشاء مكوّنات أثناء الرسم) */
function SectionTitle({ title, sub }) {
  return (
    <>
      <h2 className="s-section-title">{title}</h2>
      <p className="s-section-sub">{sub}</p>
    </>
  );
}

export default function HomePage({ stats, companies, content, authed, onEnterApp }) {
  const { lang } = useI18n();
  // r16: عدّاد المقاعد المجانية (GET /api/auth/register) — يُستخدم في البطل والتسعير
  const [seats, setSeats] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/register")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setSeats(s))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  /* حالة شريط التحكم العالمي — تُغذّي الموكاب والتسعير وعرض الـAI */
  const [currency, setCurrency] = useState("KWD");
  const [taxOn, setTaxOn] = useState(true);
  const [country, setCountry] = useState("KW");

  const goRegister = (e) => {
    e.preventDefault();
    location.hash = "#/login?mode=register";
  };
  const goPricing = (e) => {
    e.preventDefault();
    location.hash = "#/pricing";
  };
  const watchDemo = (e) => {
    e.preventDefault();
    document.getElementById("ai-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statsRow = [
    { label: tr("شركات مُدارة"), value: stats?.companies ?? companies.length ?? 4 },
    { label: tr("فاتورة مُصدَرة"), value: stats?.invoices ?? "—" },
    { label: tr("عميل مسجّل"), value: stats?.clients ?? "—" },
    { label: tr("عملات مدعومة"), value: stats?.currencies ?? 1 },
  ];

  return (
    <div>
      {/* ── شريط الجاهزية العالمية (فوق البطل) ── */}
      <div style={{ paddingTop: 14 }}>
        <div className="s-fade" style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", padding: "0 16px" }}>
          {[
            { icon: Globe, text: tr("يعمل في 196 دولة") },
            { icon: Languages, text: tr("27 لغة") },
            { icon: Coins, text: tr("أي عملة") },
          ].map(({ icon: Ic, text }) => (
            <span key={text} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,.045)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 30, padding: "5px 13px", fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,.66)",
            }}>
              <Ic size={12.5} color="#e5c558" aria-hidden="true" /> {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── البطل: نص + موكاب (الاتجاه يتبع اللغة) ── */}
      <section style={{ padding: "18px 20px 34px", position: "relative" }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto", display: "flex", gap: 34, alignItems: "center",
          flexWrap: "wrap",
        }}>
          {/* عمود النص */}
          <div style={{ flex: "1.08", minWidth: 290, textAlign: "center" }}>
            <div className="s-chip s-fade" style={{ marginBottom: 2 }}>
              <Sparkles size={13} aria-hidden="true" />
              {tr("AI Business OS — نظام تشغيل الأعمال الذكي")}
            </div>

            {/* سلايدر «مرحباً بالعالم» — تحية الموقع بأسلوب آبل بكل لغات العالم */}
            <HelloSlider compact />

            <h1 className="s-hero-title s-fade s-fade-2" style={{ fontSize: "clamp(22px, 3.4vw, 34px)", margin: "4px 0 12px", textShadow: "0 2px 34px rgba(201,162,39,.28)" }}>
              {tr("جارفيكس — نظام تشغيل ذكي للفواتير والمدفوعات وإدارة الشركات")}
            </h1>
            <p className="s-hero-sub s-fade s-fade-3" style={{ margin: "0 auto 24px", fontSize: "clamp(13.5px, 1.8vw, 16px)" }}>
              {tr("أدِر الفواتير، التحصيل، العملاء، التقارير، والذكاء الاصطناعي من لوحة واحدة — لأي شركة في أي دولة، بأي عملة وبلغتك.")}
            </p>

            <div className="s-hero-cta s-fade s-fade-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {authed ? (
                <button className="s-btn s-btn-gold" onClick={onEnterApp} style={{ padding: "13px 26px", fontSize: 14.5 }}>
                  <Rocket size={16} aria-hidden="true" /> {tr("دخول النظام")}
                </button>
              ) : (
                <a className="s-btn s-btn-gold" href="#/login?mode=register" onClick={goRegister} style={{ padding: "13px 26px", fontSize: 14.5 }}>
                  <Rocket size={16} aria-hidden="true" /> {tr("ابدأ مجاناً")}
                </a>
              )}
              <a className="s-btn s-btn-ghost" href="#/" onClick={watchDemo} style={{ padding: "13px 22px", fontSize: 14 }} aria-label={tr("شاهد عرض الـ90 ثانية")}>
                <Play size={15} aria-hidden="true" /> {tr("شاهد عرض الـ90 ثانية")}
              </a>
            </div>

            {/* ملاحظة تحت الأزرار */}
            <div className="s-fade s-fade-4" style={{ marginTop: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, flexWrap: "wrap", color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: "#34d399", boxShadow: "0 0 10px rgba(52,211,153,.7)" }} aria-hidden="true" />
              {seats && seats.freeOpen
                ? tr("مجاني لأول {0} شركة — متبقي {1} مقعداً · بلا بطاقة", [seats.limit, seats.remaining])
                : tr("مجاني لأول 100 شركة · بلا بطاقة ولا التزام")}
            </div>
          </div>

          {/* عمود الموكاب */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <HeroDashboardMockup currency={currency} />
          </div>
        </div>

        {/* شريط الإحصاءات الحية من الخادم */}
        <div className="s-fade s-fade-4" style={{ display: "flex", gap: 14, flexWrap: "wrap", maxWidth: 980, margin: "44px auto 0", justifyContent: "center" }}>
          {statsRow.map((s) => (
            <div key={s.label} className="s-stat">
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── شريط التحكم العالمي التفاعلي ── */}
      <section style={{ paddingBottom: 10 }}>
        <GlobalControlStrip
          currency={currency} setCurrency={setCurrency}
          taxOn={taxOn} setTaxOn={setTaxOn}
          country={country} setCountry={setCountry}
        />
        <p style={{ textAlign: "center", color: "rgba(255,255,255,.35)", fontSize: 11.5, margin: "12px 0 0", fontWeight: 600 }}>
          {tr("جرّبها بنفسك — بدّل اللغة والعملة والضريبة وشاهد النظام يتكيّف فوراً")}
        </p>
      </section>

      {/* ── وحدات المنتج ── */}
      <section className="s-section">
        <SectionTitle
          title={tr("كل ما تحتاجه لتشغيل شركتك — في نظام واحد")}
          sub={tr("وحدات قائمة فعلاً داخل GarfiX اليوم — ليست وعوداً على خارطة طريق")}
        />
        <div className="s-features">
          {MODULES.map((m) => (
            <FeatureModuleCard key={m.key} icon={m.icon} title={m.title} desc={m.desc} blue={m.blue} />
          ))}
        </div>
      </section>

      {/* ── عرض GarfiX AI الحي ── */}
      <section className="s-section" id="ai-demo" style={{ scrollMarginTop: 84 }}>
        <SectionTitle
          title={tr("ذكاء اصطناعي ينفّذ — ولا يكتفي بالكلام")}
          sub={tr("اطلب فاتورة أو عميلاً أو دفعة من الشات، راجع المسودة كاملة، ثم وافق — يُنشأ كل شيء داخل نظامك")}
        />
        <AiActionDemo currency={currency} taxOn={taxOn} country={country} />
      </section>

      {/* ── قبل / بعد ── */}
      <section className="s-section">
        <SectionTitle
          title={tr("من فوضى واتساب إلى محاسبة نظيفة في ثوانٍ")}
          sub={tr("مصمم لطريقة عمل التجار فعلاً — لا شاشات معقدة ولا مصطلحات مترجمة حرفياً")}
        />
        <BeforeAfter />
      </section>

      {/* ── التسعير: باقة واحدة واضحة ── */}
      <section className="s-section">
        <SectionTitle
          title={tr("تسعير واحد واضح — بلا مفاجآت")}
          sub={tr("ابدأ مجاناً لأول 100 شركة، ثم {0} شهرياً لكل شركة — بإلغاء في أي وقت", [fxFromUsd(10, currency, lang)])}
        />
        <PricingCard currency={currency} taxOn={taxOn} seats={seats} onGo={goRegister} />
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <a href="#/pricing" onClick={goPricing} style={{ color: "#e5c558", fontSize: 13, fontWeight: 700, textDecoration: "none", borderBottom: "1px dashed rgba(201,162,39,.5)", paddingBottom: 2 }}>
            {tr("التسعير التفصيلي حسب بلدك ←")}
          </a>
        </div>
      </section>

      {/* ── ثقة المؤسس + الجاهزية العالمية ── */}
      <section className="s-section">
        <SectionTitle
          title={tr("مبني برؤية واضحة — وثقة تُكتسب بفاتورة")}
          sub={tr("نظام واحد ينمو مع كل شركة تنضم — ويتعلم من كل فاتورة تُصدر")}
        />
        <FounderTrustBlock content={content} onGoFounder={(e) => { e.preventDefault(); location.hash = "#/founder"; }} />
      </section>

      {/* ── شركات المجموعة (بيانات حية) ── */}
      {companies.length > 0 && (
        <section className="s-section" style={{ paddingTop: 0 }}>
          <SectionTitle
            title={tr("شركات تعمل على GarfiX اليوم")}
            sub={tr("كل شركة بحسابها المستقل وعملتها الخاصة — وتُدار من لوحة واحدة")}
          />
          <div className="s-companies">
            {companies.map((c) => (
              <div key={c.slug} className="s-card s-card-hover" style={{ textAlign: "center", padding: "22px 14px" }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>{c.emoji || c.logo || "🏢"}</div>
                <b style={{ display: "block", fontSize: 15.5, marginBottom: 6 }}>{tr(c.nameAr || c.name)}</b>
                <span className="s-chip s-num" style={{ fontSize: 10.5, padding: "3px 10px" }}>{c.currency || "KWD"}</span>
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

      {/* ── الدعوة الأخيرة ── */}
      <section className="s-section" style={{ paddingTop: 0, paddingBottom: 80 }}>
        <div
          className="s-fade"
          style={{
            textAlign: "center", padding: "46px 26px", borderRadius: 24,
            background: "linear-gradient(135deg,rgba(201,162,39,.16) 0%,rgba(11,30,58,.5) 55%,rgba(37,99,235,.12) 100%)",
            border: "1px solid rgba(201,162,39,.32)", position: "relative", overflow: "hidden",
          }}
        >
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(62% 78% at 50% 0%, rgba(201,162,39,.15), transparent 72%)", pointerEvents: "none" }} />
          <h2 style={{ margin: "0 0 10px", fontSize: "clamp(20px,3vw,27px)", fontWeight: 900 }}>
            {tr("جاهز تشغّل شركتك بذكاء؟")}
          </h2>
          <p style={{ color: "rgba(255,255,255,.62)", margin: "0 0 22px", fontSize: 14, lineHeight: 1.9, maxWidth: 560, marginInline: "auto" }}>
            {seats && seats.freeOpen
              ? tr("أنشئ حسابك الآن — مجاناً لأول 100 شركة، بدون بطاقة ولا التزام. أول فاتورتك خلال دقيقتين.")
              : tr("سجّل الدخول الآن — بياناتك بانتظارك في لوحة واحدة.")}
          </p>
          {authed ? (
            <button className="s-btn s-btn-gold" onClick={onEnterApp} style={{ padding: "13px 30px", fontSize: 15 }}>
              <Rocket size={16} aria-hidden="true" /> {tr("دخول النظام")}
            </button>
          ) : (
            <a className="s-btn s-btn-gold" href="#/login?mode=register" onClick={goRegister} style={{ padding: "13px 30px", fontSize: 15 }}>
              <Rocket size={16} aria-hidden="true" /> {tr("أنشئ حسابك المجاني")}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
