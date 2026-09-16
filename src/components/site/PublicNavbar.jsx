"use client";

/**
 * r24: PublicNavbar — شريط تنقل الموقع العام بهوية SaaS عالمية.
 * - شعار «G» الذهبي (LogoMark) بدل الإيموجي.
 * - أيقونات lucide بدل الإيموجي في الأزرار والروابط.
 * - دخول (ghost) + ابدأ مجاناً (ذهبي → وضع التسجيل) للزائر، ودخول النظام للمسجَّل.
 * مكون معاد الاستعمال لكل صفحات الموقع العام.
 */
import { useState } from "react";
import { LogIn, Menu, Rocket, X } from "lucide-react";
import { LanguageSwitcher, useI18n } from "@/lib/i18n-context";
import { tr } from "@/lib/i18n-app";
import { LogoMark } from "./site-shared";

export default function PublicNavbar({ page = "home", authed = false, onEnterApp, onNav, content }) {
  const { t } = useI18n(); // روابط التنقل بـ27 لغة (t) — والنصوص التسويقية الجديدة بـ tr
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { hash: "#/", label: t("nav.home"), id: "home" },
    { hash: "#/pricing", label: t("nav.pricing"), id: "pricing" },
    { hash: "#/team", label: t("nav.team"), id: "team" },
    { hash: "#/founder", label: t("nav.founder"), id: "founder" },
  ];

  const nav = (e, hash) => {
    e.preventDefault();
    setMenuOpen(false);
    if (onNav) onNav(hash);
  };

  return (
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
          <LogoMark size={38} src={content.site_logo || undefined} />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <b className="s-brand-name" style={{ color: "#fff", fontSize: 14.5, fontWeight: 900 }}>{tr(content.site_name)}</b>
            <span className="s-brand-sub" style={{ color: "rgba(255,255,255,.35)", fontSize: 9.5, letterSpacing: 1.5, fontFamily: "'Inter',sans-serif" }}>
              {content.site_name_en}
            </span>
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
          <button className="s-btn s-btn-ghost" onClick={(e) => { e.preventDefault(); setMenuOpen(false); if (onEnterApp) onEnterApp(); }} style={{ padding: "9px 16px", fontSize: 12.5 }}>
            <LogIn size={15} aria-hidden="true" />
            <span className="s-cta-long">{t("nav.enterApp")}</span>
            <span className="s-cta-short">{t("nav.app")}</span>
          </button>
        ) : (
          <>
            <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-btn s-btn-ghost" style={{ padding: "9px 14px", fontSize: 12.5 }}>
              <LogIn size={15} aria-hidden="true" />
              <span className="s-cta-long">{t("nav.login")}</span>
              <span className="s-cta-short">{t("login.signIn")}</span>
            </a>
            <a href="#/login?mode=register" onClick={(e) => nav(e, "#/login?mode=register")} className="s-btn s-btn-gold" style={{ padding: "9px 16px", fontSize: 12.5 }}>
              <Rocket size={15} aria-hidden="true" />
              <span className="s-cta-long">{tr("ابدأ مجاناً")}</span>
              <span className="s-cta-short">{tr("مجاناً")}</span>
            </a>
          </>
        )}

        <button
          className="s-burger"
          aria-label={t("nav.menu")} aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
        >
          {menuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>
      </div>

      {menuOpen && (
        <nav style={{ borderTop: "1px solid rgba(201,162,39,.15)", padding: "10px 20px", display: "flex", flexDirection: "column", gap: 6 }} aria-label={t("nav.menu")}>
          {links.map((l) => (
            <a key={l.hash} href={l.hash} onClick={(e) => nav(e, l.hash)} className={`s-nav-link${page === l.id ? " active" : ""}`}>
              {l.label}
            </a>
          ))}
          {!authed && (
            <a href="#/login" onClick={(e) => nav(e, "#/login")} className="s-nav-link" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <LogIn size={15} aria-hidden="true" /> {t("nav.login")}
            </a>
          )}
          <a href="#/login?mode=register" onClick={(e) => nav(e, "#/login?mode=register")} className="s-nav-link" style={{ color: "#e5c558" }}>
            <Rocket size={15} aria-hidden="true" /> {authed ? t("nav.enterApp") : tr("ابدأ مجاناً — لأول 100 شركة")}
          </a>
        </nav>
      )}
    </header>
  );
}
