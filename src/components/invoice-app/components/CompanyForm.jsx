"use client";
/**
 * r12: مودال إضافة/تعديل بيانات شركة — للمدير فقط.
 * create: نموذج فارغ → POST /api/companies
 * edit:   prefilled من كائن الشركة الحالية → PUT /api/companies/[slug]
 * يشمل منتقي العملة (Company.currency) وهو مرتبط مباشرة بمطلوب «العملة من الإعدادات»:
 * كل تنسيقات المبالغ في التطبيق (fKWD → fmtMoney) تتبع عملة الشركة النشطة.
 */
import { useState, useMemo } from "react";
import { api } from "../api";
import { CURRENCIES } from "../currency";
import { txAdapt } from "../theme";

const EMOJI_CHOICES = ["🛒","🏪","⚡","♾️","🏢","🏬","🧺","📱","💻","👗","🍳","🚗","💎","🎁","🥇","🌿"];

export default function CompanyForm({ mode, company, onClose, onSaved, toast }) {
  const isNew = mode === "create";
  const [form, setForm] = useState(() => ({
    name: company?.name || "",
    nameAr: company?.nameAr || "",
    phone: company?.phone || "",
    email: company?.email || "",
    address: company?.address || "",
    city: company?.city || "",
    sellerRef: company?.sellerRef || "",
    manager: company?.manager || "",
    managerPhone: company?.managerPhone || "",
    color: company?.color || "#334155",
    accent: company?.accent || "#64748b",
    cardBg: company?.cardBg || "#f1f5f9",
    emoji: company?.emoji || "🏢",
    currency: company?.currency || "KWD",
    code: company?.code && company?.code !== company?.slug ? company?.code : "",
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const cur = CURRENCIES[form.currency] || CURRENCIES.KWD;
  const preview = useMemo(
    () => ({ ...form, id: company?.id || "preview", logo: form.emoji, sk: company?.sk || "" }),
    [form, company],
  );

  const save = async () => {
    setErr("");
    if (!form.name.trim()) { setErr("اسم الشركة (الإنجليزي) مطلوب"); return; }
    if (!form.nameAr.trim()) { setErr("الاسم العربي مطلوب"); return; }
    setBusy(true);
    try {
      if (isNew) {
        await api.createCompany(form);
      } else {
        const { code, ...rest } = form; // code غير قابل للتعديل بعد الإنشاء
        await api.updateCompany(company.sk, rest);
      }
      setDone(true);
      toast?.(isNew ? "✅ تمت إضافة الشركة بنجاح" : "✅ تم حفظ بيانات الشركة");
      setTimeout(() => onSaved?.(), 700);
    } catch (e) {
      setErr(e?.message || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const inp = {
    className: "inp", dir: "auto",
    style: { width: "100%", fontFamily: "inherit" },
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--ia-overlay)", zIndex: 2600, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", direction: "rtl" }}
      onClick={busy ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ia-card)", border: "1px solid var(--ia-bd)", borderRadius: "18px",
          width: "min(720px, 96vw)", maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 30px 80px rgba(0,0,0,.35)", animation: "fadeUp .25s ease",
          fontFamily: "'Cairo','Tajawal',sans-serif",
        }}
      >
        {/* ── الهيدر ── */}
        <div style={{
          background: `linear-gradient(135deg, ${form.color} 0%, ${form.accent} 100%)`,
          padding: "18px 22px", borderRadius: "18px 18px 0 0", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 85% -20%, rgba(255,255,255,.25), transparent 55%)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "14px", position: "relative" }}>
            <div style={{ fontSize: "34px", lineHeight: 1 }}>{form.emoji || "🏢"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "17px", fontWeight: 900, color: "#fff" }}>
                {isNew ? "➕ إضافة شركة جديدة" : "✏️ تعديل بيانات الشركة"}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,.75)", marginTop: "2px" }}>
                {form.nameAr || "اسم الشركة العربي"} {cur.flag} {cur.code}
              </div>
            </div>
            <button onClick={busy ? undefined : onClose} disabled={busy}
              style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)", borderRadius: "8px", color: "#fff", padding: "6px 12px", cursor: busy ? "default" : "pointer", fontFamily: "inherit", fontSize: "13px" }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {done ? (
            <div style={{ textAlign: "center", padding: "38px 10px" }}>
              <div style={{ fontSize: "46px", marginBottom: "10px" }}>✅</div>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--ia-ok-tx)" }}>
                {isNew ? "تمت إضافة الشركة — ستظهر في شاشة الاختيار" : "تم حفظ البيانات وتحديثها في كل مكان"}
              </div>
            </div>
          ) : (
          <>
          {/* ── معاينة حيّة (شكل البطاقة في شاشة الاختيار) ── */}
          <div style={{
            border: "1px dashed var(--ia-bd)", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px",
            display: "flex", alignItems: "center", gap: "12px", background: "var(--ia-hover, rgba(0,0,0,.02))",
          }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: `${form.color}1a`, border: `1px solid ${form.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{form.emoji || "🏢"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 900, color: "var(--ia-text)" }}>{form.nameAr || "الاسم العربي…"}</div>
              <div style={{ fontSize: "11px", color: "var(--ia-sub)", direction: "ltr", textAlign: "right" }}>{form.name || "English Name"}</div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${form.color}18`, border: `1px solid ${form.color}44`, color: form.color, direction: "ltr" }}>{form.phone || "+965…"}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${cur.code === "KWD" ? "#16a34a18" : "#d9770618"}`, border: "1px solid rgba(128,128,128,.25)", color: "var(--ia-text)" }}>{cur.flag} {cur.short}</span>
            </div>
          </div>

          {/* ── ① الأساسيات ── */}
          <SectionTitle n="1" t="الأساسيات" c={form.color} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="الاسم العربي *"><input {...inp} placeholder="توفير أونلاين شوب" value={form.nameAr} onChange={(e) => setF("nameAr", e.target.value)} /></Field>
            <Field label="English Name *"><input {...inp} placeholder="Tawfeer Online Shop" value={form.name} onChange={(e) => setF("name", e.target.value)} /></Field>
            {isNew && (
              <Field label="كود قصير (لاتيني، اختياري)">
                <input {...inp} placeholder="tawfeer" value={form.code} onChange={(e) => setF("code", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              </Field>
            )}
            <Field label="الأيقونة">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {EMOJI_CHOICES.map((em) => (
                  <button key={em} type="button" onClick={() => setF("emoji", em)} style={{
                    width: "34px", height: "34px", borderRadius: "8px", fontSize: "17px", cursor: "pointer",
                    border: form.emoji === em ? `2px solid ${form.color}` : "1px solid var(--ia-bd)",
                    background: form.emoji === em ? `${form.color}18` : "var(--ia-card)",
                    transition: "all .15s",
                  }}>{em}</button>
                ))}
              </div>
            </Field>
          </div>

          {/* ── ② العملة ── */}
          <SectionTitle n="2" t={`العملة — ${cur.ar}`} c="#0d9488" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: "7px" }}>
            {Object.values(CURRENCIES).map((c) => {
              const on = c.code === form.currency;
              return (
                <button key={c.code} type="button" onClick={() => setF("currency", c.code)} style={{
                  display: "flex", alignItems: "center", gap: "8px", padding: "9px 10px", borderRadius: "10px",
                  border: on ? "2px solid #0d9488" : "1px solid var(--ia-bd)", cursor: "pointer",
                  background: on ? "#0d948815" : "var(--ia-card)", transition: "all .15s", textAlign: "right",
                }}>
                  <span style={{ fontSize: "18px" }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: "11.5px", fontWeight: 900, color: "var(--ia-text)" }}>{c.ar}</span>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--ia-sub)", direction: "ltr", textAlign: "right" }}>{c.code} • {c.short}</span>
                  </span>
                  {on && <span style={{ fontSize: "12px", color: "#0d9488", fontWeight: 900 }}>✓</span>}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "11px", color: "var(--ia-sub)", marginTop: "7px", lineHeight: 1.7 }}>
            💡 كل مبالغ الفواتير والتقارير والطباعة ستنسّق بعملة الشركة النشطة — مثال: <b style={{ color: "var(--ia-text)" }}>{(1234.5).toFixed(cur.decimals)} {cur.short}</b>
          </div>

          {/* ── ③ بيانات الاتصال ── */}
          <SectionTitle n="3" t="بيانات الاتصال" c={form.color} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="هاتف الشركة"><input {...inp} dir="ltr" placeholder="+96598737207" value={form.phone} onChange={(e) => setF("phone", e.target.value)} /></Field>
            <Field label="البريد الإلكتروني"><input {...inp} dir="ltr" placeholder="info@company.store" value={form.email} onChange={(e) => setF("email", e.target.value)} /></Field>
            <Field label="المدير"><input {...inp} placeholder="أحمد عزت" value={form.manager} onChange={(e) => setF("manager", e.target.value)} /></Field>
            <Field label="هاتف المدير"><input {...inp} dir="ltr" placeholder="+9659…" value={form.managerPhone} onChange={(e) => setF("managerPhone", e.target.value)} /></Field>
            <Field label="العنوان"><input {...inp} placeholder="Kuwait City - Hawally 10078" value={form.address} onChange={(e) => setF("address", e.target.value)} /></Field>
            <Field label="المدينة"><input {...inp} placeholder="Hawalli" value={form.city} onChange={(e) => setF("city", e.target.value)} /></Field>
            <Field label="المرجع/البائع (Seller Ref)"><input {...inp} placeholder="Tawfeer" value={form.sellerRef} onChange={(e) => setF("sellerRef", e.target.value)} /></Field>
          </div>

          {/* ── ④ الهوية البصرية ── */}
          <SectionTitle n="4" t="الهوية البصرية" c={form.accent} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {([["color", "اللون الأساسي"], ["accent", "لون التمييز"], ["cardBg", "خلفية البطاقات"]]).map(([k, label]) => (
              <Field key={k} label={label}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form[k]) ? form[k] : "#334155"}
                    onChange={(e) => setF(k, e.target.value)}
                    style={{ width: "42px", height: "34px", border: "1px solid var(--ia-bd)", borderRadius: "8px", background: "var(--ia-card)", cursor: "pointer", padding: "2px" }} />
                  <input {...inp} dir="ltr" value={form[k]} onChange={(e) => setF(k, e.target.value)} style={{ ...inp.style, fontFamily: "monospace", fontSize: "12px" }} />
                </div>
              </Field>
            ))}
          </div>

          {err && (
            <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: "var(--ia-danger-bg, #fee2e2)", border: "1px solid #dc2626", color: "#b91c1c", fontSize: "12.5px", fontWeight: 700 }}>
              ⚠️ {err}
            </div>
          )}

          {/* ── الأزرار ── */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-start" }}>
            <button onClick={save} disabled={busy} style={{
              background: `linear-gradient(135deg, ${form.color}, ${form.accent})`, color: "#fff",
              border: "none", borderRadius: "10px", padding: "10px 26px", fontSize: "13.5px", fontWeight: 900,
              cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
              boxShadow: `0 6px 18px ${form.color}44`, opacity: busy ? 0.7 : 1,
            }}>
              {busy ? "⏳ جارٍ الحفظ…" : isNew ? "＋ إضافة الشركة" : "💾 حفظ التعديلات"}
            </button>
            <button onClick={onClose} disabled={busy} style={{
              background: "var(--ia-card)", border: "1px solid var(--ia-bd)", color: "var(--ia-sub)",
              borderRadius: "10px", padding: "10px 22px", fontSize: "13px", fontWeight: 700, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
            }}>إلغاء</button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ n, t, c }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "16px 0 10px" }}>
      <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: `${c}1a`, border: `1px solid ${c}44`, color: c, fontSize: "11.5px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
      <span style={{ fontSize: "13.5px", fontWeight: 900, color: "var(--ia-text)" }}>{t}</span>
      <span style={{ flex: 1, height: "1px", background: "var(--ia-bd)" }} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--ia-sub)", marginBottom: "5px" }}>{label}</div>
      {children}
    </div>
  );
}
