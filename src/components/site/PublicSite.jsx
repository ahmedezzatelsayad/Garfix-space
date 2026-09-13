"use client";

import { useEffect, useState } from "react";
import { api } from "../invoice-app/api";
import FirebaseLogin from "../invoice-app/pages/FirebaseLogin";
import HomePage from "./HomePage";
import TeamPage from "./TeamPage";
import FounderPage from "./FounderPage";
import { SITE_CSS, DEFAULT_CONTENT } from "./site-shared";

/**
 * r13: الموقع العام متعدد الصفحات — يظهر للزائر قبل الدخول، ويمكن معاينته بعد الدخول
 * عبر روابط الـ hash (#/ أو #/team أو #/founder).
 *
 * التنقل: hash-based داخل مسار "/" الواحد:
 *   #/        → الرئيسية     #/team  → الفريق
 *   #/founder → رسالة المؤسس #/login → صفحة الدخول
 */
export default function PublicSite({ page = "home", authed = false, onEnterApp = () => {} }) {
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
      team: "فريق العمل",
      founder: "رسالة المؤسس",
      login: "تسجيل الدخول",
    };
    const t = titles[page] || "";
    const apply = () => {
      document.title = t ? `${t} | ${content.site_name}` : content.site_name;
    };
    apply();
    // React يعيد تطبيق عنوان metadata عند اكتمال الإنعاش (hydration) وقد يكتب فوقه —
    // إعادة الضبط المتأخرة تكسب السباق عند فتح رابط hash مباشرة
    const id = setTimeout(apply, 700);
    return () => clearTimeout(id);
  }, [page, content.site_name]);

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

  // صفحة الدخول: نموذج الدخول الكامل + زر عودة للموقع
  if (page === "login") {
    return (
      <div dir="rtl" style={{ position: "relative" }}>
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
          ← الموقع
        </a>
        <FirebaseLogin />
      </div>
    );
  }

  const links = [
    { hash: "#/", label: "الرئيسية", id: "home" },
    { hash: "#/team", label: "الفريق", id: "team" },
    { hash: "#/founder", label: "رسالة المؤسس", id: "founder" },
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
              aria-label={content.site_name}
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
                <b className="s-brand-name" style={{ color: "#fff", fontSize: 14.5, fontWeight: 900 }}>{content.site_name}</b>
                <span className="s-brand-sub" style={{ color: "rgba(255,255,255,.35)", fontSize: 9.5, letterSpacing: 1.5 }}>{content.site_name_en}</span>
              </span>
            </a>

            <nav className="s-nav" style={{ gap: 4, marginInlineStart: 18 }} aria-label="التنقل الرئيسي">
              {links.map((l) => (
                <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} className={`s-nav-link${page === l.id ? " active" : ""}`}>
                  {l.label}
                </a>
              ))}
            </nav>

            <div style={{ flex: 1 }} />

            {authed ? (
              <button className="s-btn s-btn-ghost" onClick={enter} style={{ padding: "9px 16px", fontSize: 12.5 }}>
                <span className="s-cta-long">↩️ العودة للنظام</span>
                <span className="s-cta-short">↩️ النظام</span>
              </button>
            ) : (
              <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-btn s-btn-gold" style={{ padding: "9px 18px", fontSize: 12.5 }}>
                <span className="s-cta-long">تسجيل الدخول ←</span>
                <span className="s-cta-short">دخول ←</span>
              </a>
            )}

            <button
              className="s-burger"
              aria-label="القائمة" aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ☰
            </button>
          </div>

          {menuOpen && (
            <nav style={{ borderTop: "1px solid rgba(201,162,39,.15)", padding: "10px 20px", display: "flex", flexDirection: "column", gap: 6 }} aria-label="قائمة الجوال">
              {links.map((l) => (
                <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} className={`s-nav-link${page === l.id ? " active" : ""}`}>
                  {l.label}
                </a>
              ))}
              <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-nav-link" style={{ color: "#e5c558" }}>
                {authed ? "↩️ العودة للنظام" : "تسجيل الدخول ←"}
              </a>
            </nav>
          )}
        </header>

        {/* ── الصفحات ── */}
        <main style={{ flex: 1 }}>
          {page === "home" && (
            <HomePage stats={stats} companies={companies} content={content} authed={authed} onEnterApp={enter} />
          )}
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
                  <b style={{ fontSize: 15 }}>{content.site_name}</b>
                </div>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12.5, lineHeight: 1.9, margin: 0, maxWidth: 340 }}>
                  نظام إدارة حسابات وفواتير عربي متكامل — بُني خصيصاً للسوق الكويتي: تعدد الشركات، العملات،
                  المدفوعات الجزئية، والتذكيرات عبر واتساب.
                </p>
              </div>
              <div>
                <div className="s-label" style={{ marginBottom: 12 }}>روابط سريعة</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {links.map((l) => (
                    <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} style={{ color: "rgba(255,255,255,.6)", textDecoration: "none", fontSize: 13 }}>
                      {l.label}
                    </a>
                  ))}
                  {!authed && (
                    <a href="#/login" onClick={(e) => nav(e, "#/login")} style={{ color: "rgba(255,255,255,.6)", textDecoration: "none", fontSize: 13 }}>
                      تسجيل الدخول
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="s-label" style={{ marginBottom: 12 }}>تواصل</div>
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
              <span>© {new Date().getFullYear()} {content.site_name} — جميع الحقوق محفوظة</span>
              <span>
                تم البرمجة والتطوير بواسطة{" "}
                <a href="https://wa.me/201033514479" target="_blank" rel="noopener noreferrer" style={{ color: "#c9a227", textDecoration: "none", fontWeight: 700 }}>
                  أحمد الصياد
                </a>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
