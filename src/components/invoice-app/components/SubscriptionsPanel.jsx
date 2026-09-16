"use client";

import { useCallback, useEffect, useState } from "react";
import { tr, dateLocale } from "@/lib/i18n-app";

/**
 * r17/r18: لوحة المؤسس — إدارة الاشتراكات (تبويب في مودال AdminDashboard).
 * - GET /api/admin/subscriptions → { plans, subscribers, requests, stats }
 * - PUT  (تحرير خطة) · POST set_plan / approve_request / reject_request
 * - عربية بالكامل (لوحة المؤسس) — لا i18n.
 */

/* علم الدولة من كودها (KW → 🇰🇼) */
function flagOf(code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🏳️";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

const PLAN_COLORS = {
  free_early: { bg: "var(--ia-ok-bg)", tx: "var(--ia-ok-tx)" },
  starter: { bg: "var(--ia-vio-bg)", tx: "var(--ia-vio-tx)" },
  pro: { bg: "rgba(201,162,39,.16)", tx: "#9a7318" },
  business: { bg: "rgba(15,118,110,.14)", tx: "#0f766e" },
};
const planColor = (code) => PLAN_COLORS[code] || { bg: "var(--ia-chip)", tx: "var(--ia-sub)" };

const REQ_STATUS = {
  pending: { bg: "var(--ia-warn-bg)", tx: "var(--ia-warn-tx)", label: "قيد المراجعة" },
  approved: { bg: "var(--ia-ok-bg)", tx: "var(--ia-ok-tx)", label: "معتمد ✓" },
  rejected: { bg: "var(--ia-red-bg)", tx: "var(--ia-red-tx)", label: "مرفوض ✕" },
};

const toDraft = (p) => ({
  nameAr: p.nameAr || "",
  descAr: p.descAr || "",
  priceUsd: String(p.priceUsd ?? 0),
  maxCompanies: String(p.maxCompanies ?? 0),
  maxCustomers: String(p.maxCustomers ?? 0),
  monthlyAiInvoices: String(p.monthlyAiInvoices ?? 0),
  badgeAr: p.badgeAr || "",
  sortOrder: String(p.sortOrder ?? 0),
  active: !!p.active,
  featuresText: Array.isArray(p.features) ? p.features.join("\n") : "",
});

const fmtDateTime = (iso) => {
  try { return new Date(iso).toLocaleString(dateLocale()); } catch { return String(iso || ""); }
};
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString(dateLocale()); } catch { return String(iso || "").slice(0, 10); }
};

export default function SubscriptionsPanel({ toast_ }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [expanded, setExpanded] = useState({});
  const [savingPlan, setSavingPlan] = useState(null);
  const [busy, setBusy] = useState(null);
  const [q, setQ] = useState("");
  const [, setTick] = useState(0);

  const notify = useCallback((msg, type) => {
    if (typeof toast_ === "function") toast_(msg, type);
  }, [toast_]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/subscriptions");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j);
      const nd = {};
      for (const p of j.plans || []) nd[p.code] = toDraft(p);
      setDrafts(nd);
    } catch (e) {
      setErr(e.message || tr("تعذّر تحميل بيانات الاشتراكات"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setDraft = (code, patch) => {
    setDrafts((dr) => ({ ...dr, [code]: { ...dr[code], ...patch } }));
  };

  /* ── حفظ خطة (PUT — الحقول المتغيرة فقط) ── */
  const savePlan = async (code) => {
    const d = drafts[code];
    const orig = (data?.plans || []).find((p) => p.code === code);
    if (!d || !orig) return;

    const body = { code };
    if (d.nameAr.trim() && d.nameAr.trim() !== orig.nameAr) body.nameAr = d.nameAr.trim();
    if (d.descAr.trim() !== (orig.descAr || "")) body.descAr = d.descAr.trim();
    const price = Number(d.priceUsd);
    if (Number.isFinite(price) && price !== orig.priceUsd) body.priceUsd = price;
    const mc = parseInt(d.maxCompanies, 10);
    if (Number.isFinite(mc) && mc !== orig.maxCompanies) body.maxCompanies = mc;
    const mcu = parseInt(d.maxCustomers, 10);
    if (Number.isFinite(mcu) && mcu !== orig.maxCustomers) body.maxCustomers = mcu;
    const ai = parseInt(d.monthlyAiInvoices, 10);
    if (Number.isFinite(ai) && ai !== orig.monthlyAiInvoices) body.monthlyAiInvoices = ai;
    if (d.badgeAr.trim() !== (orig.badgeAr || "")) body.badgeAr = d.badgeAr.trim();
    const so = parseInt(d.sortOrder, 10);
    if (Number.isFinite(so) && so !== orig.sortOrder) body.sortOrder = so;
    if (d.active !== orig.active) body.active = d.active;
    const feats = d.featuresText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (feats.join("\n") !== (orig.features || []).join("\n")) body.features = feats;

    if (Object.keys(body).length <= 1) {
      notify(tr("لا تغييرات للحفظ"), "warn");
      return;
    }

    setSavingPlan(code);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      const saved = j.plan || orig;
      setData((dd) => (dd ? { ...dd, plans: (dd.plans || []).map((p) => (p.code === code ? saved : p)) } : dd));
      setDrafts((dr) => ({ ...dr, [code]: toDraft(saved) }));
      notify(tr("✅ حُفظت خطة «{0}»",[saved.nameAr]));
    } catch (e) {
      notify("❌ " + (e.message || tr("فشل الحفظ")), "warn");
    } finally {
      setSavingPlan(null);
    }
  };

  /* ── إجراء POST عام (تأكيد + إعادة تحميل) ── */
  const act = async (action, payload, confirmMsg, okMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(`${action}:${payload.requestId || payload.userId}`);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      notify(okMsg);
      await load();
    } catch (e) {
      notify("❌ " + (e.message || tr("فشل التنفيذ")), "warn");
    } finally {
      setBusy(null);
    }
  };

  const changePlan = (s, code) => {
    if (code === s.plan) return;
    const planName = (data?.plans || []).find((p) => p.code === code)?.nameAr || code;
    if (!window.confirm(tr("تغيير خطة «{0}» إلى «{1}»؟",[s.displayName,planName]))) {
      setTick((x) => x + 1); // إعادة ضبط القيمة المحددة بصرياً بعد الإلغاء
      return;
    }
    act("set_plan", { userId: s.id, planCode: code }, null, tr("✅ خطة «{0}» أصبحت «{1}»",[s.displayName,planName]));
  };

  const lbl = { display: "block", fontSize: 10.5, color: "var(--ia-sub)", marginBottom: 5, fontWeight: 800 };
  const card = { background: "var(--ia-card)", borderRadius: 14, padding: "16px 18px", border: "1px solid var(--ia-border)", animation: "subFade .4s ease both" };
  const chip = (c) => ({ background: c.bg, color: c.tx, borderRadius: 30, padding: "3px 12px", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" });

  /* ── تحميل ── */
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 12, direction: "rtl" }} aria-busy="true">
        <style>{STYLE}</style>
        <div className="sub-stats">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="sk sk-lg" style={{ width: "55%", marginBottom: 10 }} />
              <div className="sk sk-sm" style={{ width: "80%" }} />
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="sk sk-lg" style={{ width: 180, marginBottom: 14 }} />
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk" style={{ height: 13, marginBottom: 11 }} />)}
        </div>
      </div>
    );
  }

  /* ── خطأ ── */
  if (err) {
    return (
      <div style={{ direction: "rtl" }}>
        <style>{STYLE}</style>
        <div style={{ background: "var(--ia-red-bg)", border: "1px solid var(--ia-red-bd)", borderRadius: 12, padding: "22px 24px", color: "var(--ia-red-tx)", fontSize: 13, lineHeight: 1.8, animation: "subFade .4s ease both" }} role="alert">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{tr("❌ فشل تحميل الاشتراكات")}</div>
          <div style={{ marginBottom: 16 }}>{err}</div>
          <button onClick={load} className="btn sub-btn" style={{ background: "#b91c1c", color: "#fff" }}>{tr("🔄 إعادة المحاولة")}</button>
        </div>
      </div>
    );
  }

  const plans = data?.plans || [];
  const subscribers = data?.subscribers || [];
  const requests = data?.requests || [];
  const stats = data?.stats || {};

  const needle = q.trim().toLowerCase();
  const filtered = subscribers.filter((s) =>
    !needle ||
    String(s.displayName || "").includes(q.trim()) ||
    String(s.email || "").toLowerCase().includes(needle)
  );

  const usageCell = (u) => (
    <div style={{ fontSize: 11.5, lineHeight: 2 }}>
      {[
        [u.companies.used, u.companies.max, tr("شركات")],
        [u.customers.used, u.customers.max, tr("عميل")],
        [u.aiInvoices.used, u.aiInvoices.max, "AI"],
      ].map(([used, max, label], i) => (
        <span key={label}>
          {i > 0 && <span style={{ color: "var(--ia-muted)" }}> · </span>}
          <b dir="ltr" style={{ color: used >= max ? "#dc2626" : "var(--ia-text2)" }}>{used}/{max}</b> {label}
        </span>
      ))}
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 13, direction: "rtl" }}>
      <style>{STYLE}</style>

      {/* ── ١) الإحصاءات ── */}
      <div className="sub-stats">
        <div className="card" style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 21, marginBottom: 4 }} aria-hidden="true">👥</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "var(--ia-text)" }}>{stats.totalSubscribers ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--ia-sub)", fontWeight: 700 }}>{tr("إجمالي المشتركين")}</div>
        </div>
        <div className="card" style={{ padding: "13px 15px", borderColor: stats.pendingRequests > 0 ? "var(--ia-warn-bd)" : undefined }}>
          <div style={{ fontSize: 21, marginBottom: 4 }} aria-hidden="true">⏳</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: stats.pendingRequests > 0 ? "#f59e0b" : "var(--ia-text)" }}>{stats.pendingRequests ?? 0}</div>
          <div style={{ fontSize: 11, color: "var(--ia-sub)", fontWeight: 700 }}>{tr("طلبات معلّقة")}</div>
        </div>
        <div className="card" style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 21, marginBottom: 4 }} aria-hidden="true">🎁</div>
          <div dir="ltr" style={{ fontSize: 22, fontWeight: 900, color: "var(--ia-text)", textAlign: "start" }}>
            {stats.freeRemaining ?? 0}<span style={{ fontSize: 13, color: "var(--ia-muted)", fontWeight: 700 }}> / {stats.freeLimit ?? 100}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ia-sub)", fontWeight: 700 }}>{tr("مقاعد مجانية متبقية")}</div>
        </div>
        <div className="card" style={{ padding: "13px 15px" }}>
          <div style={{ fontSize: 21, marginBottom: 4 }} aria-hidden="true">💵</div>
          <div dir="ltr" style={{ fontSize: 22, fontWeight: 900, color: "#9a7318", textAlign: "start" }}>${(stats.mrrUsd ?? 0).toFixed(0)} USD</div>
          <div style={{ fontSize: 11, color: "var(--ia-sub)", fontWeight: 700 }}>{tr("الإيراد الشهري المتوقع")}</div>
        </div>
      </div>

      {/* ── ٢) محرر الخطط ── */}
      <div className="card" style={card}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>{tr("🎛️ محرر الخطط")} <span style={{ fontSize: 11, color: "var(--ia-muted)", fontWeight: 700 }}>{tr("(اضغط الخطة لتوسيعها)")}</span></div>
        {plans.map((p) => {
          const d = drafts[p.code];
          const exp = !!expanded[p.code];
          const pc = planColor(p.code);
          return (
            <div key={p.code} className="card" style={{ padding: 0, marginBottom: 9, overflow: "hidden", border: "1px solid var(--ia-border)" }}>
              <button
                type="button"
                onClick={() => setExpanded((x) => ({ ...x, [p.code]: !x[p.code] }))}
                aria-expanded={exp}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 15px",
                  background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "start", minHeight: 44,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--ia-muted)", width: 12 }} aria-hidden="true">{exp ? "▾" : "▸"}</span>
                <span style={chip(pc)}>{tr(p.nameAr)}</span>
                <b dir="ltr" style={{ color: "#9a7318", fontSize: 12.5 }}>${p.priceUsd}</b>
                <span style={{ flex: 1 }} />
                {!p.active && <span style={{ ...chip({ bg: "var(--ia-chip)", tx: "var(--ia-muted)" }), fontSize: 10 }}>{tr("معطّلة")}</span>}
                <span dir="ltr" style={{ fontSize: 10, color: "var(--ia-muted)", fontWeight: 700 }}>{p.code}</span>
              </button>

              {exp && d && (
                <div style={{ padding: "6px 15px 15px", borderTop: "1px solid var(--ia-border3)", display: "grid", gap: 12 }}>
                  <div className="sub-fields">
                    <div>
                      <label style={lbl}>{tr("الاسم (عربي)")}</label>
                      <input className="inp" value={d.nameAr} onChange={(e) => setDraft(p.code, { nameAr: e.target.value })} maxLength={60} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("السعر بالدولار")}</label>
                      <input className="inp" dir="ltr" type="number" step="0.5" min="0" max="10000" value={d.priceUsd} onChange={(e) => setDraft(p.code, { priceUsd: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("حد الشركات")}</label>
                      <input className="inp" dir="ltr" type="number" step="1" min="0" max="100" value={d.maxCompanies} onChange={(e) => setDraft(p.code, { maxCompanies: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("حد العملاء")}</label>
                      <input className="inp" dir="ltr" type="number" step="1" min="0" max="1000000" value={d.maxCustomers} onChange={(e) => setDraft(p.code, { maxCustomers: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("فواتير AI شهرياً")}</label>
                      <input className="inp" dir="ltr" type="number" step="1" min="0" max="100000" value={d.monthlyAiInvoices} onChange={(e) => setDraft(p.code, { monthlyAiInvoices: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("الشارة (اختياري)")}</label>
                      <input className="inp" placeholder={tr("⭐ الأكثر شيوعاً")} value={d.badgeAr} onChange={(e) => setDraft(p.code, { badgeAr: e.target.value })} maxLength={40} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("الترتيب")}</label>
                      <input className="inp" dir="ltr" type="number" step="1" min="0" max="99" value={d.sortOrder} onChange={(e) => setDraft(p.code, { sortOrder: e.target.value })} />
                    </div>
                    <div>
                      <label style={lbl}>{tr("الوصف")}</label>
                      <input className="inp" value={d.descAr} onChange={(e) => setDraft(p.code, { descAr: e.target.value })} maxLength={200} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.active}
                        aria-label={tr("الخطة مفعّلة")}
                        onClick={() => setDraft(p.code, { active: !d.active })}
                        style={{
                          width: 48, height: 26, borderRadius: 999, border: "none", position: "relative",
                          background: d.active ? "#16a34a" : "var(--ia-border2)", cursor: "pointer",
                          transition: "background .2s", flexShrink: 0, padding: 0, minHeight: 26,
                        }}
                      >
                        <span style={{ position: "absolute", top: 3, insetInlineStart: d.active ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.3)", transition: "all .2s" }} />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 800, color: d.active ? "var(--ia-ok-tx)" : "var(--ia-muted)" }}>
                        {d.active ? tr("مفعّلة") : tr("معطّلة")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>{tr("المزايا (ميزة لكل سطر)")}</label>
                    <textarea
                      className="inp"
                      rows={4}
                      value={d.featuresText}
                      onChange={(e) => setDraft(p.code, { featuresText: e.target.value })}
                      style={{ resize: "vertical", minHeight: 44 }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      className="btn sub-btn"
                      onClick={() => savePlan(p.code)}
                      disabled={savingPlan === p.code}
                      style={{
                        background: savingPlan === p.code ? "var(--ia-ghost-bg)" : "linear-gradient(135deg,#c9a227,#9a7318)",
                        color: savingPlan === p.code ? "var(--ia-muted)" : "#fff",
                        padding: "10px 24px", cursor: savingPlan === p.code ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingPlan === p.code ? tr("⏳ جارٍ الحفظ...") : tr("💾 حفظ الخطة")}
                    </button>
                    <span style={{ fontSize: 10.5, color: "var(--ia-muted)" }}>{tr("آخر تحديث:")} {fmtDateTime(p.updatedAt)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── ٣) طلبات الترقية ── */}
      <div className="card" style={card}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>{tr("📨 طلبات الترقية (")}{requests.length})</div>
        {requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "22px 10px", color: "var(--ia-muted)", fontSize: 12.5 }}>{tr("لا طلبات بعد — ستظهر هنا طلبات المشتركين لترقية خططهم")}</div>
        ) : (
          requests.map((r) => {
            const st = REQ_STATUS[r.status] || REQ_STATUS.pending;
            const curName = plans.find((p) => p.code === r.currentPlan)?.nameAr || r.currentPlan;
            return (
              <div key={r.id} className="card" style={{ padding: "12px 15px", marginBottom: 9, border: "1px solid var(--ia-border)", display: "grid", gap: 8, animation: "subFade .4s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5 }}>
                  <b>👤 {r.userName}</b>
                  <span dir="ltr" style={{ color: "var(--ia-sub)", fontSize: 11.5 }}>{r.userEmail}</span>
                  <span title={r.userCountry || ""} aria-label={r.userCountry || ""}>{flagOf(r.userCountry)}</span>
                  <span style={chip({ bg: "var(--ia-chip)", tx: "var(--ia-sub)" })}>{curName}</span>
                  <span style={{ color: "var(--ia-muted)" }}>→</span>
                  <span style={chip(planColor(r.planCode))}>{r.planNameAr} · ${r.planPriceUsd}</span>
                  <span style={{ flex: 1 }} />
                  <span style={chip({ bg: st.bg, tx: st.tx })}>{st.label}</span>
                </div>
                {r.note && (
                  <em style={{ fontSize: 12, color: "var(--ia-sub)", fontStyle: "italic" }}>📝 {r.note}</em>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10.5, color: "var(--ia-muted)" }}>🕐 {fmtDateTime(r.createdAt)}</span>
                  <span style={{ flex: 1 }} />
                  {r.status === "pending" ? (
                    <>
                      <button
                        className="btn sub-btn"
                        onClick={() => act("approve_request", { requestId: r.id }, tr("اعتماد ترقية «{0}» إلى «{1}»؟",[r.userName,r.planNameAr]), tr("✅ اعتُمدت ترقية «{0}» إلى «{1}»",[r.userName,r.planNameAr]))}
                        disabled={busy === `approve_request:${r.id}`}
                        style={{ background: "#16a34a", color: "#fff", cursor: busy === `approve_request:${r.id}` ? "not-allowed" : "pointer", padding: "8px 16px" }}
                      >
                        {busy === `approve_request:${r.id}` ? "⏳ …" : tr("✅ اعتماد")}
                      </button>
                      <button
                        className="btn sub-btn"
                        onClick={() => act("reject_request", { requestId: r.id }, tr("رفض طلب ترقية «{0}»؟",[r.userName]), tr("🚫 رُفض طلب «{0}»",[r.userName]))}
                        disabled={busy === `reject_request:${r.id}`}
                        style={{ background: "#dc2626", color: "#fff", cursor: busy === `reject_request:${r.id}` ? "not-allowed" : "pointer", padding: "8px 16px" }}
                      >
                        {busy === `reject_request:${r.id}` ? "⏳ …" : tr("❌ رفض")}
                      </button>
                    </>
                  ) : (
                    r.handledBy && <span style={{ fontSize: 10.5, color: "var(--ia-muted)" }}>{tr("عالجها:")} {r.handledBy}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── ٤) المشتركون ── */}
      <div className="card" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, flex: 1 }}>{tr("👥 المشتركون (")}{filtered.length}{filtered.length !== subscribers.length ? tr(" من {0}",[subscribers.length]) : ""})</div>
          <input
            className="inp"
            type="search"
            placeholder={tr("ابحث بالاسم أو البريد…")}
            value={q}
            aria-label={tr("بحث المشتركين")}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 240, flex: 1, minWidth: 160 }}
          />
        </div>

        {subscribers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "22px 10px", color: "var(--ia-muted)", fontSize: 12.5 }}>{tr("لا مشتركين بعد — سجّل الدخول كمشترك لتظهر بياناته هنا")}</div>
        ) : (
          <div>
            <div className="sub-grid sub-head" aria-hidden="true">
              <div>{tr("المشترك")}</div>
              <div>{tr("البلد")}</div>
              <div>{tr("الخطة")}</div>
              <div>{tr("الاستخدام")}</div>
              <div>{tr("عضو منذ")}</div>
            </div>
            {filtered.map((s) => (
              <div key={s.id} className="sub-grid sub-row">
                <div>
                  <span className="sub-lbl">{tr("المشترك")}</span>
                  <b style={{ fontSize: 12.5 }}>{s.displayName}</b>
                  <div dir="ltr" style={{ fontSize: 10.5, color: "var(--ia-muted)" }}>{s.email}</div>
                </div>
                <div>
                  <span className="sub-lbl">{tr("البلد")}</span>
                  <span title={s.country || ""}>{flagOf(s.country)}</span>
                  <span dir="ltr" style={{ fontSize: 11.5, color: "var(--ia-sub)", fontWeight: 700 }}>{s.country || "—"}</span>
                </div>
                <div>
                  <span className="sub-lbl">{tr("الخطة")}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={chip(planColor(s.plan))}>{s.planNameAr || s.plan}</span>
                    <select
                      className="inp sub-plan-sel"
                      value={s.plan}
                      aria-label={tr("تغيير خطة {0}",[s.displayName])}
                      onChange={(e) => changePlan(s, e.target.value)}
                    >
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>{tr(p.nameAr)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <span className="sub-lbl">{tr("الاستخدام")}</span>
                  {s.usage ? usageCell(s.usage) : "—"}
                </div>
                <div>
                  <span className="sub-lbl">{tr("عضو منذ")}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ia-sub)", fontWeight: 700 }}>📅 {fmtDate(s.createdAt)}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "18px 10px", color: "var(--ia-muted)", fontSize: 12.5 }}>{tr("لا نتائج مطابقة للبحث")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STYLE = `
@keyframes subFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.sub-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sub-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:11px}
.sub-grid{display:grid;grid-template-columns:1.5fr .55fr 1.35fr 1.75fr .8fr;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid var(--ia-border3)}
.sub-head{font-size:10.5px;color:var(--ia-sub);font-weight:800;text-transform:uppercase;letter-spacing:.4px;border-bottom:1.5px solid var(--ia-border)}
.sub-row{transition:background .12s}
.sub-row:hover{background:var(--ia-hover)}
.sub-lbl{display:none;font-size:9.5px;color:var(--ia-muted);font-weight:800;margin-bottom:2px}
.sub-plan-sel{padding:5px 24px 5px 8px !important;font-size:11.5px;width:auto;min-width:92px}
.btn.sub-btn:focus-visible,.inp:focus-visible{outline:2.5px solid #c9a227;outline-offset:2px}
@media(max-width:680px){
  .sub-stats{grid-template-columns:repeat(2,1fr)}
  .sub-grid{grid-template-columns:1fr 1fr;gap:8px}
  .sub-head{display:none}
  .sub-lbl{display:block}
  .sub-fields{grid-template-columns:1fr 1fr}
  .btn.sub-btn{min-height:44px}
}
@media(max-width:400px){.sub-fields{grid-template-columns:1fr}}
`;
