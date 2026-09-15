"use client";

import { useEffect, useState } from "react";
import { api } from "../invoice-app/api";
import FirebaseLogin from "../invoice-app/pages/FirebaseLogin";
import HomePage from "./HomePage";
import TeamPage from "./TeamPage";
import FounderPage from "./FounderPage";
import ResetPasswordPage from "./ResetPasswordPage";
import PricingPage from "./PricingPage";
import { SITE_CSS, DEFAULT_CONTENT } from "./site-shared";
import { LangProvider, useI18n, LanguageSwitcher } from "@/lib/i18n-context";
import { tr } from "@/lib/i18n-app";

/**
 * r13: الموقع العام متعدد الصفحات — يظهر للزائر قبل الدخول، ويمكن معاينته بعد الدخول
 * عبر روابط الـ hash (#/ أو #/team أو #/founder).
 *
 * التنقل: hash-based داخل مسار "/" الواحد:
 *   #/        → الرئيسية     #/team  → الفريق
 *   #/founder → رسالة المؤسس #/login → صفحة الدخول
 * r16: #/reset?token=… → إعادة تعيين كلمة المرور (من رسالة Resend)
 */
export default function PublicSite(props) {
  // r18: الموقع العام بلغات العالم — مزوّد اللغة يغلّف كل الصفحات (اتجاه + نصوص)
  return (
    <LangProvider>
      <SiteInner {...props} />
    </LangProvider>
  );
}

function SiteInner({ page = "home", authed = false, onEnterApp = () => {} }) {
  const { t, dir } = useI18n(); // r22: dir يتبع اللغة المختارة (كانت صفحة الدخول rtl ثابتة)
  const [stats, setStats] = useState(null);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [team, setTeam] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getSiteStats().then((s) => alive && setStats(s)).catch(() => {});
    api.getSiteContent()
      .then((c) => alive && setContent((prev) => ({ ...prev, ...c })))
      .catch(() => {});
    api.listTeam().then((t) => alive && setTeam(t)).catch(() => {});
    api.listCompanies().then((c) => alive && setCompanies(c)).catch(() => {});
    return () => { alive = false; };
  }, [page]);

  useEffect(() => {
    // الرئيسية = اسم الموقع فقط (يطابق metadata الافتراضي حتى لا يبدو عنوان مكرراً)
    const titles = {
      home: "",
      team: t("nav.team"),
      founder: t("nav.founder"),
      pricing: t("nav.pricing"),
      login: t("login.title"),
      reset: t("login.forgotTitle"),
    };
    const pageTitle = titles[page] || "";
    const apply = () => {
      // r16: الرئيسية تحمل العنوان الكامل (يطابق metadata الخادم — أفضل لـ SEO)
      document.title = page === "home"
        ? tr("{0} | نظام إدارة الفواتير والحسابات — الكويت",[tr(content.site_name)])
        : pageTitle
          ? `${pageTitle} | ${tr(content.site_name)}`
          : content.site_name;
    };
    apply();
    // React يعيد تطبيق عنوان metadata عند اكتمال الإنعاش (hydration) وقد يكتب فوقه —
    // إعادة الضبط المتأخرة تكسب السباق عند فتح رابط hash مباشرة
    const id = setTimeout(apply, 700);
    return () => clearTimeout(id);
  }, [page, content.site_name, t]);

  const nav = (e, hash) => {
    e.preventDefault();
    setMenuOpen(false);
    if (location.hash === hash) return;
    location.hash = hash;
  };

  const enter = (e) => {
    if (e) e.preventDefault();
    setMenuOpen(false);
    onEnterApp();
  };

  // صفحة إعادة تعيين كلمة المرور (r16) — من رابط رسالة البريد
  if (page === "reset") {
    return <ResetPasswordPage />;
  }

  // صفحة الدخول: نموذج الدخول الكامل + زر عودة للموقع
  if (page === "login") {
    return (
      <div dir={dir} style={{ position: "relative" }}>
        <a
          href="#/"
          onClick={(e) => nav(e, "#/")}
          style={{
            position: "fixed", top: 16, insetInlineStart: 16, zIndex: 50,
            background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 8, padding: "7px 14px", color: "#fff", textDecoration: "none",
            fontSize: 13, fontWeight: 700, fontFamily: "Cairo,sans-serif",
          }}
        >
          ← {t("nav.home")}
        </a>
        <FirebaseLogin />
      </div>
    );
  }

  const links = [
    { hash: "#/", label: t("nav.home"), id: "home" },
    { hash: "#/pricing", label: t("nav.pricing"), id: "pricing" },
    { hash: "#/team", label: t("nav.team"), id: "team" },
    { hash: "#/founder", label: t("nav.founder"), id: "founder" },
  ];

  return (
    <div className="site-root">
      <style>{SITE_CSS}</style>
      <div className="site-bg" aria-hidden="true">
        <div className="orb1" />
        <div className="orb2" />
        <div className="grid" />
      </div>

      <div className="s-z" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* ── Navbar ── */}
        <header
          style={{
            position: "sticky", top: 0, zIndex: 100,
            background: "rgba(6,17,31,.88)", backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(201,162,39,.16)",
          }}
        >
          <div className="s-navrow">
            <a
              href="#/"
              onClick={(e) => nav(e, "#/")}
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}
              aria-label={tr(content.site_name)}
            >
              <span
                style={{
                  width: 38, height: 38, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg,#c9a227,#a07c1a)", fontSize: 19,
                  boxShadow: "0 4px 14px rgba(201,162,39,.4)",
                }}
              >
                🏛️
              </span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                <b className="s-brand-name" style={{ color: "#fff", fontSize: 14.5, fontWeight: 900 }}>{tr(content.site_name)}</b>
                <span className="s-brand-sub" style={{ color: "rgba(255,255,255,.35)", fontSize: 9.5, letterSpacing: 1.5 }}>{content.site_name_en}</span>
              </span>
            </a>

            <nav className="s-nav" style={{ gap: 4, marginInlineStart: 18 }} aria-label={tr("التنقل الرئيسي")}>
              {links.map((l) => (
                <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} className={`s-nav-link${page === l.id ? " active" : ""}`}>
                  {l.label}
                </a>
              ))}
            </nav>

            <div style={{ flex: 1 }} />

            <LanguageSwitcher compact />

            {authed ? (
              <button className="s-btn s-btn-ghost" onClick={enter} style={{ padding: "9px 16px", fontSize: 12.5 }}>
                <span className="s-cta-long">↩️ {t("nav.enterApp")}</span>
                <span className="s-cta-short">↩️ {t("nav.app")}</span>
              </button>
            ) : (
              <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-btn s-btn-gold" style={{ padding: "9px 18px", fontSize: 12.5 }}>
                <span className="s-cta-long">{t("nav.login")} ←</span>
                <span className="s-cta-short">{t("login.signIn")} ←</span>
              </a>
            )}

            <button
              className="s-burger"
              aria-label={t("nav.menu")} aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
          </div>

          {menuOpen && (
            <nav style={{ borderTop: "1px solid rgba(201,162,39,.15)", padding: "10px 20px", display: "flex", flexDirection: "column", gap: 6 }} aria-label={t("nav.menu")}>
              {links.map((l) => (
                <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} className={`s-nav-link${page === l.id ? " active" : ""}`}>
                  {l.label}
                </a>
              ))}
              <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-nav-link" style={{ color: "#e5c558" }}>
                {authed ? `↩️ ${t("nav.enterApp")}` : `${t("nav.login")} ←`}
              </a>
            </nav>
          )}
        </header>

        {/* ── الصفحات ── */}
        <main style={{ flex: 1 }}>
          {page === "home" && (
            <HomePage stats={stats} companies={companies} content={content} authed={authed} onEnterApp={enter} />
          )}
          {page === "pricing" && <PricingPage content={content} />}
          {page === "team" && <TeamPage team={team} content={content} />}
          {page === "founder" && <FounderPage content={content} />}
        </main>

        {/* ── Footer (ملتصق بأسفل الشاشة عند المحتوى القصير) ── */}
        <footer className="s-footer">
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "34px 20px 18px" }}>
            <div className="s-footer-cols">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>🏛️</span>
                  <b style={{ fontSize: 15 }}>{tr(content.site_name)}</b>
                </div>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, lineHeight: 1.9, margin: 0, maxWidth: 340 }}>
                  {tr("نظام إدارة حسابات وفواتير عربي متكامل — بُني خصيصاً للسوق الكويتي: تعدد الشركات، العملات،\n                  المدفوعات الجزئية، والتذكيرات عبر واتساب.")}
                </p>
              </div>
              <div>
                <div className="s-label" style={{ marginBottom: 12 }}>{tr("روابط سريعة")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {links.map((l) => (
                    <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} style={{ color: "rgba(255,255,255,.6)", textDecoration: "none", fontSize: 13 }}>
                      {l.label}
                    </a>
                  ))}
                  {!authed && (
                    <a href="#/login" onClick={(e) => nav(e, "#/login")} style={{ color: "rgba(255,255,255,.6)", textDecoration: "none", fontSize: 13 }}>
                      {tr("تسجيل الدخول")}
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="s-label" style={{ marginBottom: 12 }}>{tr("تواصل")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "rgba(255,255,255,.6)", fontSize: 13 }}>
                  {content.contact_phone && (
                    <a href={`tel:${content.contact_phone.replace(/\s/g, "")}`} style={{ color: "inherit", textDecoration: "none" }}>
                      📞 {content.contact_phone}
                    </a>
                  )}
                  {content.contact_email && (
                    <a href={`mailto:${content.contact_email}`} style={{ color: "inherit", textDecoration: "none" }}>
                      ✉️ {content.contact_email}
                    </a>
                  )}
                  {content.contact_address && <span>📍 {content.contact_address}</span>}
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", marginTop: 24, paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", color: "rgba(255,255,255,.35)", fontSize: 11.5 }}>
              <span>© {new Date().getFullYear()} {tr(content.site_name)} {tr("— جميع الحقوق محفوظة")}</span>
              <span>
                {tr("تم البرمجة والتطوير بواسطة")}{" "}
                <a href="https://wa.me/201033514479" target="_blank" rel="noopener noreferrer" style={{ color: "#c9a227", textDecoration: "none", fontWeight: 700 }}>
                  {tr("أحمد عزت الصياد")}
                </a>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
