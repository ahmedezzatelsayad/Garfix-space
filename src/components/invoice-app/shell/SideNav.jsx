"use client";
/**
 * SideNav — الشريط الجانبي الكحلي لـ GarfiX Business OS (r25).
 *
 * - شعار GarfiX (G ذهبية) + منتقي الشركة (تبديل/إضافة/تعديل).
 * - مجموعات: MAIN / AI / OPERATIONS / ADMIN — عناصر بأيقونات lucide (بلا إيموجي).
 * - بطاقة الاشتراك (Business Plan — $10/شركة/شهرياً) + مساعدة/توثيق/دعم.
 * - طي إلى أيقونات + تنقل بلوحة المفاتيح + رؤية حسب الصلاحيات + RTL/LTR كامل.
 */
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, FileText, Users, CreditCard, BarChart3,
  Sparkles, Upload, ScanText, ShoppingCart, Printer, BellRing,
  Building2, Globe, ShieldCheck, Plug, Database, ChevronDown, Plus,
  Pencil, Crown, HelpCircle, BookOpen, LifeBuoy, PanelLeftClose, PanelLeftOpen, X, Bot,
} from "lucide-react";
import { tr, companyName } from "@/lib/i18n-app";
import { CURRENCIES } from "../currency";
import { GX_GOLD } from "./shell-css";

const NAV_GROUPS = [
  {
    label: () => tr("الرئيسية"),
    items: [
      { id: "dash", icon: LayoutDashboard, label: () => tr("لوحة التحكم") },
      { id: "list", icon: FileText, label: () => tr("الفواتير"), perm: null },
      { id: "customers", icon: Users, label: () => tr("العملاء"), perm: "view_customers" },
      { id: "payments", icon: CreditCard, label: () => tr("المدفوعات") },
      { id: "reports", icon: BarChart3, label: () => tr("التقارير") },
    ],
  },
  {
    label: () => tr("الذكاء الاصطناعي"),
    items: [
      // المرحلة 2: وكيل جارفِكس — حلقة Think→Act→Observe بأدوات حقيقية
      { id: "agent", icon: Bot, label: () => tr("الوكيل"), gold: true },
      { id: "chat", icon: Sparkles, label: () => tr("المساعد الذكي") },
      { id: "bulk", icon: Upload, label: () => tr("الاستيراد الذكي"), perm: "bulk_input" },
      { id: "ai", icon: ScanText, label: () => tr("التحليل الذكي") },
    ],
  },
  {
    label: () => tr("العمليات"),
    items: [
      { id: "purchase", icon: ShoppingCart, label: () => tr("المشتريات") },
      { id: "print", icon: Printer, label: () => tr("الطباعة"), perm: "print_invoice" },
      { id: "reminders", icon: BellRing, label: () => tr("التذكيرات") },
    ],
  },
  {
    label: () => tr("الإدارة"),
    admin: true,
    items: [
      { id: "company", icon: Building2, label: () => tr("الشركة"), action: "editCompany" },
      { id: "site", icon: Globe, label: () => tr("الموقع") },
      { id: "users", icon: ShieldCheck, label: () => tr("المستخدمون والأدوار"), action: "users" },
      { id: "deepseek", icon: Plug, label: () => tr("التكاملات") },
      { id: "system", icon: Database, label: () => tr("النظام") },
    ],
  },
];

export default function SideNav({
  view, onNavigate, company, companies, onSwitchCompany, onAddCompany, onEditCompany,
  onOpenUsers, isAdmin, perms, collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
  overdueCount = 0, onManagePlan,
}) {
  const [coOpen, setCoOpen] = useState(false);
  const coRef = useRef(null);
  const navRef = useRef(null);

  // إغلاق قائمة الشركة عند النقر خارجها
  useEffect(() => {
    if (!coOpen) return;
    const onDoc = e => { if (coRef.current && !coRef.current.contains(e.target)) setCoOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [coOpen]);

  // تنقل بلوحة المفاتيح داخل الشريط (أسهم أعلى/أسفل بين عناصر التنقل)
  const onNavKey = e => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(navRef.current?.querySelectorAll(".gx-nav-item:not([hidden])") || []);
    if (!items.length) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement);
    const next = e.key === "ArrowDown"
      ? items[(idx + 1 + items.length) % items.length]
      : items[(idx - 1 + items.length) % items.length];
    next?.focus();
  };

  const go = item => {
    if (item.action === "editCompany") { onEditCompany?.(company); return; }
    if (item.action === "users") { onOpenUsers?.(); return; }
    onNavigate?.(item.id);
  };

  const cur = CURRENCIES[company?.currency] || CURRENCIES.KWD;
  const visibleGroups = NAV_GROUPS
    .filter(g => !g.admin || isAdmin)
    .map(g => ({ ...g, items: g.items.filter(it => !it.perm || !!perms?.[it.perm]) }));

  return (
    <aside
      className={`gx-sidebar${collapsed ? " gx-collapsed" : ""}${mobileOpen ? " gx-open" : ""}`}
      aria-label={tr("التنقل الرئيسي")}
    >
      {/* الشعار */}
      <div className="gx-logo">
        <div className="gx-logo-mark" aria-hidden="true">G</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div className="gx-logo-txt">Garfi<b>X</b></div>
            <div className="gx-logo-sub">{tr("نظام تشغيل الأعمال")}</div>
          </div>
        )}
        {mobileOpen && (
          <button className="gx-sb-collapse" style={{ marginInlineStart: "auto" }} onClick={onCloseMobile}
            aria-label={tr("إغلاق القائمة")}><X size={17} /></button>
        )}
      </div>

      {/* منتقي الشركة */}
      <div className="gx-co" ref={coRef}>
        <button className="gx-co-btn" onClick={() => setCoOpen(o => !o)}
          aria-haspopup="listbox" aria-expanded={coOpen}
          title={company ? tr("تبديل الشركة") : ""}>
          <span className="gx-co-logo" aria-hidden="true">{company?.logo || "🏢"}</span>
          {!collapsed && (
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="gx-co-name" style={{ display: "block" }}>{companyName(company)}</span>
              <span className="gx-co-role" style={{ display: "block" }}>
                {companies?.length > 1 ? tr("{0} شركة متاحة", [companies.length]) : tr("الشركة الرئيسية")}
              </span>
            </span>
          )}
          {!collapsed && <ChevronDown size={14} style={{ opacity: .5, flexShrink: 0 }} />}
        </button>
        {coOpen && !collapsed && (
          <div className="gx-co-menu" role="listbox">
            {(companies || []).map(co => (
              <button key={co.id} className={`gx-co-item${company?.id === co.id ? " gx-on" : ""}`}
                role="option" aria-selected={company?.id === co.id}
                onClick={() => { setCoOpen(false); if (company?.id !== co.id) onSwitchCompany?.(co); }}>
                <span aria-hidden="true">{co.logo || "🏢"}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {companyName(co)}
                </span>
                <span className="gx-co-cur">{(CURRENCIES[co.currency] || CURRENCIES.KWD).code}</span>
              </button>
            ))}
            {onAddCompany && (
              <>
                <div className="gx-menu-sep" style={{ background: "rgba(255,255,255,.1)", margin: "5px 8px" }} />
                <button className="gx-co-item" onClick={() => { setCoOpen(false); onAddCompany(); }}>
                  <Plus size={15} style={{ color: GX_GOLD }} />
                  <span>{tr("إضافة شركة جديدة")}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* مجموعات التنقل */}
      <nav className="gx-sb-scroll" ref={navRef} onKeyDown={onNavKey}>
        {visibleGroups.map(g => (
          <div className="gx-grp" key={g.label()}>
            {!collapsed && <div className="gx-grp-label">{g.label()}</div>}
            {g.items.map(item => {
              const Icon = item.icon;
              const active = !item.action && view === item.id;
              return (
                <button
                  key={item.id}
                  className={`gx-nav-item${active ? " gx-active" : ""}`}
                  onClick={() => { go(item); if (mobileOpen) onCloseMobile?.(); }}
                  title={collapsed ? item.label() : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={2.1} color={item.gold ? GX_GOLD : undefined} />
                  <span>{item.label()}</span>
                  {item.id === "reminders" && overdueCount > 0 && (
                    <span className={`gx-nav-badge${overdueCount > 8 ? " gx-amber" : ""}`}>{overdueCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* بطاقة الاشتراك */}
        <div className="gx-sub-card">
          <div className="gx-plan"><Crown size={14} color={GX_GOLD} /> {tr("باقة الأعمال")}</div>
          <div className="gx-price gx-num">$10 <span>{tr("/ شركة / شهرياً")}</span></div>
          <button className="gx-sub-manage" onClick={() => { onManagePlan?.(); if (mobileOpen) onCloseMobile?.(); }}>
            {tr("إدارة الباقة")}
          </button>
        </div>

        {/* مساعدة */}
        <div className="gx-help">
          <button onClick={() => onNavigate?.("help")}>
            <HelpCircle size={15} /> <span>{tr("المساعدة")}</span>
          </button>
          <a href="https://garfix.app" target="_blank" rel="noopener noreferrer">
            <BookOpen size={15} /> <span>{tr("التوثيق")}</span>
          </a>
          <a href="https://wa.me/201033514479" target="_blank" rel="noopener noreferrer">
            <LifeBuoy size={15} /> <span>{tr("الدعم")}</span>
          </a>
        </div>
      </nav>

      {/* زر الطي */}
      {!mobileOpen && (
        <button className="gx-sb-collapse" onClick={onToggleCollapse}
          aria-label={collapsed ? tr("توسيع الشريط الجانبي") : tr("طي الشريط الجانبي")}
          title={collapsed ? tr("توسيع الشريط الجانبي") : tr("طي الشريط الجانبي")}>
          {collapsed
            ? <PanelLeftOpen size={17} />
            : <PanelLeftClose size={17} />}
        </button>
      )}
    </aside>
  );
}
