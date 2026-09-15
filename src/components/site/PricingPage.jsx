"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LangProvider, useI18n } from "@/lib/i18n-context";
import { SITE_CSS } from "./site-shared";
import { tr } from "@/lib/i18n-app";

/**
 * r18: صفحة الأسعار العامة — خطط الاشتراك بعملة بلد الزائر (١٩٥ دولة)
 * - GET /api/pricing → { plans, geo, countries, freeSeats }
 * - منتقي بلد بحثي (لوحة مفاتيح: ↑ ↓ Enter Esc) يعيد جلب الأسعار بعملة البلد
 * - مغلّفة بـ LangProvider — ذاتية الاكتفاء (تعيد تصيير SITE_CSS)
 */

/* ── منتقي البلد (زر + قائمة بحث مجمّعة: عربية ثم باقي العالم) ── */
function CountrySelect({ countries, value, onChange, busy, t }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef({});

  const needle = q.trim().toLowerCase();
  const match = (c) =>
    !needle ||
    String(c.nameAr || "").includes(q.trim()) ||
    String(c.nameEn || "").toLowerCase().includes(needle) ||
    String(c.code || "").toLowerCase().includes(needle);
  const arab = countries.filter((c) => c.arabic && match(c));
  const rest = countries.filter((c) => !c.arabic && match(c));
  const flat = [...arab, ...rest];

  // إغلاق بالنقر خارج القائمة
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // تمرير العنصر النشط إلى الخانة المرئية
  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const pick = (c) => {
    setOpen(false);
    setQ("");
    setActiveIdx(0);
    if (c && c.code !== value) onChange(c.code);
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const c = flat[activeIdx];
      if (c) {
        e.preventDefault();
        pick(c);
      }
    }
  };

  const current = countries.find((c) => c.code === value);

  const row = (c, idx) => (
    <button
      key={c.code}
      ref={(el) => { itemRefs.current[idx] = el; }}
      type="button"
      role="option"
      aria-selected={idx === activeIdx}
      className="pp-row"
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        background: idx === activeIdx ? "rgba(201,162,39,.16)" : "transparent",
        border: "1px solid transparent", borderRadius: 9,
        padding: "8px 10px", minHeight: 44, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "start",
        color: c.code === value ? "#e5c558" : "rgba(255,255,255,.85)",
      }}
      onMouseEnter={() => setActiveIdx(idx)}
      onClick={() => pick(c)}
    >
      <span style={{ fontSize: 17, flexShrink: 0 }}>{c.flag}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {tr(c.nameAr)}
        <span dir="ltr" style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.4)" }}>
          {c.nameEn}
        </span>
      </span>
      <span dir="ltr" style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", fontWeight: 700, flexShrink: 0 }}>{c.currency}</span>
      {c.vat > 0 && (
        <span className="s-chip" style={{ fontSize: 9.5, padding: "2px 8px", flexShrink: 0 }} dir="ltr">VAT {c.vat}%</span>
      )}
      {c.code === value && <span style={{ fontSize: 11, flexShrink: 0 }}>✓</span>}
    </button>
  );

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }} onKeyDown={onKey}>
      <button
        type="button"
        className="pp-ctry-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("pricing.yourCountry")}
        title={t("pricing.yourCountry")}
        onClick={() => { setOpen((v) => !v); setActiveIdx(0); }}
        style={{
          background: "rgba(255,255,255,.07)", border: "1px solid rgba(201,162,39,.35)", borderRadius: 10,
          color: "#fff", padding: "10px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 800,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44,
          transition: "all .2s",
        }}
      >
        <span style={{ fontSize: 17 }}>{current?.flag || "🌍"}</span>
        <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.nameAr || t("pricing.yourCountry")}
        </span>
        {busy ? <span style={{ fontSize: 12 }}>⏳</span> : <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("pricing.yourCountry")}
          style={{
            position: "absolute", top: "112%", insetInlineEnd: 0, zIndex: 300,
            background: "#0d1e35", border: "1px solid rgba(201,162,39,.35)", borderRadius: 14,
            boxShadow: "0 18px 50px rgba(0,0,0,.6)", padding: 8,
            width: "min(92vw, 330px)",
          }}
        >
          <input
            autoFocus
            type="text"
            dir="auto"
            value={q}
            aria-label={t("common.search")}
            placeholder={t("pricing.searchCountry")}
            onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
            style={{
              width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 9, padding: "10px 12px", fontFamily: "inherit", fontSize: 12.5,
              color: "#fff", outline: "none", marginBottom: 6,
            }}
          />
          <div ref={listRef} className="pp-scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
            {flat.length === 0 && (
              <div style={{ padding: "22px 10px", textAlign: "center", color: "rgba(255,255,255,.45)", fontSize: 12.5 }}>
                🌍 —
              </div>
            )}
            {arab.length > 0 && (
              <div className="s-label" style={{ padding: "6px 10px 4px", fontSize: 9.5 }}>{tr("🌍 الدول العربية")}</div>
            )}
            {arab.map((c, i) => row(c, i))}
            {rest.length > 0 && (
              <div className="s-label" style={{ padding: "8px 10px 4px", fontSize: 9.5 }}>{tr("🌏 باقي دول العالم")}</div>
            )}
            {rest.map((c, i) => row(c, arab.length + i))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── بطاقة خطة واحدة ── */
function PlanCard({ plan, t, i }) {
  const isFree = plan.code === "free_early";
  const popular = plan.badgeAr && String(plan.badgeAr).indexOf(tr("الأكثر")) !== -1;
  const quotas = [
    ["🏢", t("pricing.quotaCompanies"), plan.maxCompanies],
    ["👥", t("pricing.quotaCustomers"), plan.maxCustomers],
    ["🤖", t("pricing.quotaAiInvoices"), plan.monthlyAiInvoices],
  ];
  return (
    <div
      className={`s-card s-card-hover s-fade s-fade-${Math.min(i + 1, 4)}`}
      style={{
        display: "flex", flexDirection: "column", gap: 11, textAlign: "start",
        borderColor: popular ? "rgba(201,162,39,.6)" : undefined,
        transform: popular ? "scale(1.02)" : undefined,
        boxShadow: popular ? "0 14px 40px rgba(201,162,39,.2)" : undefined,
      }}
    >
      {plan.badgeAr && <span className="s-chip" style={{ alignSelf: "flex-start" }}>{plan.badgeAr}</span>}
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{tr(plan.nameAr)}</div>
        {plan.descAr && (
          <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12.5, lineHeight: 1.8 }}>{plan.descAr}</div>
        )}
      </div>

      <div style={{ paddingBottom: 4, borderBottom: "1px dashed rgba(201,162,39,.25)" }}>
        <div dir="ltr" style={{ fontSize: 27, fontWeight: 900, color: "#e5c558", lineHeight: 1.2 }}>
          {plan.priceLocal?.formatted || `${plan.priceUsd} USD`}
        </div>
        <div style={{ color: "rgba(255,255,255,.6)", fontSize: 12.5, fontWeight: 700 }}>/ {t("pricing.perMonth")}</div>
        <div dir="ltr" title={t("pricing.baseCurrency")} style={{ color: "rgba(255,255,255,.42)", fontSize: 11, marginTop: 3 }}>
          {t("pricing.baseCurrency")}: $ {plan.priceUsd} USD
        </div>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {quotas.map(([icon, label, max]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ flex: 1, color: "rgba(255,255,255,.58)", fontWeight: 600 }}>{label}</span>
            <b dir="ltr" style={{ fontSize: 13 }}>{max}</b>
          </div>
        ))}
      </div>

      {Array.isArray(plan.features) && plan.features.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {plan.features.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, lineHeight: 1.7 }}>
              <span style={{ color: "#c9a227", fontWeight: 900, flexShrink: 0 }}>✓</span>
              <span style={{ color: "rgba(255,255,255,.78)" }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 8 }}>
        {isFree ? (
          <a className="s-btn s-btn-ghost" href="#/login" style={{ width: "100%", justifyContent: "center" }}>
            🎁 {t("pricing.freeForever")}
          </a>
        ) : (
          <a className="s-btn s-btn-gold" href="#/login" style={{ width: "100%", justifyContent: "center" }}>
            {t("pricing.choose")}
          </a>
        )}
      </div>
    </div>
  );
}

/* ── جسم الصفحة (داخل مزوّد اللغة) ── */
function PricingInner({ content }) {
  const { t, dir } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);
  const [country, setCountry] = useState(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (code) => {
    if (firstLoad.current) setLoading(true);
    else setSwitching(true);
    setError(null);
    try {
      const res = await fetch(`/api/pricing${code ? `?country=${encodeURIComponent(code)}` : ""}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      if (!code && json.geo?.country) setCountry(json.geo.country);
    } catch (e) {
      setError(e.message || tr("تعذّر تحميل الأسعار"));
    } finally {
      firstLoad.current = false;
      setLoading(false);
      setSwitching(false);
    }
    // t مقصودة من التبعيات عمداً — تغيير اللغة لا يعيد جلب الأسعار
  }, []);

  useEffect(() => { load(null); /* مرة واحدة عند الوصول */ }, [load]);

  const freeSeats = data?.freeSeats;
  const geo = data?.geo;
  const plans = data?.plans || [];
  const countries = data?.countries || [];
  const seatsChip = !freeSeats
    ? ""
    : freeSeats.remaining > 0
      ? `🎁 ${t("pricing.seatsLeft").replace("{n}", freeSeats.remaining)}`
      : t("pricing.seatsFull");

  return (
    <div style={{ direction: dir }} className="s-z">
      <style>{SITE_CSS}</style>
      <style>{`
        .pp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}
        .pp-scroll{scrollbar-width:thin;scrollbar-color:rgba(201,162,39,.5) rgba(255,255,255,.06)}
        .pp-scroll::-webkit-scrollbar{width:8px}
        .pp-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,.06);border-radius:8px}
        .pp-scroll::-webkit-scrollbar-thumb{background:rgba(201,162,39,.5);border-radius:8px}
        .pp-scroll::-webkit-scrollbar-thumb:hover{background:rgba(201,162,39,.8)}
        .pp-ctry-btn:hover{border-color:rgba(201,162,39,.7);background:rgba(201,162,39,.1)}
        .pp-ctry-btn:focus-visible,.pp-row:focus-visible{outline:2.5px solid #c9a227;outline-offset:2px}
        .pp-row{transition:background .12s}
        @keyframes ppPulse{0%,100%{opacity:.4}50%{opacity:.85}}
        .pp-skel{background:rgba(255,255,255,.06);border-radius:10px;animation:ppPulse 1.6s ease-in-out infinite}
        @media(max-width:560px){
          .pp-bar{flex-direction:column;align-items:stretch}
          .pp-ctry-btn{width:100%;justify-content:center}
        }
      `}</style>

      {/* ── الترويسة ── */}
      <section style={{ padding: "68px 20px 22px", textAlign: "center", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div className="s-label">PRICING</div>
        <h1 className="s-hero-title s-fade" style={{ fontSize: "clamp(25px,4.6vw,38px)" }}>{t("pricing.title")}</h1>
        <p className="s-hero-sub s-fade s-fade-1" style={{ marginBottom: 14 }}>{t("pricing.subtitle")}</p>
        {seatsChip && <div className="s-chip s-fade s-fade-1">{seatsChip}</div>}
      </section>

      {/* ── شريط البلد والعملة ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 10px", width: "100%" }}>
        <div className="s-card s-fade s-fade-2 pp-bar" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 18px" }}>
          {loading ? (
            <div className="pp-skel" style={{ height: 18, width: 250 }} aria-hidden="true" />
          ) : geo && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 210, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20 }} aria-hidden="true">{geo.flag}</span>
              <span>🌍 {t("pricing.detected")}: {geo.countryNameAr} ({geo.currency})</span>
            </div>
          )}
          {countries.length > 0 && (
            <CountrySelect
              countries={countries}
              value={country || geo?.country || ""}
              busy={switching}
              onChange={(code) => { setCountry(code); load(code); }}
              t={t}
            />
          )}
        </div>
      </section>

      {/* ── المحتوى ── */}
      <section className="s-section" style={{ paddingTop: 26 }}>
        {loading && (
          <div className="pp-grid" aria-busy="true" aria-label={t("common.loading")}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="s-card" aria-hidden="true">
                <div className="pp-skel" style={{ height: 14, width: 90, marginBottom: 14 }} />
                <div className="pp-skel" style={{ height: 24, width: 140, marginBottom: 12 }} />
                <div className="pp-skel" style={{ height: 30, width: 110, marginBottom: 16 }} />
                {[92, 78, 84, 70].map((w, j) => (
                  <div key={j} className="pp-skel" style={{ height: 11, width: `${w}%`, marginBottom: 9 }} />
                ))}
                <div className="pp-skel" style={{ height: 40, width: "100%", marginTop: 12 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="s-card s-fade" role="alert" style={{ textAlign: "center", padding: "44px 24px" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }} aria-hidden="true">⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{t("common.error")}</div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: 13, marginBottom: 20 }}>{error}</div>
            <button type="button" className="s-btn s-btn-gold" onClick={() => load(country)}>
              🔄 {t("common.retry")}
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="pp-grid" style={{ opacity: switching ? 0.45 : 1, transition: "opacity .25s" }}>
            {plans.map((p, i) => <PlanCard key={p.code} plan={p} t={t} i={i} />)}
          </div>
        )}

        {/* ── بطاقة الضريبة ── */}
        {!loading && !error && geo && (
          <div className="s-card s-fade s-fade-3" style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "15px 20px" }}>
            <span className="s-chip">{t("pricing.taxNote").replace("{rate}", geo.vat ?? 0)}</span>
            {geo.vat > 0 ? (
              <b dir="ltr" style={{ fontSize: 13, color: "#e5c558" }}>✅ {geo.vat}% VAT</b>
            ) : (
              <b style={{ fontSize: 13, color: "rgba(255,255,255,.7)" }}>🚫 {t("tax.noTax")}</b>
            )}
            <small style={{ color: "rgba(255,255,255,.45)", fontSize: 11.5, flex: 1, minWidth: 200 }}>{t("tax.optionalNote")}</small>
          </div>
        )}
      </section>

      {/* ── دعوة الاشتراك ── */}
      {!loading && !error && (
        <section className="s-section" style={{ paddingTop: 0, paddingBottom: 72 }}>
          <div
            className="s-fade s-fade-4"
            style={{
              textAlign: "center", padding: "38px 22px", borderRadius: 20,
              background: "linear-gradient(135deg,rgba(201,162,39,.14),rgba(201,162,39,.04))",
              border: "1px solid rgba(201,162,39,.3)",
            }}
          >
            <a className="s-btn s-btn-gold" href="#/login" style={{ fontSize: 15, padding: "14px 32px" }}>
              {t("pricing.loginToSubscribe")}
            </a>
            <div style={{ marginTop: 14, color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 700 }}>
              🎁 {content?.site_name ? `${content.site_name} — ` : ""}{tr("مجاناً لأول")} {freeSeats?.limit ?? 100} {tr("مشترك")}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function PricingPage({ content }) {
  return (
    <LangProvider>
      <PricingInner content={content} />
    </LangProvider>
  );
}
