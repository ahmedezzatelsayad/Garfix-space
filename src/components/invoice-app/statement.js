// ─── Client Account Statement (كشف حساب العميل) ─────────────────────
// Standalone HTML builder for per-client account statements, exported as PDF
// via /api/pdf. Self-contained tiny numeric helpers (no import cycle with App).

import { fmtMoney } from "./currency";
const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN = s => parseFloat(toW(String(s || 0)).replace(/[^\d.]/g, "")) || 0;
const fKWD = n => fmtMoney(n); // r12: عملة الشركة النشطة
const fDate = d => { if (!d) return "—"; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString("ar-KW"); };
const iT = inv => (inv.items || []).reduce((s, it) => s + pN(it.qty) * pN(it.price), 0) + pN(inv.shipping || 0);

const overdueDays = inv => {
  if (!inv.dueDate) return 0;
  const due = new Date(inv.dueDate), now = new Date();
  if (isNaN(due)) return 0;
  const paid = pN(inv.paid || 0);
  if (paid >= iT(inv)) return 0; // fully paid → not overdue
  return Math.max(0, Math.floor((now - due) / 86400000));
};

const statusOf = inv => {
  const tot = iT(inv), paid = pN(inv.paid || 0);
  if (inv.status === "cancelled") return "cancel";
  if (paid >= tot) return "paid";
  if (paid > 0) return "part";
  return "unp";
};

const ST = {
  paid: { t: "مدفوعة", c: "#16a34a" },
  part: { t: "جزئي", c: "#b45309" },
  unp: { t: "غير مدفوعة", c: "#dc2626" },
  cancel: { t: "ملغية", c: "#6b7280" },
};

const lightenHex = (hex, t) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
  if (!m) return hex;
  const r = Math.round(parseInt(m[1], 16) + (255 - parseInt(m[1], 16)) * t);
  const g = Math.round(parseInt(m[2], 16) + (255 - parseInt(m[2], 16)) * t);
  const b = Math.round(parseInt(m[3], 16) + (255 - parseInt(m[3], 16)) * t);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const PAY_LABEL = { cash: "نقدي", knet: "كي نت", online: "تحويل", card: "بطاقة" };

/**
 * Build a full standalone HTML document for a client account statement.
 * @param {object} p
 * @param {object} p.client  {name, phone, address}
 * @param {Array}  p.invoices  the client's invoices (already payment-enriched: inv._pays)
 * @param {object} p.company  company config (name, nameAr, color, phone, email, address, city, manager…)
 * @param {string} p.styleId  "classic" | "modern" | "minimal"
 */
export function buildStatementHTML({ client, invoices, company, styleId = "classic" }) {
  const c = company;
  const S = styleId === "modern"
    ? { acc: c.color || "#1e3a5f", thead: `linear-gradient(135deg,${c.color},${lightenHex(c.color, .18)})`, theadTx: "#fff", border: `${c.color}40`, zebra: `${c.color}08`, fill: c.color, fillTx: "#fff", bar: true }
    : styleId === "minimal"
      ? { acc: "#111827", thead: "#fff", theadTx: "#000", border: "#999", zebra: "#fff", fill: "#fff", fillTx: "#000", bar: false }
      : { acc: "#111827", thead: "#111827", theadTx: "#fff", border: "#d1d5db", zebra: "#f9fafb", fill: "#111827", fillTx: "#fff", bar: false };

  const live = invoices.filter(inv => inv.status !== "cancelled");
  const totBilled = live.reduce((s, i) => s + iT(i), 0);
  const totPaid = live.reduce((s, i) => s + pN(i.paid || 0), 0);
  const balance = Math.max(0, totBilled - totPaid);
  const allPays = [];
  live.forEach(inv => (inv._pays || []).forEach(p => allPays.push({ ...p, invNum: inv.invNum })));
  allPays.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // aging buckets on outstanding amounts
  const buckets = [
    { label: "غير مستحقة", sub: "لم يحل موعد السداد", days: null },
    { label: "٠–٣٠ يوم", sub: "أيام التأخير", days: [0, 30] },
    { label: "٣١–٦٠ يوم", sub: "أيام التأخير", days: [31, 60] },
    { label: "٦١–٩٠ يوم", sub: "أيام التأخير", days: [61, 90] },
    { label: "+٩٠ يوم", sub: "تأخير طويل", days: [91, 1e9] },
  ].map(b => ({ ...b, amount: 0, count: 0 }));
  live.forEach(inv => {
    const rem = iT(inv) - pN(inv.paid || 0);
    if (rem <= 0.0001) return;
    const od = overdueDays(inv);
    const idx = od <= 0 ? 0 : od <= 30 ? 1 : od <= 60 ? 2 : od <= 90 ? 3 : 4;
    buckets[idx].amount += rem;
    buckets[idx].count += 1;
  });

  const invRows = invoices.map((inv, idx) => {
    const st = ST[statusOf(inv)] || ST.unp;
    const tot = iT(inv), paid = pN(inv.paid || 0), due = tot - paid;
    const od = overdueDays(inv);
    return `<tr style="background:${idx % 2 === 1 ? S.zebra : "#fff"};border-bottom:1px solid ${S.border};">
      <td style="padding:8px 10px;text-align:center;color:#9ca3af;font-size:11px;">${inv.invNum || ""}</td>
      <td style="padding:8px 12px;font-weight:600;color:#111;font-size:12px;">${fDate(inv.date)}</td>
      <td style="padding:8px 12px;color:#6b7280;font-size:11.5px;">${fDate(inv.dueDate)}</td>
      <td style="padding:8px 12px;text-align:left;direction:ltr;font-weight:600;font-size:12px;">${fKWD(tot)}</td>
      <td style="padding:8px 12px;text-align:left;direction:ltr;color:#16a34a;font-weight:700;font-size:12px;">${fKWD(paid)}</td>
      <td style="padding:8px 12px;text-align:left;direction:ltr;color:${due > 0 ? "#dc2626" : "#16a34a"};font-weight:800;font-size:12px;">${fKWD(Math.max(0, due))}</td>
      <td style="padding:8px 10px;text-align:center;"><span style="border:1.5px solid ${st.c};color:${st.c};border-radius:20px;padding:1px 9px;font-size:10px;font-weight:800;white-space:nowrap;">${st.t}${od > 0 ? ` ⏰${od}` : ""}</span></td>
    </tr>`;
  }).join("");

  const payRows = allPays.length ? allPays.map(p => `
    <tr style="border-bottom:1px solid ${S.border};">
      <td style="padding:7px 12px;color:#6b7280;font-size:11.5px;">${fDate(p.date)}</td>
      <td style="padding:7px 12px;text-align:center;"><span style="background:${styleId === "minimal" ? "transparent" : "#dcfce7"};color:#15803d;${styleId === "minimal" ? "border:1px solid #999;" : ""}border-radius:4px;padding:1px 8px;font-size:10.5px;font-weight:700;">${PAY_LABEL[p.method] || p.method || "—"}</span></td>
      <td style="padding:7px 12px;text-align:center;color:#9ca3af;font-size:11px;">${p.invNum || ""}</td>
      <td style="padding:7px 12px;text-align:left;direction:ltr;font-weight:700;color:#16a34a;font-size:11.5px;">${fKWD(p.amount)}</td>
      <td style="padding:7px 12px;color:#9ca3af;font-size:10.5px;">${p.note || ""}</td>
    </tr>`).join("") : "";

  const bucketCells = buckets.map((b, i) => {
    const active = b.amount > 0;
    const tone = i === 0 ? "#16a34a" : i <= 2 ? "#b45309" : "#dc2626";
    return `<td style="padding:10px 8px;text-align:center;border-left:1px solid ${S.border};${i === 4 ? "border-left:1px solid " + S.border + ";" : ""}">
      <div style="font-size:10px;font-weight:800;color:#9ca3af;margin-bottom:3px;">${b.label}</div>
      <div style="font-size:14px;font-weight:900;color:${active ? tone : "#d1d5db"};direction:ltr;">${fKWD(b.amount)}</div>
      <div style="font-size:9.5px;color:#9ca3af;margin-top:2px;">${active ? b.count + " فاتورة" : b.sub}</div>
    </td>`;
  }).join("");

  const today = new Date().toLocaleDateString("ar-KW");

  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب ${client?.name || ""} — ${c.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;background:#fff}
body{font-family:'Tajawal','Cairo',Arial,sans-serif;direction:rtl;color:#1a1a2e;font-size:13px}
.page{padding:10mm;width:100%}
@page{size:A4;margin:6mm}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="page">
${S.bar ? `<div style="height:7px;background:linear-gradient(90deg,${S.acc},${lightenHex(S.acc, .25)});border-radius:4px;margin-bottom:14px;"></div>` : ""}

<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid ${S.acc};margin-bottom:16px;">
  <div>
    <div style="font-size:18px;font-weight:900;color:${S.acc};margin-bottom:4px;">${c.name}</div>
    <div style="font-size:10px;color:#6b7280;line-height:2;">${c.nameAr} — ${c.address}, ${c.city}<br/><span style="direction:ltr;display:inline-block;">${c.phone}</span> | ${c.email}</div>
  </div>
  <div style="text-align:left;">
    <div style="font-size:26px;font-weight:900;color:${S.acc};letter-spacing:-1px;line-height:1;margin-bottom:3px;">كشف حساب</div>
    <div style="font-size:10.5px;color:#6b7280;font-weight:600;">حتى تاريخ ${today}</div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1.6fr 1fr 1fr;border:1.5px solid ${S.border};border-radius:8px;overflow:hidden;margin-bottom:14px;">
  <div style="padding:12px 16px;border-left:1.5px solid ${S.border};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">العميل</div>
    <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:3px;">${client.name || "—"}</div>
    <div style="font-size:12px;font-weight:700;direction:ltr;text-align:right;color:#374151;">${client.phone || ""}</div>
    ${client.address ? `<div style="font-size:10.5px;color:#6b7280;margin-top:3px;">${client.address}</div>` : ""}
  </div>
  <div style="padding:12px 14px;border-left:1.5px solid ${S.border};background:${styleId === "modern" ? `${S.acc}0d` : "#f9fafb"};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">إجمالي الفواتير</div>
    <div style="font-size:18px;font-weight:900;color:#111827;direction:ltr;text-align:right;">${fKWD(totBilled)}</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:2px;">${live.length} فاتورة سارية${invoices.length !== live.length ? " (" + invoices.length + " شاملة الملغاة)" : ""}</div>
  </div>
  <div style="padding:12px 14px;background:${styleId === "modern" ? `${S.acc}0d` : "#f9fafb"};">
    <div style="font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">الرصيد المستحق</div>
    <div style="font-size:18px;font-weight:900;color:${balance > 0 ? "#dc2626" : "#16a34a"};direction:ltr;text-align:right;">${fKWD(balance)}</div>
    <div style="font-size:10px;color:#9ca3af;margin-top:2px;">مدفوع ${fKWD(totPaid)}</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;border:1.5px solid ${S.border};border-radius:8px;overflow:hidden;margin-bottom:14px;">
  <thead><tr style="background:${S.thead};color:${S.theadTx};${styleId === "minimal" ? "border-bottom:2px solid #000;" : ""}">
    <th style="padding:9px 8px;width:76px;text-align:center;font-size:10.5px;font-weight:700;">رقم</th>
    <th style="padding:9px 12px;text-align:right;font-size:10.5px;font-weight:700;">تاريخ الفاتورة</th>
    <th style="padding:9px 12px;text-align:right;font-size:10.5px;font-weight:700;">الاستحقاق</th>
    <th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;">الإجمالي</th>
    <th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;">المدفوع</th>
    <th style="padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;">المتبقي</th>
    <th style="padding:9px 10px;text-align:center;font-size:10.5px;font-weight:700;">الحالة</th>
  </tr></thead>
  <tbody>${invRows || `<tr><td colspan="7" style="padding:18px;text-align:center;color:#9ca3af;">لا توجد فواتير لهذا العميل</td></tr>`}</tbody>
</table>

${allPays.length ? `
<div style="margin-bottom:14px;">
<div style="font-size:11px;font-weight:800;color:#374151;margin-bottom:6px;letter-spacing:.5px;">💳 سجل الدفعات (${allPays.length}) — إجمالي ${fKWD(allPays.reduce((s, p) => s + pN(p.amount), 0))}</div>
<table style="width:100%;border-collapse:collapse;border:1.5px solid ${S.border};border-radius:6px;overflow:hidden;">
  <thead><tr style="background:${styleId === "modern" ? `${S.acc}12` : "#f3f4f6"};border-bottom:1.5px solid ${S.border};">
    <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">التاريخ</th>
    <th style="padding:7px 12px;text-align:center;font-size:10px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">الطريقة</th>
    <th style="padding:7px 12px;text-align:center;font-size:10px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">الفاتورة</th>
    <th style="padding:7px 12px;text-align:left;font-size:10px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">المبلغ</th>
    <th style="padding:7px 12px;text-align:right;font-size:10px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">ملاحظة</th>
  </tr></thead>
  <tbody>${payRows}</tbody>
</table>
</div>` : ""}

<div style="border:1.5px solid ${S.border};border-radius:8px;overflow:hidden;margin-bottom:14px;">
  <div style="background:${styleId === "modern" ? `${S.acc}12` : "#f3f4f6"};padding:8px 14px;font-size:11px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};border-bottom:1.5px solid ${S.border};">⏰ تقادم الذمم (Aging)</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>${bucketCells}</tr>
  </table>
</div>

<div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
  <table style="min-width:270px;border-collapse:collapse;border:1.5px solid ${S.border};border-radius:6px;overflow:hidden;">
    <tr style="border-bottom:1px solid ${S.border};"><td style="padding:8px 16px;color:#6b7280;font-size:12.5px;">إجمالي المبيعات</td><td style="padding:8px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;">${fKWD(totBilled)}</td></tr>
    <tr style="border-bottom:1px solid ${S.border};"><td style="padding:8px 16px;color:#6b7280;font-size:12.5px;">إجمالي المدفوع</td><td style="padding:8px 16px;text-align:left;font-size:12.5px;font-weight:700;color:#16a34a;direction:ltr;">${fKWD(totPaid)}</td></tr>
    <tr style="background:${S.fill};color:${S.fillTx};"><td style="padding:10px 16px;font-size:13.5px;font-weight:800;">الرصيد النهائي</td><td style="padding:10px 16px;text-align:left;font-size:13.5px;font-weight:900;direction:ltr;">${fKWD(balance)}</td></tr>
  </table>
</div>

<div style="padding-top:10px;border-top:1.5px solid ${S.border};display:flex;justify-content:space-between;align-items:center;">
  <div style="font-size:9.5px;color:#9ca3af;font-weight:600;">الشركة القابضة المتحدة ذ.م.م — United Holding Group LLC</div>
  <div style="font-size:10.5px;font-weight:800;color:${styleId === "modern" ? S.acc : "#374151"};">${c.nameAr} | ${c.phone}</div>
</div>
</div></body></html>`;
}
