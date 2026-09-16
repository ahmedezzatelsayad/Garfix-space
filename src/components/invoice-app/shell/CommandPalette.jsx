"use client";
/**
 * CommandPalette — البحث العالمي ⌘K / Ctrl K لـ GarfiX Business OS (r25).
 *
 * يبحث في: الإجراءات السريعة + الفواتير (رقم/عميل/هاتف) + العملاء + التنقل.
 * لوحة مفاتيح كاملة: أسهم للتحرك، Enter للتنفيذ، Esc للإغلاق.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, FileText, Users, CreditCard, BarChart3, Sparkles, Upload, Plus,
  FilePlus2, ArrowRight, ArrowLeft, CornerDownLeft, X,
} from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { GX_GOLD } from "./shell-css";

const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const has = (txt, q) => toW(String(txt || "").toLowerCase()).includes(toW(q.toLowerCase()));

export default function CommandPalette({ open, onClose, invoices = [], clients = [], onAction }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // تُركّب لوحة الأوامر فقط عند الفتح (من الأب) — التركيز الأولي بعد التركيب
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo(() => {
    const out = [];
    const push = (icon, title, sub, run, tint) => out.push({ icon, title, sub, run, tint });

    // ── الإجراءات السريعة ──
    const actions = [
      { icon: FilePlus2, title: tr("إنشاء فاتورة"), sub: tr("إجراء سريع"), key: "createInvoice", primary: true },
      { icon: Plus, title: tr("إضافة عميل"), sub: tr("إجراء سريع"), key: "addCustomer" },
      { icon: CreditCard, title: tr("تسجيل دفعة"), sub: tr("إجراء سريع"), key: "recordPayment" },
      { icon: Upload, title: tr("استيراد بيانات (CSV / Excel)"), sub: tr("إجراء سريع"), key: "importData" },
      { icon: BarChart3, title: tr("عرض التقارير"), sub: tr("إجراء سريع"), key: "viewReports" },
      { icon: Sparkles, title: tr("اسأل GarfiX AI"), sub: tr("إجراء سريع"), key: "askAI", gold: true },
    ];
    for (const a of actions) {
      if (!q || has(a.title, q)) push(a.icon, a.title, a.sub, () => onAction(a.key), a.gold ? "gold" : (a.primary ? "blue" : undefined));
    }

    // ── الفواتير ──
    const invs = invoices
      .filter(inv => !q || has(inv.invNum, q) || has(inv.clientName, q) || has(inv.clientPhone, q))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, q ? 7 : 5);
    if (invs.length) {
      for (const inv of invs) {
        push(FileText, `${inv.invNum} — ${inv.clientName || tr("عميل")}`,
          `${inv.date || ""} · ${inv.clientPhone || ""}`,
          () => onAction("openInvoice", inv));
      }
    }

    // ── العملاء ──
    const cls = (clients || [])
      .filter(c => !q || has(c.name, q) || has(c.phone, q))
      .slice(0, q ? 6 : 4);
    for (const c of cls) {
      push(Users, c.name || tr("عميل"), c.phone || "", () => onAction("openCustomer", c));
    }

    return out;
  }, [q, invoices, clients, onAction]);

  useEffect(() => {
    const el = listRef.current?.querySelector(".gx-sel");
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open) return null;

  const runSel = () => { const it = items[sel]; if (it) { onClose(); it.run(); } };

  const onKey = e => {
    if (e.key === "Escape") { onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); runSel(); }
  };

  return (
    <div className="gx-cp-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gx-cp" role="dialog" aria-modal="true" aria-label={tr("البحث الشامل")} onKeyDown={onKey}>
        <div className="gx-cp-head">
          <Search size={18} color="var(--ia-muted)" aria-hidden="true" />
          <input ref={inputRef} className="gx-cp-input" value={q}
            onChange={e => { setQ(e.target.value); setSel(0); }}
            placeholder={tr("ابحث… فواتير، عملاء، إجراءات")}
            aria-label={tr("حقل البحث")} />
          <button onClick={onClose} aria-label={tr("إغلاق")}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ia-muted)", padding: 4, display: "flex" }}>
            <X size={16} />
          </button>
        </div>
        <div className="gx-cp-list" ref={listRef}>
          {items.length === 0 && (
            <div style={{ padding: "26px 16px", textAlign: "center", color: "var(--ia-muted)", fontSize: 13, fontWeight: 600 }}>
              {tr("لا نتائج لـ «{0}»", [q])}
            </div>
          )}
          {items.map((it, i) => (
            <button key={i} className={`gx-cp-item${i === sel ? " gx-sel" : ""}`}
              onMouseEnter={() => setSel(i)} onClick={runSel}>
              <span className="gx-cp-icon" style={it.tint === "gold" ? { color: GX_GOLD, background: "rgba(212,175,55,.12)" }
                : it.tint === "blue" ? { color: "#2563EB", background: "rgba(37,99,235,.1)" } : undefined}>
                <it.icon size={16} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="gx-cp-title" style={{ display: "block" }}>{it.title}</span>
                {it.sub && <span className="gx-cp-sub" style={{ display: "block" }}>{it.sub}</span>}
              </span>
              {i === sel && <CornerDownLeft size={14} color="var(--ia-muted)" style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>
        <div className="gx-cp-foot">
          <span>↑↓ {tr("تنقل")}</span><span>↵ {tr("فتح")}</span><span>esc {tr("إغلاق")}</span>
        </div>
      </div>
    </div>
  );
}
