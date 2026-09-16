"use client";
/**
 * AppShell — هيكل تطبيق GarfiX Business OS العالمي (r25).
 *
 * يسار: شريط جانبي كحلي ثابت (260px، يُطوى إلى 76px، ينزلق فوق الشاشة على الجوال).
 * وسط: شريط علوي (بحث ⌘K + لغة/عملة/دولة/سمة/إشعارات/مستخدم) + منطقة المحتوى.
 * يمين: لوحة GarfiX AI سياقية (اختيارية، تُفتح بزر Sparkles).
 * جوال: تنقّل سفلي (لوحة/فواتير/عملاء/مدفوعات/AI) + زر إجراءات عائم.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Sparkles, LayoutDashboard, FileText, Users, CreditCard, Plus,
  FilePlus2, UserPlus, Wallet, Upload, X,
} from "lucide-react";
import { tr, appDir } from "@/lib/i18n-app";
import { SHELL_CSS, GX_GOLD, GX_ROYAL } from "./shell-css";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";
import AiPanel from "./AiPanel";

/** استعلام وسائط صغير */
function useMedia(query) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const read = () => setOn(mq.matches);
    read();
    mq.addEventListener?.("change", read);
    return () => mq.removeEventListener?.("change", read);
  }, [query]);
  return on;
}

const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function AppShell({
  dir, view, onNavigate, children,
  company, companies, onSwitchCompany, onAddCompany, onEditCompany,
  user, profile, isAdmin, perms,
  dark, onToggleTheme,
  invoices = [], clients = [],
  alerts = [], onOpenAlert,
  onLogout, onOpenUsers, onManagePlan,
  overdueCount = 0,
  onAction,           // (key, payload?) => void — إجراءات لوحة الأوامر والـFAB
  onRefreshData,      // () => void — عند تنفيذ AI إجراءً يغيّر البيانات
}) {
  const [collapsed, setCollapsed] = useState(() => lsGet("gx_sb_collapsed", "0") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(() => lsGet("gx_ai_open", "0") === "1");
  const [fabOpen, setFabOpen] = useState(false);
  const [country, setCountry] = useState(() => lsGet("garfix_country", "") || null);
  const isNarrow = useMedia("(max-width: 1279px)");

  useEffect(() => { lsSet("gx_sb_collapsed", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => { lsSet("gx_ai_open", aiOpen ? "1" : "0"); }, [aiOpen]);
  useEffect(() => { lsSet("garfix_country", country || ""); }, [country]);

  // اختصار لوحة الأوامر: ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback(v => { onNavigate?.(v); setMobileOpen(false); setFabOpen(false); }, [onNavigate]);

  const doAction = useCallback((key, payload) => {
    setPaletteOpen(false);
    setFabOpen(false);
    onAction?.(key, payload);
  }, [onAction]);

  // عناصر التنقل السفلي للجوال
  const bottomNav = [
    { id: "dash", icon: LayoutDashboard, label: () => tr("لوحة التحكم") },
    { id: "list", icon: FileText, label: () => tr("الفواتير") },
    { id: "customers", icon: Users, label: () => tr("العملاء") },
    { id: "payments", icon: CreditCard, label: () => tr("المدفوعات") },
    { id: "chat", icon: Sparkles, label: () => "AI", gold: true },
  ];

  const fabItems = [
    { key: "createInvoice", icon: FilePlus2, label: () => tr("إنشاء فاتورة") },
    { key: "addCustomer", icon: UserPlus, label: () => tr("إضافة عميل") },
    { key: "recordPayment", icon: Wallet, label: () => tr("تسجيل دفعة") },
    { key: "askAI", icon: Sparkles, label: () => tr("اسأل GarfiX AI"), ai: true },
  ];

  return (
    <div dir={dir || appDir()} className="gx-root">
      <style>{SHELL_CSS}</style>

      {/* الشريط الجانبي (ثابت/منزلق) */}
      <SideNav
        view={view}
        onNavigate={navigate}
        company={company}
        companies={companies}
        onSwitchCompany={onSwitchCompany}
        onAddCompany={onAddCompany}
        onEditCompany={onEditCompany}
        onOpenUsers={onOpenUsers}
        isAdmin={isAdmin}
        perms={perms}
        collapsed={collapsed && !isNarrow}
        onToggleCollapse={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        overdueCount={overdueCount}
        onManagePlan={onManagePlan}
      />
      {mobileOpen && <div className="gx-sb-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      {/* العمود الرئيسي */}
      <div className="gx-main">
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          burger={isNarrow}
          onBurger={() => setMobileOpen(true)}
          dark={dark}
          onToggleTheme={onToggleTheme}
          country={country}
          onSetCountry={setCountry}
          alerts={alerts}
          onOpenAlert={onOpenAlert}
          profile={profile}
          isAdmin={isAdmin}
          user={user}
          onNavigate={navigate}
          onOpenUsers={onOpenUsers}
          onLogout={onLogout}
          extraActions={
            <button className="gx-top-btn" onClick={() => setAiOpen(a => !a)}
              title={tr("لوحة GarfiX AI")} aria-label={tr("لوحة GarfiX AI")}
              aria-pressed={aiOpen}
              style={aiOpen ? { background: "var(--ia-hover)", color: GX_ROYAL } : undefined}>
              <Sparkles size={16} color={aiOpen ? GX_GOLD : undefined} />
            </button>
          }
        />
        <main className="gx-content" id="gx-main">
          {children}
        </main>
      </div>

      {/* لوحة AI الجانبية */}
      <AiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        company={company}
        onDataChanged={onRefreshData}
      />

      {/* لوحة الأوامر ⌘K — تُركّب عند الفتح فقط (حالة نظيفة كل مرة) */}
      {paletteOpen && (
        <CommandPalette
          open
          onClose={() => setPaletteOpen(false)}
          invoices={invoices}
          clients={clients}
          onAction={doAction}
        />
      )}

      {/* تنقّل الجوال السفلي */}
      <nav className="gx-bottom-nav" aria-label={tr("التنقل السفلي")}>
        {bottomNav.map(n => {
          const Icon = n.icon;
          const active = view === n.id;
          return (
            <button key={n.id} className={`gx-bn-item${active ? " gx-active" : ""}${n.gold ? " gx-bn-ai" : ""}`}
              onClick={() => navigate(n.id)} aria-current={active ? "page" : undefined}>
              <Icon size={19} strokeWidth={2.2} />
              <span>{n.label()}</span>
            </button>
          );
        })}
      </nav>

      {/* زر الإجراءات العائم (جوال) */}
      <button className="gx-fab" onClick={() => setFabOpen(f => !f)}
        aria-label={tr("إجراءات سريعة")} aria-expanded={fabOpen}>
        {fabOpen ? <X size={22} /> : <Plus size={22} />}
      </button>
      {fabOpen && (
        <div className="gx-fab-menu" role="menu">
          {fabItems.map(it => {
            const Icon = it.icon;
            return (
              <button key={it.key} className={`gx-fab-item${it.ai ? " gx-ai" : ""}`} role="menuitem"
                onClick={() => doAction(it.key)}>
                <Icon size={16} color={it.ai ? "#7c3aed" : GX_ROYAL} />
                <span>{it.label()}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
