// ─── Client Account Statement (كشف حساب العميل) ─────────────────────
// Standalone HTML builder for per-client account statements, exported as PDF
// via /api/pdf. Self-contained tiny numeric helpers (no import cycle with App).

import { fmtMoney } from "./currency";
import { tr, appDir, appLang, companyName, dateLocale } from "@/lib/i18n-app";
const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN = s => parseFloat(toW(String(s || 0)).replace(/[^\d.]/g, "")) || 0;
const fKWD = n => fmtMoney(n); // r12: عملة الشركة النشطة
const fDate = d => { if (!d) return "—"; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString(dateLocale()); };
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
    { label: tr("غير مستحقة"), sub: tr("لم يحل موعد السداد"), days: null },
    { label: tr("٠–٣٠ يوم"), sub: tr("أيام التأخير"), days: [0, 30] },
    { label: tr("٣١–٦٠ يوم"), sub: tr("أيام التأخير"), days: [31, 60] },
    { label: tr("٦١–٩٠ يوم"), sub: tr("أيام التأخير"), days: [61, 90] },
    { label: tr("+٩٠ يوم"), sub: tr("تأخير طويل"), days: [91, 1e9] },
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
      <td style="padding:8px 10px;text-align:center;"><span style="border:1.5px solid ${st.c};color:${st.c};border-radius:20px;padding:1px 9px;font-size:10px;font-weight:800;white-space:nowrap;">${tr(st.t)}${od > 0 ? ` ⏰${od}` : ""}</span></td>
    </tr>`;
  }).join("");

  const payRows = allPays.length ? allPays.map(p => `
    <tr style="border-bottom:1px solid ${S.border};">
      <td style="padding:7px 12px;color:#6b7280;font-size:11.5px;">${fDate(p.date)}</td>
      <td style="padding:7px 12px;text-align:center;"><span style="background:${styleId === "minimal" ? "transparent" : "#dcfce7"};color:#15803d;${styleId === "minimal" ? "border:1px solid #999;" : ""}border-radius:4px;padding:1px 8px;font-size:10.5px;font-weight:700;">${tr(PAY_LABEL[p.method] || p.method || "—")}</span></td>
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
      <div style="font-size:9.5px;color:#9ca3af;margin-top:2px;">${active ? b.count + tr(" فاتورة") : b.sub}</div>
    </td>`;
  }).join("");

  const today = new Date().toLocaleDateString(dateLocale());

  return tr("<!DOCTYPE html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title>كشف حساب {0} — {1}</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap\" rel=\"stylesheet\">\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\nhtml,body{width:100%;background:#fff}\nbody{font-family:'Tajawal','Cairo',Arial,sans-serif;direction:rtl;color:#1a1a2e;font-size:13px}\n.page{padding:10mm;width:100%}\n@page{size:A4;margin:6mm}\n@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}\n</style></head><body><div class=\"page\">\n{2}\n\n<div style=\"display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid {3};margin-bottom:16px;\">\n  <div>\n    <div style=\"font-size:18px;font-weight:900;color:{4};margin-bottom:4px;\">{5}</div>\n    <div style=\"font-size:10px;color:#6b7280;line-height:2;\">{6} — {7}, {8}<br/><span style=\"direction:ltr;display:inline-block;\">{9}</span> | {10}</div>\n  </div>\n  <div style=\"text-align:left;\">\n    <div style=\"font-size:26px;font-weight:900;color:{11};letter-spacing:-1px;line-height:1;margin-bottom:3px;\">كشف حساب</div>\n    <div style=\"font-size:10.5px;color:#6b7280;font-weight:600;\">حتى تاريخ {12}</div>\n  </div>\n</div>\n\n<div style=\"display:grid;grid-template-columns:1.6fr 1fr 1fr;border:1.5px solid {13};border-radius:8px;overflow:hidden;margin-bottom:14px;\">\n  <div style=\"padding:12px 16px;border-left:1.5px solid {14};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;\">العميل</div>\n    <div style=\"font-size:15px;font-weight:800;color:#111;margin-bottom:3px;\">{15}</div>\n    <div style=\"font-size:12px;font-weight:700;direction:ltr;text-align:right;color:#374151;\">{16}</div>\n    {17}\n  </div>\n  <div style=\"padding:12px 14px;border-left:1.5px solid {18};background:{19};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;\">إجمالي الفواتير</div>\n    <div style=\"font-size:18px;font-weight:900;color:#111827;direction:ltr;text-align:right;\">{20}</div>\n    <div style=\"font-size:10px;color:#9ca3af;margin-top:2px;\">{21} فاتورة سارية{22}</div>\n  </div>\n  <div style=\"padding:12px 14px;background:{23};\">\n    <div style=\"font-size:8.5px;font-weight:800;color:#9ca3af;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;\">الرصيد المستحق</div>\n    <div style=\"font-size:18px;font-weight:900;color:{24};direction:ltr;text-align:right;\">{25}</div>\n    <div style=\"font-size:10px;color:#9ca3af;margin-top:2px;\">مدفوع {26}</div>\n  </div>\n</div>\n\n<table style=\"width:100%;border-collapse:collapse;border:1.5px solid {27};border-radius:8px;overflow:hidden;margin-bottom:14px;\">\n  <thead><tr style=\"background:{28};color:{29};{30}\">\n    <th style=\"padding:9px 8px;width:76px;text-align:center;font-size:10.5px;font-weight:700;\">رقم</th>\n    <th style=\"padding:9px 12px;text-align:right;font-size:10.5px;font-weight:700;\">تاريخ الفاتورة</th>\n    <th style=\"padding:9px 12px;text-align:right;font-size:10.5px;font-weight:700;\">الاستحقاق</th>\n    <th style=\"padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;\">الإجمالي</th>\n    <th style=\"padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;\">المدفوع</th>\n    <th style=\"padding:9px 12px;text-align:left;font-size:10.5px;font-weight:700;\">المتبقي</th>\n    <th style=\"padding:9px 10px;text-align:center;font-size:10.5px;font-weight:700;\">الحالة</th>\n  </tr></thead>\n  <tbody>{31}</tbody>\n</table>\n\n{32}\n\n<div style=\"border:1.5px solid {33};border-radius:8px;overflow:hidden;margin-bottom:14px;\">\n  <div style=\"background:{34};padding:8px 14px;font-size:11px;font-weight:800;color:{35};border-bottom:1.5px solid {36};\">⏰ تقادم الذمم (Aging)</div>\n  <table style=\"width:100%;border-collapse:collapse;\">\n    <tr>{37}</tr>\n  </table>\n</div>\n\n<div style=\"display:flex;justify-content:flex-end;margin-bottom:14px;\">\n  <table style=\"min-width:270px;border-collapse:collapse;border:1.5px solid {38};border-radius:6px;overflow:hidden;\">\n    <tr style=\"border-bottom:1px solid {39};\"><td style=\"padding:8px 16px;color:#6b7280;font-size:12.5px;\">إجمالي المبيعات</td><td style=\"padding:8px 16px;text-align:left;font-size:12.5px;font-weight:600;direction:ltr;\">{40}</td></tr>\n    <tr style=\"border-bottom:1px solid {41};\"><td style=\"padding:8px 16px;color:#6b7280;font-size:12.5px;\">إجمالي المدفوع</td><td style=\"padding:8px 16px;text-align:left;font-size:12.5px;font-weight:700;color:#16a34a;direction:ltr;\">{42}</td></tr>\n    <tr style=\"background:{43};color:{44};\"><td style=\"padding:10px 16px;font-size:13.5px;font-weight:800;\">الرصيد النهائي</td><td style=\"padding:10px 16px;text-align:left;font-size:13.5px;font-weight:900;direction:ltr;\">{45}</td></tr>\n  </table>\n</div>\n\n<div style=\"padding-top:10px;border-top:1.5px solid {46};display:flex;justify-content:space-between;align-items:center;\">\n  <div style=\"font-size:9.5px;color:#9ca3af;font-weight:600;\">الشركة القابضة المتحدة ذ.م.م — United Holding Group LLC</div>\n  <div style=\"font-size:10.5px;font-weight:800;color:{47};\">{48} | {49}</div>\n</div>\n</div></body></html>",[client?.name || "",c.name,S.bar ? `<div style="height:7px;background:linear-gradient(90deg,${S.acc},${lightenHex(S.acc, .25)});border-radius:4px;margin-bottom:14px;"></div>` : "",S.acc,S.acc,c.name,c.nameAr,c.address,c.city,c.phone,c.email,S.acc,today,S.border,S.border,client.name || "—",client.phone || "",client.address ? `<div style="font-size:10.5px;color:#6b7280;margin-top:3px;">${client.address}</div>` : "",S.border,styleId === "modern" ? `${S.acc}0d` : "#f9fafb",fKWD(totBilled),live.length,invoices.length !== live.length ? " (" + invoices.length + tr(" شاملة الملغاة)") : "",styleId === "modern" ? `${S.acc}0d` : "#f9fafb",balance > 0 ? "#dc2626" : "#16a34a",fKWD(balance),fKWD(totPaid),S.border,S.thead,S.theadTx,styleId === "minimal" ? "border-bottom:2px solid #000;" : "",invRows || tr(`<tr><td colspan="7" style="padding:18px;text-align:center;color:#9ca3af;">لا توجد فواتير لهذا العميل</td></tr>`),allPays.length ? tr("\n<div style=\"margin-bottom:14px;\">\n<div style=\"font-size:11px;font-weight:800;color:#374151;margin-bottom:6px;letter-spacing:.5px;\">💳 سجل الدفعات ({0}) — إجمالي {1}</div>\n<table style=\"width:100%;border-collapse:collapse;border:1.5px solid {2};border-radius:6px;overflow:hidden;\">\n  <thead><tr style=\"background:{3};border-bottom:1.5px solid {4};\">\n    <th style=\"padding:7px 12px;text-align:right;font-size:10px;font-weight:800;color:{5};\">التاريخ</th>\n    <th style=\"padding:7px 12px;text-align:center;font-size:10px;font-weight:800;color:{6};\">الطريقة</th>\n    <th style=\"padding:7px 12px;text-align:center;font-size:10px;font-weight:800;color:{7};\">الفاتورة</th>\n    <th style=\"padding:7px 12px;text-align:left;font-size:10px;font-weight:800;color:{8};\">المبلغ</th>\n    <th style=\"padding:7px 12px;text-align:right;font-size:10px;font-weight:800;color:{9};\">ملاحظة</th>\n  </tr></thead>\n  <tbody>{10}</tbody>\n</table>\n</div>",[allPays.length,fKWD(allPays.reduce((s, p) => s + pN(p.amount), 0)),S.border,styleId === "modern" ? `${S.acc}12` : "#f3f4f6",S.border,styleId === "modern" ? S.acc : "#374151",styleId === "modern" ? S.acc : "#374151",styleId === "modern" ? S.acc : "#374151",styleId === "modern" ? S.acc : "#374151",styleId === "modern" ? S.acc : "#374151",payRows]) : "",S.border,styleId === "modern" ? `${S.acc}12` : "#f3f4f6",styleId === "modern" ? S.acc : "#374151",S.border,bucketCells,S.border,S.border,fKWD(totBilled),S.border,fKWD(totPaid),S.fill,S.fillTx,fKWD(balance),S.border,styleId === "modern" ? S.acc : "#374151",c.nameAr,c.phone]);
}
