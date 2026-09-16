"use client";
/**
 * OperationsViews — شاشتا «المدفوعات» و«التذكيرات» (r25).
 *
 * PaymentsView: نظرة تحصيل شاملة — ملخص (محصّل/مستحق/متأخر) + تبويبان:
 *   المستحقات حسب العميل (تذكير/عرض/تسجيل دفعة) والفواتير المسددة.
 * RemindersView: كل المتأخرات والقادمة مع تذكير واتساب فردي وجماعي.
 */
import { useMemo, useState } from "react";
import {
  Wallet, BellRing, Send, User, CheckCircle2, Clock, AlertTriangle,
  ChevronRight, ChevronLeft, FileDown, RefreshCcw,
} from "lucide-react";
import { appDir, dateLocale, tr } from "@/lib/i18n-app";
import { useCurrency } from "../currency";
import { DASH_CSS } from "./dash-css";
import { CardHead, StatusBadge } from "./chartlets";

const toN = s => { const v = parseFloat(String(s ?? 0).replace(/[^\d.-]/g, "")); return isFinite(v) ? v : 0; };
const iT = inv => (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0) + toN(inv.shipping || 0) + (() => {
  const rate = toN(inv.taxRate || 0); if (!(rate > 0)) return 0;
  const sub = (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0);
  return +(sub * rate / 100).toFixed(2);
})();
const paidOf = inv => Math.min(toN(inv.paid || 0), iT(inv));
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const overdueDays = inv => {
  if (inv.status === "cancelled" || paidOf(inv) >= iT(inv) || !inv.dueDate) return 0;
  const today = dayKey(new Date());
  if (inv.dueDate >= today) return 0;
  return Math.floor((new Date(today) - new Date(inv.dueDate)) / 86400000);
};
const stOf = inv => {
  if (inv.status === "cancelled") return "cancel";
  const tot = iT(inv), paid = toN(inv.paid || 0);
  if (paid >= tot) return "paid";
  if (paid > 0) return "part";
  return overdueDays(inv) > 0 ? "overdue" : "pending";
};
const fDate = s => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  try { return new Date(+y, +m - 1, +d).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }); }
  catch { return `${d}/${m}/${y}`; }
};

/* ═══ شريط ملخص مشترك ═══ */
function SummaryBar({ items, fmt }) {
  return (
    <div className="gx-qas" style={{ gridTemplateColumns: `repeat(${items.length},1fr)`, marginTop: 0 }}>
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <div key={i} className="gx-card" style={{ padding: "13px 15px", flexDirection: "row", alignItems: "center", gap: 11 }}>
            <span className="gx-qa-ico" style={{ background: it.bg, color: it.color, width: 36, height: 36, borderRadius: 10 }}>
              <Icon size={17} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="gx-card-sub" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", fontWeight: 800 }}>{it.label}</div>
              <div className="gx-num" style={{ fontSize: 17, fontWeight: 800, color: "var(--ia-text)", marginTop: 1 }}>{it.value}</div>
              {it.sub && <div style={{ fontSize: 10.5, color: "var(--ia-muted)", fontWeight: 600 }}>{it.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ شاشة المدفوعات ═══ */
export function PaymentsView({ invoices = [], fmt, onRecordPayment, onSendReminder, onView, onPdf, canEdit = true }) {
  const [tab, setTab] = useState("out"); // out | paid
  const BackIcon = appDir() === "rtl" ? ChevronLeft : ChevronRight;
  const cur = useCurrency();

  const { rows, paidInvs } = useMemo(() => {
    const map = new Map();
    const paid = [];
    for (const inv of invoices) {
      const st = stOf(inv);
      if (st === "paid") { paid.push(inv); continue; }
      if (st === "cancel") continue;
      const rem = iT(inv) - paidOf(inv);
      if (rem <= 0) continue;
      const key = inv.clientPhone || inv.clientName || "?";
      const row = map.get(key) || { key, name: inv.clientName || tr("عميل"), phone: inv.clientPhone, amount: 0, days: 0, count: 0, invs: [] };
      row.amount += rem;
      row.days = Math.max(row.days, overdueDays(inv));
      row.count += 1;
      row.invs.push(inv);
      map.set(key, row);
    }
    paid.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return { rows: [...map.values()].sort((a, b) => b.amount - a.amount), paidInvs: paid };
  }, [invoices]);

  const collected = invoices.reduce((s, i) => s + paidOf(i), 0);
  const outstanding = rows.reduce((s, r) => s + r.amount, 0);
  const overdueTotal = rows.filter(r => r.days > 0).reduce((s, r) => s + r.amount, 0);
  const F = v => cur.fmt(v);

  return (
    <>
      <style>{DASH_CSS}</style>
      <style>{`.gx-btn-primary{display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;padding:8px 16px;background:#2563EB;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:filter .15s}.gx-btn-primary:hover{filter:brightness(1.08)}
.gx-btn-ghost{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--ia-border2);border-radius:10px;padding:8px 16px;background:var(--ia-card);color:var(--ia-text2);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.gx-btn-ghost:hover{border-color:var(--ia-muted)}
.gx-btn-wa{display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;padding:8px 16px;background:#16a34a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:filter .15s}.gx-btn-wa:hover{filter:brightness(1.08)}`}</style>

      <div className="gx-dash-head" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="gx-dash-hi">{tr("المدفوعات والتحصيل")}</h1>
          <div className="gx-dash-hs">{tr("تابع التحصيل والمستحقات وتذكيرات السداد من مكان واحد.")}</div>
        </div>
      </div>

      <SummaryBar items={[
        { icon: CheckCircle2, label: tr("المحصّل"), value: F(collected), sub: tr("{0} فاتورة مسددة", [paidInvs.length]), bg: "rgba(16,185,129,.12)", color: "#059669" },
        { icon: Clock, label: tr("المستحق"), value: F(outstanding), sub: tr("{0} عميل", [rows.length]), bg: "rgba(245,158,11,.13)", color: "#B45309" },
        { icon: AlertTriangle, label: tr("متأخر"), value: F(overdueTotal), sub: tr("{0} عميل متأخر", [rows.filter(r => r.days > 0).length]), bg: "rgba(239,68,68,.1)", color: "#DC2626" },
      ]} fmt={fmt} />

      <div className="gx-card" style={{ marginTop: 14 }}>
        <CardHead
          icon={<Wallet size={15} />} iconBg="rgba(37,99,235,.1)" iconColor="#2563EB"
          title={tr("إدارة التحصيل")}
          right={
            <div className="gx-chips">
              <button className={`gx-chip${tab === "out" ? " on" : ""}`} onClick={() => setTab("out")}>
                {tr("المستحقات")} (<span className="gx-num">{rows.length}</span>)
              </button>
              <button className={`gx-chip${tab === "paid" ? " on" : ""}`} onClick={() => setTab("paid")}>
                {tr("المسددة")} (<span className="gx-num">{paidInvs.length}</span>)
              </button>
            </div>
          } />

        {tab === "out" ? (
          rows.length === 0 ? (
            <div className="gx-empty">
              <CheckCircle2 size={34} color="#10B981" strokeWidth={1.6} />
              <div className="gx-empty-t">{tr("لا مدفوعات مستحقة")}</div>
              <div className="gx-empty-s">{tr("كل الفواتير محصّلة — عمل رائع!")}</div>
            </div>
          ) : (
            <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
              <table className="gx-table">
                <thead><tr>
                  <th>{tr("العميل")}</th><th>{tr("المستحق")}</th>
                  <th className="gx-hide-m">{tr("فواتير")}</th>
                  <th className="gx-hide-m">{tr("أيام التأخير")}</th>
                  <th>{tr("الحالة")}</th><th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.key}>
                      <td>
                        <div className="gx-td-main">{r.name}</div>
                        {r.phone && <div className="gx-td-sub" style={{ direction: "ltr", textAlign: "start" }}>{r.phone}</div>}
                      </td>
                      <td className="gx-num" style={{ fontWeight: 800 }}>{F(r.amount)}</td>
                      <td className="gx-hide-m gx-num">{r.count}</td>
                      <td className="gx-hide-m gx-num" style={{ fontWeight: 700, color: r.days > 0 ? "#B91C1C" : "var(--ia-sub)" }}>
                        {r.days > 0 ? tr("{0} يوم", [r.days]) : "—"}
                      </td>
                      <td><StatusBadge st={r.days > 0 ? "overdue" : "pending"} /></td>
                      <td>
                        <div className="gx-rowacts">
                          <button className="gx-ibtn" title={tr("إرسال تذكير")} aria-label={tr("إرسال تذكير")} onClick={() => onSendReminder?.(r)}>
                            <Send size={14} color="#059669" />
                          </button>
                          <button className="gx-ibtn" title={tr("عرض العميل")} aria-label={tr("عرض العميل")} onClick={() => onView?.(r.invs[0])}>
                            <User size={15} />
                          </button>
                          {canEdit && (
                            <button className="gx-ibtn" title={tr("تسجيل دفعة")} aria-label={tr("تسجيل دفعة")} onClick={() => onRecordPayment?.(r)}>
                              <Wallet size={15} color="#2563EB" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          paidInvs.length === 0 ? (
            <div className="gx-empty">
              <div className="gx-empty-t">{tr("لا فواتير مسددة بعد")}</div>
              <div className="gx-empty-s">{tr("سجّل أول دفعة ليتابع GarfiX تحصيلك.")}</div>
            </div>
          ) : (
            <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
              <table className="gx-table">
                <thead><tr>
                  <th>{tr("الفاتورة")}</th><th>{tr("العميل")}</th>
                  <th className="gx-hide-m">{tr("التاريخ")}</th>
                  <th>{tr("المبلغ")}</th><th>{tr("الحالة")}</th>
                  <th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
                </tr></thead>
                <tbody>
                  {paidInvs.slice(0, 40).map(inv => (
                    <tr key={inv.id} onClick={() => onView?.(inv)} style={{ cursor: "pointer" }}>
                      <td><span className="gx-invid">{inv.invNum}</span></td>
                      <td className="gx-td-main" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.clientName || tr("عميل")}</td>
                      <td className="gx-hide-m" style={{ color: "var(--ia-sub)", fontSize: 12, whiteSpace: "nowrap" }}>{fDate(inv.date)}</td>
                      <td className="gx-num" style={{ fontWeight: 800 }}>{F(iT(inv))}</td>
                      <td><StatusBadge st="paid" /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="gx-rowacts">
                          <button className="gx-ibtn" title={tr("عرض")} aria-label={tr("عرض")} onClick={() => onView?.(inv)}><ChevronRight size={15} style={{ transform: appDir() === "rtl" ? "scaleX(-1)" : undefined }} /></button>
                          <button className="gx-ibtn" title={tr("تنزيل PDF")} aria-label={tr("تنزيل PDF")} onClick={() => onPdf?.(inv)}><FileDown size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </>
  );
}

/* ═══ شاشة التذكيرات ═══ */
export function RemindersView({ invoices = [], fmt, onSendReminder, onBulkRemind, onView, canEdit = true }) {
  const cur = useCurrency();
  const F = v => cur.fmt(v);
  const { overdue, upcoming } = useMemo(() => {
    const od = [], up = [];
    for (const inv of invoices) {
      const st = stOf(inv);
      if (st === "paid" || st === "cancel") continue;
      const rem = iT(inv) - paidOf(inv);
      if (rem <= 0) continue;
      const d = overdueDays(inv);
      (d > 0 ? od : up).push({ ...inv, _rem: rem, _days: d });
    }
    od.sort((a, b) => b._days - a._days);
    up.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return { overdue: od, upcoming: up };
  }, [invoices]);

  const totalOverdue = overdue.reduce((s, i) => s + i._rem, 0);

  return (
    <>
      <style>{DASH_CSS}</style>
      <style>{`.gx-btn-wa{display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;padding:8px 16px;background:#16a34a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:filter .15s}.gx-btn-wa:hover{filter:brightness(1.08)}`}</style>

      <div className="gx-dash-head" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="gx-dash-hi">{tr("التذكيرات")}</h1>
          <div className="gx-dash-hs">{tr("تذكيرات سداد واتساب فورية — فردية وجماعية — مع سجل مرجعي لكل عميل.")}</div>
        </div>
        {overdue.length > 0 && canEdit && (
          <button className="gx-btn-wa" style={{ marginInlineStart: "auto" }} onClick={() => onBulkRemind?.(overdue.map(i => i.id))}>
            <Send size={14} /> {tr("تذكير جماعي لكل المتأخرين")} (<span className="gx-num">{overdue.length}</span>)
          </button>
        )}
      </div>

      <SummaryBar items={[
        { icon: AlertTriangle, label: tr("متأخرة"), value: String(overdue.length), sub: F(totalOverdue), bg: "rgba(239,68,68,.1)", color: "#DC2626" },
        { icon: Clock, label: tr("قادمة على الاستحقاق"), value: String(upcoming.length), sub: tr("غير متأخرة بعد"), bg: "rgba(245,158,11,.13)", color: "#B45309" },
        { icon: RefreshCcw, label: tr("أطول تأخير"), value: overdue[0] ? tr("{0} يوم", [overdue[0]._days]) : "—", sub: overdue[0] ? overdue[0].clientName : "", bg: "rgba(37,99,235,.1)", color: "#2563EB" },
      ]} fmt={fmt} />

      <div className="gx-card" style={{ marginTop: 14 }}>
        <CardHead icon={<BellRing size={15} />} iconBg="rgba(239,68,68,.1)" iconColor="#DC2626"
          title={tr("الفواتير المتأخرة عن الاستحقاق")}
          sub={overdue.length ? tr("{0} فاتورة بإجمالي {1}", [overdue.length, F(totalOverdue)]) : undefined} />
        {overdue.length === 0 ? (
          <div className="gx-empty">
            <CheckCircle2 size={34} color="#10B981" strokeWidth={1.6} />
            <div className="gx-empty-t">{tr("لا فواتير متأخرة")}</div>
            <div className="gx-empty-s">{tr("كل المستحقات ضمن مواعيدها — ممتاز!")}</div>
          </div>
        ) : (
          <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
            <table className="gx-table">
              <thead><tr>
                <th>{tr("الفاتورة")}</th><th>{tr("العميل")}</th>
                <th className="gx-hide-m">{tr("الاستحقاق")}</th>
                <th>{tr("التأخير")}</th><th>{tr("المتبقي")}</th>
                <th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
              </tr></thead>
              <tbody>
                {overdue.slice(0, 50).map(inv => (
                  <tr key={inv.id}>
                    <td><span className="gx-invid">{inv.invNum}</span></td>
                    <td>
                      <div className="gx-td-main" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.clientName || tr("عميل")}</div>
                      {inv.clientPhone && <div className="gx-td-sub" style={{ direction: "ltr", textAlign: "start" }}>{inv.clientPhone}</div>}
                    </td>
                    <td className="gx-hide-m" style={{ color: "var(--ia-sub)", fontSize: 12, whiteSpace: "nowrap" }}>{fDate(inv.dueDate)}</td>
                    <td><span className="gx-st overdue gx-num" style={{ fontSize: 11 }}>{tr("{0} يوم", [inv._days])}</span></td>
                    <td className="gx-num" style={{ fontWeight: 800 }}>{F(inv._rem)}</td>
                    <td>
                      <div className="gx-rowacts">
                        <button className="gx-ibtn" title={tr("إرسال تذكير واتساب")} aria-label={tr("إرسال تذكير واتساب")} onClick={() => onSendReminder?.(inv)}>
                          <Send size={14} color="#16a34a" />
                        </button>
                        <button className="gx-ibtn" title={tr("عرض الفاتورة")} aria-label={tr("عرض الفاتورة")} onClick={() => onView?.(inv)}>
                          <User size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="gx-card" style={{ marginTop: 14 }}>
          <CardHead icon={<Clock size={15} />} iconBg="rgba(245,158,11,.13)" iconColor="#B45309"
            title={tr("قادمة على الاستحقاق")}
            sub={tr("{0} فاتورة غير متأخرة بعد", [upcoming.length])} />
          <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
            <table className="gx-table">
              <thead><tr>
                <th>{tr("الفاتورة")}</th><th>{tr("العميل")}</th>
                <th>{tr("الاستحقاق")}</th><th>{tr("المتبقي")}</th>
                <th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
              </tr></thead>
              <tbody>
                {upcoming.slice(0, 15).map(inv => (
                  <tr key={inv.id}>
                    <td><span className="gx-invid">{inv.invNum}</span></td>
                    <td className="gx-td-main" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.clientName || tr("عميل")}</td>
                    <td style={{ color: "var(--ia-sub)", fontSize: 12, whiteSpace: "nowrap" }}>{fDate(inv.dueDate)}</td>
                    <td className="gx-num" style={{ fontWeight: 800 }}>{F(inv._rem)}</td>
                    <td>
                      <div className="gx-rowacts">
                        <button className="gx-ibtn" title={tr("إرسال تذكير واتساب")} aria-label={tr("إرسال تذكير واتساب")} onClick={() => onSendReminder?.(inv)}>
                          <Send size={14} color="#16a34a" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
