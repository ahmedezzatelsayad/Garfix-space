"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { useTheme, txAdapt, softAdapt } from "../theme";

const pN = v => parseFloat(String(v ?? 0).replace(/[^\d.]/g, "")) || 0;
const today = () => new Date().toISOString().split("T")[0];

const CONF_COLOR = (c, dark) =>
  txAdapt(c >= 0.85 ? "#16a34a" : c >= 0.65 ? "#d97706" : "#dc2626", dark);
const CONF_LABEL = c =>
  c >= 0.85 ? "عالية" : c >= 0.65 ? "متوسطة" : "منخفضة";
const CONF_BG = (c, dark) =>
  softAdapt(c >= 0.85 ? "#dcfce7" : c >= 0.65 ? "#fef3c7" : "#fee2e2", dark);

export default function AIBulkProcessor({ company, onPurchaseSaved }) {
  const col = company?.color || "#1e3a5f";
  const { dark } = useTheme();
  const [step, setStep] = useState(0); // 0=input, 1=processing, 2=review, 3=catalog, 4=done
  const [rawText, setRawText] = useState("");
  const [aiItems, setAiItems] = useState([]);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [purchaseForm, setPurchaseForm] = useState({ supplier: "", date: today(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", aliases: "", purchasePrice: "", sellingPrice: "" });
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState(null);
  const textRef = useRef(null);

  const toast_ = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const data = await api.getCatalog(company?.sk);
      setCatalog(data || []);
    } catch { setCatalog([]); }
    finally { setCatalogLoading(false); }
  }, [company]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // ── AI Processing ─────────────────────────────────────────────────
  const processWithAI = async () => {
    if (!rawText.trim()) return;
    setStep(1);
    setError("");
    try {
      const res = await fetch("/api/ai/process-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawText.trim(), catalog }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = (data.items || []).map((it, i) => ({
        ...it,
        _id: i,
        quantity: Number(it.quantity) || 1,
        confidence: Number(it.confidence) || 0.5,
        purchasePrice: it.purchasePrice ?? (
          catalog.find(c => c.id === it.catalogId)?.purchasePrice ?? ""
        ),
        edited: false,
      }));
      setAiItems(items);
      setStep(2);
    } catch (e) {
      setError(e.message || "حدث خطأ في المعالجة");
      setStep(0);
    }
  };

  // ── Merge duplicates by normalizedName ───────────────────────────
  const getMerged = () => {
    const map = new Map();
    for (const it of aiItems) {
      const key = it.normalizedName?.trim().toLowerCase() || it.rawText;
      if (map.has(key)) {
        const ex = map.get(key);
        map.set(key, { ...ex, quantity: ex.quantity + it.quantity });
      } else {
        map.set(key, { ...it });
      }
    }
    return Array.from(map.values());
  };

  // ── Save Purchase ─────────────────────────────────────────────────
  const savePurchase = async () => {
    setSaving(true);
    try {
      const merged = getMerged();
      const num = `PUR-AI-${Date.now().toString().slice(-6)}`;
      const totalQty = merged.reduce((s, it) => s + it.quantity, 0);
      const items = merged.map(it => ({
        name: it.normalizedName || it.rawText,
        qty: it.quantity,
        purchasePrice: it.purchasePrice ? String(it.purchasePrice) : "",
      }));
      const created = await api.createPurchaseInvoice({
        num,
        date: purchaseForm.date,
        supplier: purchaseForm.supplier,
        companySlug: company?.sk,
        items,
        sourceInvoiceIds: [],
        totalQty,
        notes: purchaseForm.notes || `AI processed: ${rawText.slice(0, 80)}`,
      });
      setStep(4);
      if (onPurchaseSaved) onPurchaseSaved(created);
    } catch (e) {
      toast_("❌ " + (e.message || "حدث خطأ أثناء الحفظ"));
    } finally { setSaving(false); }
  };

  // ── Catalog CRUD ─────────────────────────────────────────────────
  const addProduct = async () => {
    if (!newProduct.name.trim()) return;
    setAddingProduct(true);
    try {
      const aliases = newProduct.aliases.split(",").map(s => s.trim()).filter(Boolean);
      const created = await api.createCatalogProduct({
        name: newProduct.name.trim(),
        aliases,
        purchasePrice: newProduct.purchasePrice ? pN(newProduct.purchasePrice) : null,
        sellingPrice: newProduct.sellingPrice ? pN(newProduct.sellingPrice) : null,
        companySlug: company?.sk,
      });
      setCatalog(c => [...c, created]);
      setNewProduct({ name: "", aliases: "", purchasePrice: "", sellingPrice: "" });
      toast_("✅ تم إضافة المنتج للكتالوج");
    } catch (e) { toast_("❌ " + e.message); }
    finally { setAddingProduct(false); }
  };

  const deleteProduct = async (id) => {
    try {
      await api.deleteCatalogProduct(id);
      setCatalog(c => c.filter(x => x.id !== id));
      toast_("🗑️ تم الحذف");
    } catch { toast_("❌ فشل الحذف"); }
  };

  const updateCatalogItem = async (id, patch) => {
    try {
      const updated = await api.updateCatalogProduct(id, patch);
      setCatalog(c => c.map(x => x.id === id ? { ...x, ...updated } : x));
      setEditingCatalogId(null);
      toast_("✅ تم التحديث");
    } catch { toast_("❌ فشل التحديث"); }
  };

  // ── Edit AI item ──────────────────────────────────────────────────
  const editItem = (id, field, val) => {
    setAiItems(prev => prev.map(it =>
      it._id === id ? { ...it, [field]: val, edited: true } : it
    ));
  };

  const removeItem = id => setAiItems(prev => prev.filter(it => it._id !== id));

  // ── Styles ────────────────────────────────────────────────────────
  const s = {
    card: { background: "var(--ia-card)", borderRadius: "12px", border: "1px solid var(--ia-border)", boxShadow: "0 1px 4px rgba(0,0,0,.07)" },
    btn: (bg, c = "#fff") => ({ border: "none", borderRadius: "8px", padding: "9px 16px", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: bg, color: c, display: "inline-flex", alignItems: "center", gap: "5px" }),
    inp: { width: "100%", border: "1.5px solid var(--ia-border2)", borderRadius: "8px", padding: "8px 11px", fontFamily: "inherit", fontSize: "13px", outline: "none" },
    lbl: { fontSize: "11px", color: "var(--ia-sub)", fontWeight: 700, display: "block", marginBottom: "4px" },
    sec: { fontSize: "11px", fontWeight: 900, color: "var(--ia-sub)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" },
  };

  const merged = step === 2 ? getMerged() : [];

  return (
    <div style={{ fontFamily: "'Cairo','Tajawal',sans-serif", direction: "rtl" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 64, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: toast.startsWith("❌") ? "#dc2626" : "#16a34a", color: "#fff", padding: "8px 22px", borderRadius: "50px", fontWeight: 700, fontSize: "13px", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>{toast}</div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "17px", fontWeight: 900, color: col }}>🤖 معالجة AI للمشتريات</div>
        <div style={{ flex: 1 }} />
        <button style={s.btn("#7c3aed")} onClick={() => setStep(step === 3 ? 0 : 3)}>
          📦 {step === 3 ? "رجوع" : `كتالوج المنتجات (${catalog.length})`}
        </button>
      </div>

      {/* ══ STEP 0: Input ══════════════════════════════════════════════ */}
      {step === 0 && (
        <div style={{ ...s.card, padding: "20px" }}>
          <div style={s.sec}>أدخل قائمة المنتجات (عربي أو إنجليزي أو مختلط)</div>
          <div style={{ background: "var(--ia-soft)", border: "1px solid var(--ia-border)", borderRadius: "8px", padding: "11px 14px", marginBottom: "12px", fontSize: "12px", color: "var(--ia-sub)", lineHeight: "1.7" }}>
            <b style={{ color: "var(--ia-text2)" }}>أمثلة:</b> <span dir="ltr">3 m19 headphones, ٥ شواحن ايفون, 2 powerbank 20k, اربع سماعات JBL, cable type c × 10</span>
          </div>
          <textarea
            ref={textRef}
            style={{ ...s.inp, minHeight: "160px", resize: "vertical", marginBottom: "12px", fontSize: "13px", lineHeight: "1.8" }}
            placeholder={"3 m19 headphones\n٥ شواحن ايفون\n2 powerbank 20k\nاربع سماعات JBL\ncable type c × 10"}
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
          {error && (
            <div style={{ background: "var(--ia-red-bg)", border: "1px solid var(--ia-red-bd)", borderRadius: "8px", padding: "10px 14px", color: "var(--ia-red-tx)", fontSize: "13px", marginBottom: "12px" }}>
              ❌ {error}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button style={{ ...s.btn(col), flex: 1, justifyContent: "center", padding: "12px" }}
              onClick={processWithAI} disabled={!rawText.trim()}>
              🤖 معالجة بالذكاء الاصطناعي
            </button>
            {catalog.length === 0 && (
              <button style={s.btn("#7c3aed")} onClick={() => setStep(3)}>
                📦 أضف كتالوج المنتجات أولاً
              </button>
            )}
          </div>
          {catalog.length > 0 && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--ia-sub)" }}>
              🔍 سيتم المطابقة مع <b>{catalog.length}</b> منتج في الكتالوج
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 1: Processing ════════════════════════════════════════ */}
      {step === 1 && (
        <div style={{ ...s.card, padding: "56px", textAlign: "center" }}>
          <div style={{ fontSize: "44px", marginBottom: "14px", animation: "spin 1s linear infinite" }}>⚙️</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: col, marginBottom: "6px" }}>جارٍ المعالجة بالذكاء الاصطناعي...</div>
          <div style={{ color: "var(--ia-sub)", fontSize: "13px" }}>يتم تحليل النص واستخراج المنتجات وتطبيعها</div>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ══ STEP 2: Review & Edit ════════════════════════════════════ */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Summary */}
          <div style={{ ...s.card, padding: "14px 18px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <span style={{ fontSize: "12px", color: "var(--ia-sub)" }}>المنتجات المكتشفة</span>
              <div style={{ fontWeight: 900, fontSize: "22px", color: col }}>{aiItems.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--ia-sub)" }}>بعد الدمج</span>
              <div style={{ fontWeight: 900, fontSize: "22px", color: "var(--ia-vio-tx)" }}>{merged.length}</div>
            </div>
            <div>
              <span style={{ fontSize: "12px", color: "var(--ia-sub)" }}>إجمالي الكميات</span>
              <div style={{ fontWeight: 900, fontSize: "22px", color: "var(--ia-ok-tx)" }}>{merged.reduce((s, it) => s + it.quantity, 0)}</div>
            </div>
            <div style={{ flex: 1 }} />
            <button style={s.btn("var(--ia-ghost-bg)", "var(--ia-ghost-tx)")} onClick={() => { setStep(0); setAiItems([]); }}>← إعادة الإدخال</button>
          </div>

          {/* Individual AI Results */}
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 8px", borderBottom: "1px solid var(--ia-border3)" }}>
              <div style={s.sec}>نتائج الذكاء الاصطناعي — راجع وعدّل قبل الحفظ</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--ia-soft)" }}>
                    <th style={{ padding: "9px 12px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>النص الأصلي</th>
                    <th style={{ padding: "9px 12px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>الاسم المطبّع</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px", width: "80px" }}>الكمية</th>
                    <th style={{ padding: "9px 12px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px", width: "120px" }}>سعر الشراء KD</th>
                    <th style={{ padding: "9px 12px", textAlign: "center", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px", width: "90px" }}>الثقة</th>
                    <th style={{ padding: "9px 12px", width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {aiItems.map((it) => (
                    <tr key={it._id} style={{ borderBottom: "1px solid var(--ia-border3)", background: it.edited ? "var(--ia-warn-bg)" : "var(--ia-card)" }}>
                      <td style={{ padding: "8px 12px", color: "var(--ia-muted)", fontSize: "12px", maxWidth: "140px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.rawText}</div>
                        {it.catalogName && (
                          <div style={{ color: "var(--ia-vio-tx)", fontSize: "11px", marginTop: "2px" }}>🔗 {it.catalogName}</div>
                        )}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          style={{ ...s.inp, padding: "5px 8px", fontWeight: 700 }}
                          value={it.normalizedName}
                          onChange={e => editItem(it._id, "normalizedName", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        <input
                          style={{ ...s.inp, padding: "5px 8px", textAlign: "center", fontWeight: 900, width: "64px" }}
                          type="number" min="1" value={it.quantity}
                          onChange={e => editItem(it._id, "quantity", Number(e.target.value) || 1)}
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          style={{ ...s.inp, padding: "5px 8px", width: "100px" }}
                          type="number" step="0.001" min="0" placeholder="0.000"
                          value={it.purchasePrice ?? ""}
                          onChange={e => editItem(it._id, "purchasePrice", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                          <span style={{ background: CONF_BG(it.confidence, dark), color: CONF_COLOR(it.confidence, dark), borderRadius: "20px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>
                            {CONF_LABEL(it.confidence)}
                          </span>
                          <span style={{ color: "var(--ia-muted)", fontSize: "10px" }}>{Math.round(it.confidence * 100)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <button onClick={() => removeItem(it._id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ia-red-tx)", fontSize: "16px", padding: "2px" }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Merged Preview */}
          {merged.length > 0 && (
            <div style={{ ...s.card, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px 8px", borderBottom: "1px solid var(--ia-border3)" }}>
                <div style={s.sec}>📦 المنتجات المدمجة — هذا ما سيُحفظ في فاتورة المشتريات</div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: col + "15" }}>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: col, fontWeight: 700 }}>المنتج</th>
                    <th style={{ padding: "8px 14px", textAlign: "center", color: col, fontWeight: 700 }}>الكمية الكلية</th>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: col, fontWeight: 700 }}>سعر الشراء</th>
                    <th style={{ padding: "8px 14px", textAlign: "right", color: col, fontWeight: 700 }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {merged.map((it, i) => {
                    const price = pN(it.purchasePrice);
                    const total = price * it.quantity;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--ia-border3)", background: i % 2 === 0 ? "var(--ia-card)" : "var(--ia-row-alt)" }}>
                        <td style={{ padding: "9px 14px", fontWeight: 700 }}>{it.normalizedName}</td>
                        <td style={{ padding: "9px 14px", textAlign: "center", fontWeight: 900, fontSize: "16px", color: col }}>{it.quantity}</td>
                        <td style={{ padding: "9px 14px", color: price ? "#dc2626" : "#9ca3af" }}>{price ? `${price.toFixed(3)} KD` : "—"}</td>
                        <td style={{ padding: "9px 14px", fontWeight: 700 }}>{total ? `${total.toFixed(3)} KD` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {merged.reduce((s, it) => s + pN(it.purchasePrice) * it.quantity, 0) > 0 && (
                  <tfoot>
                    <tr style={{ background: col + "20" }}>
                      <td colSpan={3} style={{ padding: "10px 14px", fontWeight: 900, color: col }}>الإجمالي الكلي</td>
                      <td style={{ padding: "10px 14px", fontWeight: 900, color: "var(--ia-red-tx)", fontSize: "14px" }}>
                        {merged.reduce((s, it) => s + pN(it.purchasePrice) * it.quantity, 0).toFixed(3)} KD
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Purchase form */}
          <div style={{ ...s.card, padding: "16px 18px" }}>
            <div style={s.sec}>بيانات فاتورة المشتريات</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={s.lbl}>اسم المورد</label>
                <input style={s.inp} placeholder="اختياري" value={purchaseForm.supplier}
                  onChange={e => setPurchaseForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
              <div>
                <label style={s.lbl}>التاريخ</label>
                <input style={s.inp} type="date" value={purchaseForm.date}
                  onChange={e => setPurchaseForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={s.lbl}>ملاحظات</label>
              <input style={s.inp} placeholder="اختياري" value={purchaseForm.notes}
                onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ ...s.btn("#7c3aed"), flex: 1, justifyContent: "center", padding: "12px", fontSize: "14px" }}
                onClick={savePurchase} disabled={saving || !merged.length}>
                {saving ? "جارٍ الحفظ..." : `💾 حفظ فاتورة المشتريات (${merged.length} منتج)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 3: Catalog Manager ═══════════════════════════════════ */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Add product */}
          <div style={{ ...s.card, padding: "16px 18px" }}>
            <div style={s.sec}>➕ إضافة منتج جديد للكتالوج</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={s.lbl}>اسم المنتج *</label>
                <input style={s.inp} placeholder="مثال: سماعة JBL" value={newProduct.name}
                  onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={s.lbl}>أسماء بديلة (مفصولة بفاصلة)</label>
                <input style={s.inp} placeholder="jbl, سماعات, headphone jbl" value={newProduct.aliases}
                  onChange={e => setNewProduct(p => ({ ...p, aliases: e.target.value }))} />
              </div>
              <div>
                <label style={s.lbl}>سعر الشراء KD</label>
                <input style={s.inp} type="number" step="0.001" min="0" placeholder="0.000" value={newProduct.purchasePrice}
                  onChange={e => setNewProduct(p => ({ ...p, purchasePrice: e.target.value }))} />
              </div>
              <div>
                <label style={s.lbl}>سعر البيع KD</label>
                <input style={s.inp} type="number" step="0.001" min="0" placeholder="0.000" value={newProduct.sellingPrice}
                  onChange={e => setNewProduct(p => ({ ...p, sellingPrice: e.target.value }))} />
              </div>
            </div>
            <button style={s.btn(col)} onClick={addProduct} disabled={addingProduct || !newProduct.name.trim()}>
              {addingProduct ? "جارٍ الإضافة..." : "➕ إضافة للكتالوج"}
            </button>
          </div>

          {/* Catalog list */}
          <div style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px 8px", borderBottom: "1px solid var(--ia-border3)", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={s.sec}>قائمة المنتجات في الكتالوج</div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: "12px", color: "var(--ia-sub)" }}>{catalog.length} منتج</span>
            </div>
            {catalogLoading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--ia-muted)" }}>⏳ جارٍ التحميل...</div>
            ) : catalog.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--ia-muted)" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>📦</div>
                <div>الكتالوج فارغ — أضف منتجاتك أعلاه</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--ia-soft)" }}>
                      <th style={{ padding: "9px 14px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>الاسم</th>
                      <th style={{ padding: "9px 14px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>الأسماء البديلة</th>
                      <th style={{ padding: "9px 14px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>الشراء KD</th>
                      <th style={{ padding: "9px 14px", textAlign: "right", color: "var(--ia-sub)", fontWeight: 700, fontSize: "11px" }}>البيع KD</th>
                      <th style={{ padding: "9px 14px", width: "80px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map((prod, i) => (
                      <CatalogRow key={prod.id} prod={prod} i={i} s={s} col={col}
                        onDelete={deleteProduct} onUpdate={updateCatalogItem}
                        editing={editingCatalogId === prod.id}
                        onEdit={() => setEditingCatalogId(prod.id)}
                        onCancelEdit={() => setEditingCatalogId(null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <button style={s.btn("var(--ia-ghost-bg)", "var(--ia-ghost-tx)")} onClick={() => setStep(0)}>← رجوع للإدخال</button>
        </div>
      )}

      {/* ══ STEP 4: Done ═════════════════════════════════════════════ */}
      {step === 4 && (
        <div style={{ ...s.card, padding: "56px", textAlign: "center" }}>
          <div style={{ fontSize: "52px", marginBottom: "12px" }}>✅</div>
          <div style={{ fontSize: "17px", fontWeight: 900, marginBottom: "8px", color: "var(--ia-ok-tx)" }}>تم حفظ فاتورة المشتريات!</div>
          <div style={{ color: "var(--ia-sub)", fontSize: "13px", marginBottom: "24px" }}>
            {merged.length} منتج · {merged.reduce((s, it) => s + it.quantity, 0)} قطعة إجمالية
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
            <button style={s.btn(col)} onClick={() => { setStep(0); setRawText(""); setAiItems([]); }}>
              🤖 إدخال جديد
            </button>
            <button style={s.btn("#7c3aed")} onClick={() => { setStep(3); }}>
              📦 إدارة الكتالوج
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogRow({ prod, i, s, col, onDelete, onUpdate, editing, onEdit, onCancelEdit }) {
  const [form, setForm] = useState({
    name: prod.name,
    aliases: Array.isArray(prod.aliases) ? prod.aliases.join(", ") : "",
    purchasePrice: prod.purchasePrice ?? "",
    sellingPrice: prod.sellingPrice ?? "",
  });

  const save = () => {
    const aliases = form.aliases.split(",").map(x => x.trim()).filter(Boolean);
    onUpdate(prod.id, {
      name: form.name.trim(),
      aliases,
      purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
      sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : null,
    });
  };

  if (editing) {
    return (
      <tr style={{ borderBottom: "1px solid var(--ia-border)", background: "var(--ia-warn-bg)" }}>
        <td style={{ padding: "6px 10px" }}><input style={{ ...s.inp, padding: "5px 8px" }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></td>
        <td style={{ padding: "6px 10px" }}><input style={{ ...s.inp, padding: "5px 8px", fontSize: "12px" }} placeholder="alias1, alias2" value={form.aliases} onChange={e => setForm(f => ({ ...f, aliases: e.target.value }))} /></td>
        <td style={{ padding: "6px 10px" }}><input style={{ ...s.inp, padding: "5px 8px", width: "90px" }} type="number" step="0.001" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))} /></td>
        <td style={{ padding: "6px 10px" }}><input style={{ ...s.inp, padding: "5px 8px", width: "90px" }} type="number" step="0.001" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} /></td>
        <td style={{ padding: "6px 8px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={save} style={{ background: col, color: "#fff", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>✓</button>
            <button onClick={onCancelEdit} style={{ background: "var(--ia-ghost-bg)", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>✕</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: "1px solid var(--ia-border3)", background: i % 2 === 0 ? "var(--ia-card)" : "var(--ia-row-alt)" }}>
      <td style={{ padding: "9px 14px", fontWeight: 700 }}>{prod.name}</td>
      <td style={{ padding: "9px 14px", fontSize: "12px", color: "var(--ia-sub)" }}>
        {Array.isArray(prod.aliases) && prod.aliases.length > 0 ? prod.aliases.join("، ") : "—"}
      </td>
      <td style={{ padding: "9px 14px", color: prod.purchasePrice ? "#dc2626" : "#9ca3af", fontWeight: prod.purchasePrice ? 700 : 400 }}>
        {prod.purchasePrice ? `${parseFloat(prod.purchasePrice).toFixed(3)} KD` : "—"}
      </td>
      <td style={{ padding: "9px 14px", color: prod.sellingPrice ? "#16a34a" : "#9ca3af", fontWeight: prod.sellingPrice ? 700 : 400 }}>
        {prod.sellingPrice ? `${parseFloat(prod.sellingPrice).toFixed(3)} KD` : "—"}
      </td>
      <td style={{ padding: "9px 8px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={onEdit} style={{ background: "var(--ia-warn-bg)", color: "var(--ia-warn-tx2)", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>✏️</button>
          <button onClick={() => onDelete(prod.id)} style={{ background: "var(--ia-red-bg)", color: "var(--ia-red-tx)", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
        </div>
      </td>
    </tr>
  );
}
