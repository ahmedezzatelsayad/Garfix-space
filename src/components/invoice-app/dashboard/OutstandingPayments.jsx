"use client";
/**
 * OutstandingPayments — بطاقة المدفوعات المستحقة (r25).
 *
 * تجميع المستحق حسب العميل (المبلغ/أيام التأخير/الحالة) + تحديد جماعي
 * بمربعات + إرسال تذكيرات للمحددين + إجراءات صف (تذكير/عرض/تسجيل دفعة).
 */
import { useState } from "react";
import { BellRing, User, Wallet, Send, Users, CheckSquare, Square } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { CardHead, StatusBadge } from "./chartlets";

export default function OutstandingPayments({
  rows = [], fmt, onSendReminder, onViewCustomer, onRecordPayment, onBulkRemind, allRows = [],
}) {
  const [sel, setSel] = useState([]);
  const toggle = k => setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k]);
  const allSel = rows.length > 0 && rows.every(r => sel.includes(r.key));
  const toggleAll = () => setSel(allSel ? [] : rows.map(r => r.key));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="gx-card">
      <CardHead
        icon={<BellRing size={15} />} iconBg="rgba(245,158,11,.13)" iconColor="#B45309"
        title={tr("مدفوعات مستحقة")}
        sub={rows.length ? <span className="gx-num">{tr("{0} عميل · إجمالي {1}", [rows.length, fmt(total)])}</span> : null}
        right={
          sel.length > 0 ? (
            <button className="gx-link" style={{ background: "rgba(16,185,129,.1)", color: "#047857", fontWeight: 800 }}
              onClick={() => { onBulkRemind?.(sel); setSel([]); }}>
              <Send size={13} /> {tr("تذكير للمحددين")} (<span className="gx-num">{sel.length}</span>)
            </button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <div className="gx-empty">
          <CheckSquare size={32} color="#10B981" strokeWidth={1.6} />
          <div className="gx-empty-t">{tr("لا مدفوعات مستحقة")}</div>
          <div className="gx-empty-s">{tr("كل الفواتير محصّلة — عمل رائع!")}</div>
        </div>
      ) : (
        <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
          <table className="gx-table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label={tr("تحديد الكل")}
                    style={{ cursor: "pointer", width: 15, height: 15, accentColor: "#2563EB" }} />
                </th>
                <th>{tr("العميل")}</th>
                <th>{tr("المبلغ")}</th>
                <th className="gx-hide-m">{tr("أيام التأخير")}</th>
                <th>{tr("الحالة")}</th>
                <th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ background: sel.includes(r.key) ? "rgba(37,99,235,.04)" : undefined }}>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="gx-ibtn" style={{ padding: 2 }} onClick={() => toggle(r.key)}
                      aria-label={tr("تحديد {0}", [r.name])} role="checkbox" aria-checked={sel.includes(r.key)}>
                      {sel.includes(r.key) ? <CheckSquare size={15} color="#2563EB" /> : <Square size={15} />}
                    </button>
                  </td>
                  <td>
                    <div className="gx-td-main" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    {r.phone && <div className="gx-td-sub" style={{ direction: "ltr", textAlign: "start" }}>{r.phone}</div>}
                  </td>
                  <td className="gx-num" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{fmt(r.amount)}</td>
                  <td className="gx-hide-m gx-num" style={{ fontWeight: 700, color: r.days > 0 ? "#B91C1C" : "var(--ia-sub)" }}>
                    {r.days > 0 ? tr("{0} يوم", [r.days]) : "—"}
                  </td>
                  <td><StatusBadge st={r.days > 0 ? "overdue" : "pending"} /></td>
                  <td>
                    <div className="gx-rowacts">
                      <button className="gx-ibtn" title={tr("إرسال تذكير")} aria-label={tr("إرسال تذكير")}
                        onClick={() => onSendReminder?.(r)}><Send size={14} color="#059669" /></button>
                      <button className="gx-ibtn gx-hide-m" title={tr("عرض العميل")} aria-label={tr("عرض العميل")}
                        onClick={() => onViewCustomer?.(r)}><User size={15} /></button>
                      <button className="gx-ibtn" title={tr("تسجيل دفعة")} aria-label={tr("تسجيل دفعة")}
                        onClick={() => onRecordPayment?.((r.invs || [])[0])}><Wallet size={15} color="#2563EB" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {allRows.length > rows.length && (
        <div style={{ padding: "8px 18px 14px", fontSize: 11.5, color: "var(--ia-muted)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Users size={13} /> {tr("تُعرض أعلى {0} من {1} عميل", [rows.length, allRows.length])}
        </div>
      )}
    </div>
  );
}
