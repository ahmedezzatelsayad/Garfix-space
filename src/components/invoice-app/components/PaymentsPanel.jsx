"use client";

import { useState, useEffect } from "react";
import { api } from "../api";
import { useTheme, txAdapt, softAdapt } from "../theme";

// ─── Payments panel (invoice detail) ──────────────────────────────
// Shows the payment history of one invoice and lets the user record
// new partial payments (cash / KNET / online / card). The backend keeps
// the invoice.paid field in sync with the sum of its payments.

const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN = s => parseFloat(toW(String(s || 0)).replace(/[^\d.]/g, "")) || 0;
const fKWD = n => pN(n).toFixed(3) + " KD";
const iT = inv => (inv.items || []).reduce((s, it) => s + pN(it.qty) * pN(it.price), 0) + pN(inv.shipping || 0);

const METHODS = [
  { id: "cash", label: "💵 نقدي", color: "#16a34a", bg: "#dcfce7" },
  { id: "knet", label: "🏦 كي نت", color: "#1d4ed8", bg: "#dbeafe" },
  { id: "online", label: "📱 تحويل", color: "#7c3aed", bg: "#ede9fe" },
  { id: "card", label: "💳 بطاقة", color: "#b45309", bg: "#fef3c7" },
];

export default function PaymentsPanel({ inv, company, onChanged, canEdit }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const col = company?.color || "#1e3a5f";
  const { dark } = useTheme();
  // theme-aware method colors (text lightened, pastel bg darkened in dark mode)
  const methodOf = id => {
    const m = METHODS.find(x => x.id === id) || METHODS[0];
    return { ...m, color: txAdapt(m.color, dark), bg: softAdapt(m.bg, dark) };
  };

  const remaining = Math.max(0, iT(inv) - pN(inv.paid || 0));
  const [form, setForm] = useState({ amount: "", method: "knet", date: new Date().toISOString().split("T")[0], note: "" });

  const load = async () => {
    if (!inv?.id) return;
    setLoading(true);
    try {
      const list = await api.listPayments(inv.id);
      setPayments(list || []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [inv?.id]);

  const open = () => {
    setForm({ amount: remaining ? String(+remaining.toFixed(3)) : "", method: "knet", date: new Date().toISOString().split("T")[0], note: "" });
    setErr("");
    setShowModal(true);
  };

  const save = async () => {
    const amount = pN(form.amount);
    if (!amount || amount <= 0) { setErr("أدخل مبلغاً صحيحاً أكبر من صفر"); return; }
    if (amount > remaining + 0.001) { setErr(`المبلغ يتجاوز المتبقي (${fKWD(remaining)})`); return; }
    setSaving(true); setErr("");
    try {
      await api.addPayment(inv.id, { amount, method: form.method, date: form.date, note: form.note });
      setShowModal(false);
      await load();
      onChanged?.();
    } catch {
      setErr("تعذّر حفظ الدفعة — تحقق من الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const del = async (p) => {
    if (!confirm(`حذف دفعة ${fKWD(p.amount)}؟ سيتم خصمها من المبلغ المدفوع`)) return;
    try {
      await api.deletePayment(p.id);
      await load();
      onChanged?.();
    } catch { /* toast handled upstream via refresh */ }
  };

  const totalPaidSum = payments.reduce((s, p) => s + pN(p.amount), 0);

  return (
    <div className="card" style={{ overflow: "hidden", marginTop: "12px", animation: "fadeUp .25s" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${col} 0%,${col}dd 100%)`, color: "#fff", padding: "12px 18px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "17px" }}>💳</span>
        <div style={{ fontWeight: 900, fontSize: "14px" }}>سجل الدفعات</div>
        <span style={{ background: "rgba(255,255,255,.18)", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 }}>
          {payments.length} دفعة • {fKWD(totalPaidSum)}
        </span>
        <div style={{ flex: 1 }} />
        {canEdit && remaining > 0 && (
          <button onClick={open} style={{ background: "#16a34a", border: "none", color: "#fff", borderRadius: "7px", padding: "6px 14px", fontFamily: "inherit", fontSize: "12px", fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
            + تسجيل دفعة
          </button>
        )}
        {canEdit && remaining <= 0 && payments.length > 0 && (
          <span style={{ fontSize: "11px", background: "rgba(255,255,255,.18)", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>✓ مدفوعة بالكامل</span>
        )}
      </div>

      {/* Progress bar */}
      {iT(inv) > 0 && (
        <div style={{ padding: "10px 18px 4px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ia-sub)", marginBottom: "4px", fontWeight: 700 }}>
            <span>المدفوع: {fKWD(pN(inv.paid || 0))}</span>
            <span>المتبقي: {fKWD(remaining)}</span>
          </div>
          <div style={{ height: "9px", background: "var(--ia-chip)", borderRadius: "5px", overflow: "hidden", display: "flex", direction: "rtl" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (pN(inv.paid || 0) / iT(inv)) * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#16a34a,#4ade80)", borderRadius: "5px", transition: "width .35s" }} />
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ padding: "8px 18px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "18px 0", fontSize: "13px" }}>⏳ جارٍ تحميل الدفعات...</div>
        ) : payments.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "18px 0", fontSize: "13px" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>🧾</div>
            لا توجد دفعات مسجّلة{remaining > 0 ? " — سجّل أول دفعة لهذه الفاتورة" : ""}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px", maxHeight: "300px", overflowY: "auto" }}>
            {payments.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((p, i) => {
              const m = methodOf(p.method);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--ia-row-alt)", border: "1px solid var(--ia-border3)", borderRadius: "9px", padding: "9px 12px" }}>
                  <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: m.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.label.split(" ")[0]}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 900, fontSize: "13.5px", color: "var(--ia-text)", direction: "ltr" }}>{fKWD(p.amount)}</span>
                      <span style={{ fontSize: "10.5px", background: m.bg, color: m.color, padding: "1px 8px", borderRadius: "20px", fontWeight: 800 }}>{m.label.replace(/^\S+\s/, "")}</span>
                      <span style={{ fontSize: "11px", color: "var(--ia-muted)", direction: "ltr" }}>{p.date}</span>
                    </div>
                    {p.note && <div style={{ fontSize: "11.5px", color: "var(--ia-sub)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📝 {p.note}</div>}
                  </div>
                  {canEdit && (
                    <button onClick={() => del(p)} title="حذف الدفعة" style={{ background: "transparent", border: "1px solid var(--ia-red-bd)", color: "var(--ia-red-tx)", borderRadius: "7px", padding: "4px 9px", fontFamily: "inherit", fontSize: "12px", cursor: "pointer", flexShrink: 0 }}>🗑️</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add-payment modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: "100%", maxWidth: "380px", padding: "22px 24px", animation: "fadeUp .2s" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px" }}>💳</span>
              <div style={{ fontWeight: 900, fontSize: "15px", color: col }}>تسجيل دفعة</div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", fontSize: "16px", cursor: "pointer", color: "var(--ia-muted)" }}>✕</button>
            </div>
            <div style={{ fontSize: "12px", color: "var(--ia-sub)", marginBottom: "16px" }}>
              فاتورة <b>{inv.invNum}</b> • المتبقي <b style={{ color: "var(--ia-red-tx)" }}>{fKWD(remaining)}</b>
            </div>

            <label style={{ fontSize: "11px", color: "var(--ia-sub)", display: "block", marginBottom: "4px", fontWeight: 700 }}>المبلغ (KD) *</label>
            <input className="inp" style={{ marginBottom: "12px", direction: "ltr", textAlign: "right", fontWeight: 800, fontSize: "15px" }} placeholder={remaining ? String(+remaining.toFixed(3)) : "0.000"} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />

            <label style={{ fontSize: "11px", color: "var(--ia-sub)", display: "block", marginBottom: "6px", fontWeight: 700 }}>طريقة الدفع</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "7px", marginBottom: "12px" }}>
              {METHODS.map(raw => {
                const m = methodOf(raw.id);
                const active = form.method === m.id;
                return (
                  <button key={m.id} onClick={() => setForm(f => ({ ...f, method: m.id }))} style={{
                    border: `1.5px solid ${active ? m.color : "var(--ia-border)"}`, background: active ? m.bg : "var(--ia-card)",
                    color: active ? m.color : "var(--ia-sub)", borderRadius: "9px", padding: "8px 6px",
                    fontFamily: "inherit", fontSize: "12px", fontWeight: 800, cursor: "pointer", transition: "all .15s",
                  }}>{m.label}</button>
                );
              })}
            </div>

            <div className="form-2col" style={{ marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--ia-sub)", display: "block", marginBottom: "4px", fontWeight: 700 }}>التاريخ</label>
                <input className="inp" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "var(--ia-sub)", display: "block", marginBottom: "4px", fontWeight: 700 }}>ملاحظة</label>
                <input className="inp" placeholder="اختياري" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>

            {err && <div style={{ background: "var(--ia-red-bg)", color: "var(--ia-red-tx)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, marginBottom: "10px" }}>⚠️ {err}</div>}

            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn" style={{ background: "#16a34a", color: "#fff", flex: 1, fontSize: "14px", padding: "10px" }} disabled={saving} onClick={save}>
                {saving ? "⏳ جارٍ الحفظ..." : "💾 حفظ الدفعة"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
