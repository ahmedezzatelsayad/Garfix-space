"use client";
/**
 * RecentInvoices — بطاقة أحدث الفواتير (r25).
 *
 * جدول أعمال كثيف: رقم الفاتورة/العميل/التاريخ/المبلغ/الحالة + إجراءات صف
 * (عرض/تعديل/تكرار/PDF/إرسال/تسجيل دفعة) بأيقونات lucide وتلميحات،
 * وحالة فارغة احترافية إن لم توجد فواتير.
 */
import { Eye, Pencil, Copy, FileDown, Send, Wallet, FileText, ArrowRight, ArrowLeft, Inbox } from "lucide-react";
import { appDir, dateLocale, tr } from "@/lib/i18n-app";
import { CardHead, StatusBadge } from "./chartlets";

const fDate = s => {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  try { return new Date(+y, +m - 1, +d).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }); }
  catch { return `${d}/${m}/${y}`; }
};

export default function RecentInvoices({
  invoices = [], fmt, onView, onEdit, onDuplicate, onPdf, onSend, onRecordPayment, onViewAll, canEdit = true,
}) {
  const BackIcon = appDir() === "rtl" ? ArrowLeft : ArrowRight;
  const rows = invoices.slice(0, 7);
  return (
    <div className="gx-card">
      <CardHead
        icon={<FileText size={15} />} iconBg="rgba(37,99,235,.1)" iconColor="#2563EB"
        title={tr("أحدث الفواتير")}
        right={
          <button className="gx-link" onClick={onViewAll}>
            {tr("عرض الكل")} <BackIcon size={13} />
          </button>
        }
      />
      {rows.length === 0 ? (
        <div className="gx-empty">
          <Inbox size={34} color="var(--ia-muted)" strokeWidth={1.5} />
          <div className="gx-empty-t">{tr("لا توجد فواتير بعد")}</div>
          <div className="gx-empty-s">{tr("أنشئ فاتورتك الأولى وابدأ بتتبع أعمالك.")}</div>
        </div>
      ) : (
        <div className="gx-card-b gx-p0" style={{ overflowX: "auto" }}>
          <table className="gx-table">
            <thead>
              <tr>
                <th>{tr("الفاتورة")}</th>
                <th>{tr("العميل")}</th>
                <th className="gx-hide-m">{tr("التاريخ")}</th>
                <th>{tr("المبلغ")}</th>
                <th>{tr("الحالة")}</th>
                <th style={{ textAlign: "end" }}>{tr("إجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(inv => {
                const st = inv._st;
                return (
                  <tr key={inv.id} onClick={() => onView?.(inv)} style={{ cursor: "pointer" }}>
                    <td><span className="gx-invid">{inv.invNum}</span></td>
                    <td>
                      <div className="gx-td-main" style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {inv.clientName || tr("عميل")}
                      </div>
                      {inv.clientPhone && <div className="gx-td-sub" style={{ direction: "ltr", textAlign: "start" }}>{inv.clientPhone}</div>}
                    </td>
                    <td className="gx-hide-m" style={{ whiteSpace: "nowrap", color: "var(--ia-sub)", fontSize: 12 }}>{fDate(inv.date)}</td>
                    <td className="gx-num" style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{fmt(inv._total)}</td>
                    <td><StatusBadge st={st} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="gx-rowacts">
                        <button className="gx-ibtn" title={tr("عرض")} aria-label={tr("عرض")} onClick={() => onView?.(inv)}><Eye size={15} /></button>
                        {canEdit && <button className="gx-ibtn" title={tr("تعديل")} aria-label={tr("تعديل")} onClick={() => onEdit?.(inv)}><Pencil size={14} /></button>}
                        {canEdit && <button className="gx-ibtn" title={tr("تكرار")} aria-label={tr("تكرار")} onClick={() => onDuplicate?.(inv)}><Copy size={14} /></button>}
                        <button className="gx-ibtn" title={tr("تنزيل PDF")} aria-label={tr("تنزيل PDF")} onClick={() => onPdf?.(inv)}><FileDown size={15} /></button>
                        <button className="gx-ibtn gx-hide-m" title={tr("إرسال تذكير واتساب")} aria-label={tr("إرسال تذكير واتساب")} onClick={() => onSend?.(inv)}><Send size={14} /></button>
                        {canEdit && st !== "paid" && st !== "cancel" && (
                          <button className="gx-ibtn" title={tr("تسجيل دفعة")} aria-label={tr("تسجيل دفعة")} onClick={() => onRecordPayment?.(inv)}>
                            <Wallet size={15} color="#059669" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
