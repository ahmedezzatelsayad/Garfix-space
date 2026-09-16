"use client";
/**
 * TopBar — الشريط العلوي العالمي لـ GarfiX Business OS (r25).
 *
 * يسار: زر القائمة (جوال) + البحث العالمي (⌘K / Ctrl K).
 * يمين: اللغة · العملة (عرض) · الدولة · السمة · الإشعارات · المستخدم.
 *
 * ملاحظة معمارية: اللغة/الدولة/العملة هنا تفضيلات عرض عالمية —
 * عملة الشركة المحاسبية تبقى مستقلة في إعدادات الشركة ولا تُغيَّر من هنا.
 */
import { useEffect, useRef, useState } from "react";
import {
  Search, Languages, Sun, Moon, Bell, ChevronDown, LogOut, User as UserIcon,
  ShieldCheck, CircleDollarSign, AlertTriangle, CheckCircle2, Sparkles, Info, ArrowRight, ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { tr, appDir } from "@/lib/i18n-app";
import { CURRENCIES, setCurrency, useCurrency } from "../currency";
import { WORLD_COUNTRIES } from "@/lib/countries-world";
import { GX_GOLD, GX_ROYAL } from "./shell-css";

const flagOf = code => {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

/** إعدادات القوائم المنسدلة الصغيرة (نقر خارجي يغلقها) — مرجع منفصل عن الحالة */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return [open, setOpen, ref];
}

export default function TopBar({
  onOpenPalette, burger, onBurger, dark, onToggleTheme,
  country, onSetCountry, alerts = [], onOpenAlert,
  profile, isAdmin, onNavigate, onOpenUsers, onLogout, user, extraActions,
}) {
  const { lang, setLang, language, languages } = useI18n();
  const cur = useCurrency();
  const [langOpen, setLangOpen, langRef] = useMenu();
  const [curOpen, setCurOpen, curRef] = useMenu();
  const [coOpen, setCoOpen, coRef] = useMenu();
  const [bellOpen, setBellOpen, bellRef] = useMenu();
  const [userOpen, setUserOpen, userRef] = useMenu();

  const curCountry = WORLD_COUNTRIES.find(c => c.code === country);
  const coName = curCountry ? (lang === "ar" ? curCountry.nameAr : curCountry.nameEn) : tr("العالم");
  const companyCurCode = (cur.code || "KWD");
  const unread = alerts.filter(a => !a.read).length;
  const BackIcon = appDir() === "rtl" ? ArrowLeft : ArrowRight;

  const initials = (profile?.displayName || user?.email || "U")
    .split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = isAdmin ? tr("مدير النظام") : (profile?.role === "subscriber" ? tr("مشترك") : tr("موظف"));

  const doSetLang = code => { setLang(code); setLangOpen(false); };
  const doSetCurrency = code => { setCurrency(code); setCurOpen(false); };
  const doSetCountry = code => { onSetCountry?.(code); setCoOpen(false); };

  return (
    <header className="gx-topbar">
      {burger && (
        <button className="gx-burger" onClick={onBurger} aria-label={tr("فتح القائمة الجانبية")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* البحث العالمي */}
      <button className="gx-search" onClick={onOpenPalette} aria-label={tr("بحث شامل")}>
        <Search size={16} aria-hidden="true" />
        <span className="gx-search-ph">{tr("ابحث عن أي شيء… فواتير، عملاء، منتجات، مدفوعات")}</span>
        <span className="gx-kbd"><kbd>⌘</kbd><kbd>K</kbd></span>
      </button>

      <div className="gx-top-spacer" />

      {/* إضافات سياقية (زر لوحة AI) */}
      {extraActions}

      {/* اللغة */}
      <div ref={langRef} className="gx-tb-lang" style={{ position: "relative", flexShrink: 0 }}>
        <button className="gx-top-btn" onClick={() => setLangOpen(o => !o)}
          aria-haspopup="listbox" aria-expanded={langOpen} title={tr("اللغة")}>
          <Languages size={16} aria-hidden="true" />
          <span className="gx-tb-label">{language?.nativeName}</span>
        </button>
        {langOpen && (
          <div className="gx-menu" role="listbox">
            <div className="gx-menu-label">{tr("اللغة")} — {languages.length}</div>
            <div className="gx-menu-scroll">
              {languages.map(l => (
                <button key={l.code} className="gx-menu-item" role="option" aria-selected={l.code === lang}
                  onClick={() => doSetLang(l.code)}>
                  <span aria-hidden="true" style={{ fontSize: 15 }}>{l.flag}</span>
                  <span>{l.nativeName}</span>
                  {l.code === lang && <span className="gx-mi-end" style={{ color: GX_ROYAL }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* العملة (عرض) */}
      <div ref={curRef} className="gx-tb-curwrap" style={{ position: "relative", flexShrink: 0 }}>
        <button className="gx-top-btn" onClick={() => setCurOpen(o => !o)}
          aria-haspopup="listbox" aria-expanded={curOpen}
          title={tr("عملة العرض — عملة الشركة المحاسبية مستقلة")}>
          <span className="gx-tb-flag" aria-hidden="true">{cur.flag}</span>
          <span className="gx-tb-cur gx-num" style={{ fontWeight: 800 }}>{companyCurCode}</span>
          <ChevronDown size={12} style={{ opacity: .5 }} />
        </button>
        {curOpen && (
          <div className="gx-menu" role="listbox">
            <div className="gx-menu-label">{tr("عملة العرض")}</div>
            <div className="gx-menu-scroll">
              {Object.values(CURRENCIES).map(c => (
                <button key={c.code} className="gx-menu-item" role="option" aria-selected={c.code === companyCurCode}
                  onClick={() => doSetCurrency(c.code)}>
                  <span aria-hidden="true" style={{ fontSize: 15 }}>{c.flag}</span>
                  <span>{lang === "ar" ? c.ar : (c.en || c.ar)}</span>
                  <span className="gx-mi-end">{c.code === companyCurCode ? "✓" : c.code}</span>
                </button>
              ))}
            </div>
            <div className="gx-menu-sep" />
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--ia-muted)", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
              <CircleDollarSign size={12} />
              {tr("تُضبط عملة المحاسبة من إعدادات الشركة")}
            </div>
          </div>
        )}
      </div>

      {/* الدولة */}
      <div ref={coRef} className="gx-tb-country" style={{ position: "relative", flexShrink: 0 }}>
        <button className="gx-top-btn" onClick={() => setCoOpen(o => !o)}
          aria-haspopup="listbox" aria-expanded={coOpen} title={tr("الدولة")}>
          <span className="gx-tb-flag" aria-hidden="true">{curCountry ? flagOf(curCountry.code) : "🌍"}</span>
          <span className="gx-tb-label">{coName}</span>
          <ChevronDown size={12} style={{ opacity: .5 }} />
        </button>
        {coOpen && (
          <div className="gx-menu" style={{ minWidth: 250 }} role="listbox">
            <div className="gx-menu-label">{tr("الدولة")} — {WORLD_COUNTRIES.length}</div>
            <div className="gx-menu-scroll">
              <button className="gx-menu-item" onClick={() => doSetCountry(null)}>
                <span aria-hidden="true">🌍</span><span>{tr("عالمي (بلا تحديد)")}</span>
              </button>
              {WORLD_COUNTRIES.map(c => (
                <button key={c.code} className="gx-menu-item" role="option" aria-selected={c.code === country}
                  onClick={() => doSetCountry(c.code)}>
                  <span aria-hidden="true" style={{ fontSize: 15 }}>{flagOf(c.code)}</span>
                  <span>{lang === "ar" ? c.nameAr : c.nameEn}</span>
                  {c.code === country && <span className="gx-mi-end" style={{ color: GX_ROYAL }}>✓</span>}
                </button>
              ))}
            </div>
            <div className="gx-menu-sep" />
            <div style={{ padding: "6px 10px", fontSize: 10.5, color: "var(--ia-muted)", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
              <Info size={12} />
              {tr("تؤثر في صيغة التاريخ والأرقام فقط — بلا مساس بإعدادات الشركة")}
            </div>
          </div>
        )}
      </div>

      {/* السمة */}
      <button className="gx-top-btn gx-tb-theme" onClick={onToggleTheme} title={dark ? tr("الوضع النهاري") : tr("الوضع الليلي")}
        aria-label={tr("تبديل السمة")}>
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* الإشعارات */}
      <div ref={bellRef} className="gx-tb-bell" style={{ position: "relative", flexShrink: 0 }}>
        <button className="gx-top-btn" onClick={() => setBellOpen(o => !o)}
          aria-label={tr("الإشعارات")} aria-expanded={bellOpen} title={tr("الإشعارات")}>
          <Bell size={16} />
          {unread > 0 && <span className="gx-dot-badge gx-num">{unread}</span>}
        </button>
        {bellOpen && (
          <div className="gx-menu" style={{ minWidth: 300 }}>
            <div className="gx-menu-label">{tr("مركز التنبيهات")}</div>
            <div className="gx-menu-scroll">
              {alerts.length === 0 && (
                <div style={{ padding: "14px 12px", fontSize: 12, color: "var(--ia-muted)", fontWeight: 600, textAlign: "center" }}>
                  {tr("لا توجد تنبيهات — كل شيء يسير على ما يرام")}
                </div>
              )}
              {alerts.map(a => (
                <button key={a.id} className="gx-menu-item" onClick={() => { setBellOpen(false); onOpenAlert?.(a); }}
                  style={{ alignItems: "flex-start", gap: 9 }}>
                  <span style={{ marginTop: 2, flexShrink: 0 }}>
                    {a.kind === "ok" ? <CheckCircle2 size={15} color="#10B981" />
                      : a.kind === "ai" ? <Sparkles size={15} color={GX_GOLD} />
                      : <AlertTriangle size={15} color={a.kind === "warn" ? "#F59E0B" : "#EF4444"} />}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--ia-text)" }}>{a.title}</span>
                    {a.sub && <span style={{ display: "block", fontSize: 11, color: "var(--ia-muted)", fontWeight: 500 }}>{a.sub}</span>}
                  </span>
                  <BackIcon size={13} style={{ marginInlineStart: "auto", marginTop: 3, color: "var(--ia-muted)" }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* المستخدم */}
      <div ref={userRef} className="gx-tb-user" style={{ position: "relative", flexShrink: 0 }}>
        <button className="gx-user" onClick={() => setUserOpen(o => !o)}
          aria-haspopup="menu" aria-expanded={userOpen}>
          <span className="gx-avatar" aria-hidden="true">{initials}</span>
          <span className="gx-user-meta">
            <span className="gx-user-name">{profile?.displayName || user?.email || ""}</span>
            <span className="gx-user-role">{roleLabel}</span>
          </span>
          <ChevronDown size={13} style={{ color: "var(--ia-muted)" }} />
        </button>
        {userOpen && (
          <div className="gx-menu" role="menu">
            <button className="gx-menu-item" onClick={() => { setUserOpen(false); onNavigate?.("account"); }}>
              <UserIcon size={15} /> <span>{tr("حسابي")}</span>
            </button>
            {isAdmin && (
              <button className="gx-menu-item" onClick={() => { setUserOpen(false); onOpenUsers?.(); }}>
                <ShieldCheck size={15} /> <span>{tr("المستخدمون والأدوار")}</span>
              </button>
            )}
            <div className="gx-menu-sep" />
            <button className="gx-menu-item" onClick={() => { setUserOpen(false); onLogout?.(); }}
              style={{ color: "#DC2626" }}>
              <LogOut size={15} /> <span>{tr("تسجيل الخروج")}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
