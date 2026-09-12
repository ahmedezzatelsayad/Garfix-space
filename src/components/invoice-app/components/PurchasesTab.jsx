"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

const today = () => new Date().toISOString().split("T")[0];
const fDate = s => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const pN = v => parseFloat(String(v || 0).replace(/[^\d.]/g, "")) || 0;

function mergeItems(salesInvoices) {
  const map = new Map();
  for (const inv of salesInvoices) {
    for (const it of (inv.items || [])) {
      const key = (it.name || "").trim().toLowerCase();
      if (!key) continue;
      if (map.has(key)) {
        map.get(key).qty += Number(it.qty) || 1;
      } else {
        map.set(key, { name: (it.name || "").trim(), qty: Number(it.qty) || 1, purchasePrice: "" });
      }
    }
  }
  return Array.from(map.values());
}

function printPurchaseInvoice(pi, company) {
  const col = company?.color || "#1e3a5f";
  const totalQty = pi.items?.reduce((s, r) => s + (r.qty || 0), 0) || 0;
  const rows = (pi.items || []).map((r, i) => `
    <tr>
      <td style="padding:10px 14px;text-align:right;color:#9ca3af;">${i + 1}</td>
      <td style="padding:10px 14px;font-weight:700;">${r.name}</td>
      <td style="padding:10px 14px;text-align:center;font-weight:900;font-size:16px;color:${col};">${r.qty}</td>
      ${r.purchasePrice ? `<td style="padding:10px 14px;text-align:right;color:#dc2626;font-weight:600;">${pN(r.purchasePrice).toFixed(3)} KD</td>
      <td style="padding:10px 14px;text-align:right;font-weight:700;">${(r.qty * pN(r.purchasePrice)).toFixed(3)} KD</td>` : `<td colspan="2"></td>`}
    </tr>`).join("");
  const totalCost = (pi.items || []).reduce((s, r) => s + r.qty * pN(r.purchasePrice || 0), 0);
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>فاتورة مشتريات ${pi.num}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',sans-serif;background:#fff;color:#111;padding:28px;font-size:13px}
.hdr{text-align:center;margin-bottom:24px;border-bottom:3px solid ${col};padding-bottom:16px}
.hdr h1{font-size:22px;font-weight:900;color:${col};margin-bottom:4px}
.meta{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.meta span{background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:5px 12px;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:${col};color:#fff}
th{padding:11px 14px;text-align:right;font-weight:700;font-size:13px}
tbody tr{border-bottom:1px solid #f0f0f0}
tbody tr:nth-child(even){background:#f9fafb}
tfoot tr{background:${col}22;font-weight:900}
tfoot td{padding:12px 14px;font-size:14px}
.footer{text-align:center;font-size:11px;color:#9ca3af;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px}
@media print{@page{margin:14mm}body{padding:0}}
</style></head><body>
<div class="hdr">
  <h1>📦 فاتورة مشتريات</h1>
  <div style="color:#555;font-size:13px">${company?.nameAr || ""}</div>
</div>
<div class="meta">
  <span>🔢 رقم: <b>${pi.num}</b></span>
  <span>📅 التاريخ: <b>${fDate(pi.date)}</b></span>
  ${pi.supplier ? `<span>🏭 المورد: <b>${pi.supplier}</b></span>` : ""}
  <span>📦 ${(pi.items || []).length} منتج</span>
  <span>🔢 ${totalQty} قطعة إجمالية</span>
</div>
<table>
  <thead><tr>
    <th style="width:44px">#</th>
    <th>اسم المنتج</th>
    <th style="text-align:center">الكمية الإجمالية</th>
    <th>سعر الشراء (KD)</th>
    <th>إجمالي الشراء (KD)</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td colspan="2" style="font-weight:900">المجموع الكلي</td>
    <td style="text-align:center;font-size:16px;color:${col};font-weight:900">${totalQty}</td>
    <td></td>
    ${totalCost > 0 ? `<td style="color:#dc2626">${totalCost.toFixed(3)} KD</td>` : "<td></td>"}
  </tr></tfoot>
</table>
${pi.notes ? `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#555"><b>ملاحظات:</b> ${pi.notes}</div>` : ""}
<div class="footer">تم الإنشاء: ${new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" })} | نظام المشتريات المتكامل</div>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { alert("يرجى السماح بالـ Popups في المتصفح"); return; }
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

export default function PurchasesTab({ company, invoices = [], preSelectIds = [], onClearPreSelect }) {
  const col = company?.color || "#1e3a5f";
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandId, setExpandId] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const [selIds, setSelIds] = useState([]);
  const [merged, setMerged] = useState([]);
  const [mForm, setMForm] = useState({ supplier: "", date: today(), notes: "" });

  const toast_ = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const loadPurchases = useCallback(async () => {
    if (!company) return;
    try {
      const data = await api.listPurchaseInvoices(company.sk);
      setPurchases(data || []);
    } catch { setPurchases([]); }
    finally { setLoading(false); }
  }, [company]);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);

  useEffect(() => {
    if (preSelectIds && preSelectIds.length > 0) {
      const ids = preSelectIds.map(id => String(id));
      setSelIds(ids);
      const selected = invoices.filter(inv => ids.includes(String(inv.id)));
      setMerged(mergeItems(selected));
      setMForm({ supplier: "", date: today(), notes: "" });
      setShowModal(true);
      if (onClearPreSelect) onClearPreSelect();
    }
  }, [preSelectIds]);

  const toggleSel = id => {
    const sid = String(id);
    const next = selIds.includes(sid) ? selIds.filter(x => x !== sid) : [...selIds, sid];
    setSelIds(next);
    const selected = invoices.filter(inv => next.includes(String(inv.id)));
    setMerged(mergeItems(selected));
  };
  const toggleAll = () => {
    const allIds = filtered.map(inv => String(inv.id));
    const next = selIds.length === allIds.length ? [] : allIds;
    setSelIds(next);
    const selected = invoices.filter(inv => next.includes(String(inv.id)));
    setMerged(mergeItems(selected));
  };

  const savePurchase = async () => {
    if (!selIds.length) { toast_("⚠️ اختر فاتورة واحدة على الأقل"); return; }
    if (!merged.length) { toast_("⚠️ لا توجد منتجات في الفواتير المحددة"); return; }
    const num = `PUR${String(purchases.length + 1).padStart(4, "0")}`;
    const totalQty = merged.reduce((s, r) => s + r.qty, 0);
    try {
      const created = await api.createPurchaseInvoice({
        num,
        date: mForm.date,
        supplier: mForm.supplier,
        companySlug: company?.sk,
        items: merged,
        sourceInvoiceIds: selIds,
        totalQty,
        notes: mForm.notes,
      });
      setPurchases(p => [created, ...p]);
      setShowModal(false);
      setSelIds([]);
      setMerged([]);
      toast_(`✅ تم إنشاء فاتورة المشتريات ${num}`);
    } catch (e) {
      toast_("❌ حدث خطأ أثناء الحفظ");
    }
  };

  const deletePurchase = async (id) => {
    try {
      await api.deletePurchaseInvoice(id);
      setPurchases(p => p.filter(x => x.id !== id));
      setConfirmDel(null);
      toast_("🗑️ تم الحذف");
    } catch { toast_("❌ حدث خطأ أثناء الحذف"); }
  };

  const btn = (bg, c = "#fff") => ({
    border: "none", borderRadius: "8px", padding: "8px 14px",
    fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
    cursor: "pointer", background: bg, color: c,
    display: "inline-flex", alignItems: "center", gap: "5px",
  });
  const card = { background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,.08)", border: "1px solid #e5e7eb" };
  const inp = { width: "100%", border: "1.5px solid #d1d5db", borderRadius: "8px", padding: "9px 12px", fontFamily: "inherit", fontSize: "13px", background: "#fff", outline: "none" };
  const lbl = { fontSize: "11px", color: "#6b7280", fontWeight: 700, display: "block", marginBottom: "5px" };

  const filteredInvs = invoices.filter(inv => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (inv.invNum || "").toLowerCase().includes(s) || (inv.clientName || "").toLowerCase().includes(s);
  });
  const filtered = filteredInvs;
  const allSel = filtered.length > 0 && filtered.every(inv => selIds.includes(String(inv.id)));

  return (
    <div style={{ fontFamily: "'Cairo','Tajawal',sans-serif", direction: "rtl" }}>
      {toast && (
        <div style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: toast.startsWith("❌") ? "#dc2626" : toast.startsWith("⚠️") ? "#f59e0b" : "#16a34a", color: "#fff", padding: "8px 22px", borderRadius: "50px", fontWeight: 700, fontSize: "13px", boxShadow: "0 4px 16px rgba(0,0,0,.2)", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: col }}>🛒 فواتير المشتريات</h1>
        <div style={{ flex: 1 }} />
        <button style={btn(col)} onClick={() => { setSelIds([]); setMerged([]); setMForm({ supplier: "", date: today(), notes: "" }); setShowModal(true); }}>
          ➕ إنشاء فاتورة مشتريات
        </button>
      </div>

      {/* History */}
      {loading ? (
        <div style={{ ...card, padding: "40px", textAlign: "center", color: "#9ca3af" }}>⏳ جارٍ التحميل...</div>
      ) : purchases.length === 0 ? (
        <div style={{ ...card, padding: "56px", textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: "44px", marginBottom: "10px" }}>🛒</div>
          <div style={{ fontWeight: 600, marginBottom: "14px" }}>لا توجد فواتير مشتريات بعد</div>
          <button style={btn(col)} onClick={() => { setSelIds([]); setMerged([]); setMForm({ supplier: "", date: today(), notes: "" }); setShowModal(true); }}>
            ➕ أنشئ أول فاتورة مشتريات
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {purchases.map(pi => {
            const totalQty = (pi.items || []).reduce((s, r) => s + (r.qty || 0), 0);
            const expanded = expandId === pi.id;
            return (
              <div key={pi.id} style={{ ...card, overflow: "hidden" }}>
                <div style={{ padding: "13px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}
                  onClick={() => setExpandId(expanded ? null : pi.id)}>
                  <span style={{ background: `${col}15`, color: col, borderRadius: "20px", padding: "2px 10px", fontSize: "12px", fontWeight: 700 }}>{pi.num}</span>
                  <span style={{ fontWeight: 700 }}>{fDate(pi.date)}</span>
                  {pi.supplier && <span style={{ color: "#555", fontSize: "13px" }}>🏭 {pi.supplier}</span>}
                  <span style={{ color: "#6b7280", fontSize: "12px" }}>{(pi.items || []).length} منتج · {totalQty} قطعة</span>
                  {pi.notes && <span style={{ color: "#9ca3af", fontSize: "12px" }}>• {pi.notes}</span>}
                  <div style={{ flex: 1 }} />
                  <button style={{ ...btn(col), padding: "5px 10px", fontSize: "12px" }}
                    onClick={e => { e.stopPropagation(); printPurchaseInvoice(pi, company); }}>🖨️ طباعة</button>
                  <button style={{ ...btn("#dc2626"), padding: "5px 10px", fontSize: "12px" }}
                    onClick={e => { e.stopPropagation(); setConfirmDel(pi); }}>🗑️</button>
                  <span style={{ color: "#9ca3af", fontSize: "12px" }}>{expanded ? "▲" : "▼"}</span>
                </div>
                {expanded && (
                  <div style={{ borderTop: "1px solid #f0f0f0", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", fontWeight: 700 }}>#</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", fontWeight: 700 }}>اسم المنتج</th>
                          <th style={{ padding: "8px 14px", textAlign: "center", color: "#6b7280", fontWeight: 700 }}>الكمية</th>
                          <th style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280", fontWeight: 700 }}>سعر الشراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pi.items || []).map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                            <td style={{ padding: "9px 14px", color: "#9ca3af" }}>{i + 1}</td>
                            <td style={{ padding: "9px 14px", fontWeight: 700 }}>{r.name}</td>
                            <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 900, fontSize: "15px", color: col }}>{r.qty}</td>
                            <td style={{ padding: "9px 14px", color: r.purchasePrice ? "#dc2626" : "#9ca3af" }}>
                              {r.purchasePrice ? `${pN(r.purchasePrice).toFixed(3)} KD` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={() => setConfirmDel(null)}>
          <div style={{ ...card, width: "100%", maxWidth: "320px", padding: "28px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "38px", marginBottom: "8px" }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>تأكيد الحذف</div>
            <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: "18px" }}>سيتم حذف فاتورة المشتريات <b>{confirmDel.num}</b></div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button style={btn("#dc2626")} onClick={() => deletePurchase(confirmDel.id)}>نعم، احذف</button>
              <button style={btn("#e5e7eb", "#374151")} onClick={() => setConfirmDel(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 2000, display: "flex", alignItems: "stretch", justifyContent: "center", padding: "0" }}
          onClick={() => setShowModal(false)}>
          <div style={{ width: "100%", maxWidth: "680px", margin: "auto", background: "#fff", borderRadius: "16px", display: "flex", flexDirection: "column", maxHeight: "94vh", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ fontSize: "16px", fontWeight: 900, color: col }}>🛒 إنشاء فاتورة مشتريات</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>

            <div style={{ overflow: "auto", flex: 1, padding: "16px 20px" }}>

              {/* Step 1 – Invoice selection */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>
                  اختر الفواتير ({selIds.length} محدد)
                </div>
                <input style={{ ...inp, marginBottom: "8px" }} placeholder="🔍 ابحث بالاسم أو رقم الفاتورة..." value={search} onChange={e => setSearch(e.target.value)} />
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>لا توجد فواتير</div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                          <th style={{ width: "34px", padding: "7px 10px" }}>
                            <input type="checkbox" checked={allSel} onChange={toggleAll} style={{ cursor: "pointer", accentColor: col }} />
                          </th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#6b7280", fontSize: "11px" }}>الرقم</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#6b7280", fontSize: "11px" }}>العميل</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#6b7280", fontSize: "11px" }}>التاريخ</th>
                          <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#6b7280", fontSize: "11px" }}>المنتجات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(inv => {
                          const isSel = selIds.includes(String(inv.id));
                          return (
                            <tr key={inv.id} onClick={() => toggleSel(inv.id)}
                              style={{ cursor: "pointer", background: isSel ? `${col}0a` : "", borderBottom: "1px solid #f0f0f0" }}>
                              <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                <input type="checkbox" checked={isSel} onChange={() => {}} style={{ cursor: "pointer", accentColor: col }} />
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: "20px", padding: "1px 7px", fontSize: "11px", fontWeight: 700 }}>{inv.invNum}</span>
                              </td>
                              <td style={{ padding: "7px 10px", fontWeight: 600, fontSize: "12px" }}>{inv.clientName}</td>
                              <td style={{ padding: "7px 10px", color: "#6b7280", fontSize: "11px" }}>{fDate(inv.date)}</td>
                              <td style={{ padding: "7px 10px", color: "#555", fontSize: "11px" }}>
                                {(inv.items || []).slice(0, 2).map(it => it.name).join("، ")}
                                {(inv.items || []).length > 2 && ` +${(inv.items || []).length - 2}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Merged Products Preview */}
              {merged.length > 0 && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 900, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>
                    المنتجات المدمجة ({merged.length} منتج · {merged.reduce((s, r) => s + r.qty, 0)} قطعة)
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: col, color: "#fff" }}>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>اسم المنتج</th>
                          <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>الكمية الإجمالية</th>
                          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>سعر الشراء (KD) — اختياري</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merged.map((r, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 700 }}>{r.name}</td>
                            <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 900, fontSize: "15px", color: col }}>{r.qty}</td>
                            <td style={{ padding: "6px 12px" }}>
                              <input
                                style={{ ...inp, padding: "5px 8px", width: "110px" }}
                                type="number" step="0.001" min="0" placeholder="0.000"
                                value={r.purchasePrice}
                                onChange={e => setMerged(m => m.map((x, j) => j === i ? { ...x, purchasePrice: e.target.value } : x))}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Supplier / Date / Notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={lbl}>اسم المورد</label>
                  <input style={inp} placeholder="اسم المورد (اختياري)" value={mForm.supplier} onChange={e => setMForm(f => ({ ...f, supplier: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>تاريخ فاتورة المشتريات</label>
                  <input style={inp} type="date" value={mForm.date} onChange={e => setMForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: "4px" }}>
                <label style={lbl}>ملاحظات</label>
                <input style={inp} placeholder="ملاحظات (اختياري)" value={mForm.notes} onChange={e => setMForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "10px" }}>
              <button style={{ ...btn(col), flex: 1, justifyContent: "center", padding: "11px", fontSize: "14px" }} onClick={savePurchase}
                disabled={!selIds.length || !merged.length}>
                💾 حفظ فاتورة المشتريات
              </button>
              <button style={{ ...btn("#e5e7eb", "#374151"), padding: "11px 16px" }} onClick={() => setShowModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
