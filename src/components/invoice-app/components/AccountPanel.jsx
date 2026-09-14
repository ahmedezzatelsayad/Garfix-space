"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LangProvider, useI18n } from "@/lib/i18n-context";
import { LANGUAGES } from "@/lib/i18n";

/**
 * r18: تبويب «حسابي» — الملف الشخصي والاشتراك والاستخدام للمستخدم الحالي.
 * - GET /api/subscription → { accountType, profile, plan, usage, pendingRequest, freeSeats }
 *   · builtin  → بطاقة وصول غير محدود + منتقي اللغة
 *   · subscriber → بروفايل قابل للتحرير (PUT) + عدّادات + خطط بعملة بلده + طلبات الترقية (POST)
 * - الخطط المحلية بعملة بلد المشترك: GET /api/pricing?country=XX (١٩٦ دولة)
 * - مغلّف بـ LangProvider — ٢٨ لغة مع سقوط عربي.
 */

/* ── منتقي بلد مدمج (نمط لوحة التحكم: فاتح + بحث + تجميع عربي/عالمي) ── */
function CountryPicker({ countries, value, onChange, t, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef(null);
  const itemRefs = useRef({});

  const needle = q.trim().toLowerCase();
  const match = (c) =>
    !needle ||
    String(c.nameAr || "").includes(q.trim()) ||
    String(c.nameEn || "").toLowerCase().includes(needle) ||
    String(c.code || "").toLowerCase().includes(needle);
  const arab = countries.filter((c) => c.arabic && match(c));
  const rest = countries.filter((c) => !c.arabic && match(c));
  const flat = [...arab, ...rest];

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const pick = (c) => {
    setOpen(false);
    setQ("");
    setActiveIdx(0);
    if (c && c.code !== value) onChange(c.code);
  };

  const onKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const c = flat[activeIdx];
      if (c) {
        e.preventDefault();
        pick(c);
      }
    }
  };

  const current = countries.find((c) => c.code === value);

  const row = (c, idx) => (
    <button
      key={c.code}
      ref={(el) => { itemRefs.current[idx] = el; }}
      type="button"
      role="option"
      aria-selected={idx === activeIdx}
      style={{
        display: "flex", alignItems: "center", gap: 7, width: "100%", minHeight: 40,
        background: idx === activeIdx ? "var(--ia-soft)" : "transparent",
        border: "none", borderRadius: 8, padding: "6px 9px", fontFamily: "inherit",
        fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "start",
        color: c.code === value ? "#9a7318" : "var(--ia-text2)",
      }}
      onMouseEnter={() => setActiveIdx(idx)}
      onClick={() => pick(c)}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>{c.flag}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nameAr}</span>
      <span dir="ltr" style={{ fontSize: 10, color: "var(--ia-muted)", flexShrink: 0 }}>{c.currency}</span>
      {c.vat > 0 && (
        <span dir="ltr" style={{ fontSize: 9.5, background: "rgba(201,162,39,.14)", color: "#9a7318", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>VAT {c.vat}%</span>
      )}
      {c.code === value && <span style={{ fontSize: 10, flexShrink: 0 }}>✓</span>}
    </button>
  );

  return (
    <div ref={rootRef} style={{ position: "relative" }} onKeyDown={onKey}>
      <button
        type="button"
        className="inp"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("account.country")}
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setActiveIdx(0); }}
        style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "start", minHeight: 38, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
      >
        <span style={{ fontSize: 16 }}>{current?.flag || "🌍"}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.nameAr || t("account.country")}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("account.country")}
          style={{
            position: "absolute", top: "108%", insetInlineEnd: 0, zIndex: 900,
            background: "var(--ia-card)", border: "1px solid var(--ia-border2)", borderRadius: 12,
            boxShadow: "0 16px 44px rgba(0,0,0,.22)", padding: 7,
            width: "min(92vw, 300px)",
          }}
        >
          <input
            autoFocus
            type="text"
            dir="auto"
            value={q}
            aria-label={t("common.search")}
            placeholder={t("pricing.searchCountry")}
            onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
            style={{
              width: "100%", background: "var(--ia-soft)", border: "1px solid var(--ia-border)",
              borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 12,
              color: "var(--ia-text)", outline: "none", marginBottom: 5,
            }}
          />
          <div className="acc-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
            {flat.length === 0 && (
              <div style={{ padding: "18px 8px", textAlign: "center", color: "var(--ia-muted)", fontSize: 12 }}>🌍 —</div>
            )}
            {arab.length > 0 && (
              <div style={{ padding: "5px 8px 3px", fontSize: 9.5, color: "var(--ia-muted)", fontWeight: 800, letterSpacing: 1 }}>🌍 الدول العربية</div>
            )}
            {arab.map((c, i) => row(c, i))}
            {rest.length > 0 && (
              <div style={{ padding: "7px 8px 3px", fontSize: 9.5, color: "var(--ia-muted)", fontWeight: 800, letterSpacing: 1 }}>🌏 باقي دول العالم</div>
            )}
            {rest.map((c, i) => row(c, arab.length + i))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── عدّاد استخدام واحد (أخضر <٧٥٪ · كهرماني <١٠٠٪ · أحمر عند الحد) ── */
function Meter({ icon, label, sub, used, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = used >= max ? "#dc2626" : pct >= 75 ? "#f59e0b" : "#10b981";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7, fontSize: 12.5, flexWrap: "wrap" }}>
        <span aria-hidden="true">{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, color: "var(--ia-text2)", minWidth: 90 }}>
          {label}
          {sub ? <em style={{ color: "var(--ia-muted)", fontSize: 10.5, fontWeight: 600, marginInlineStart: 5, fontStyle: "normal" }}>({sub})</em> : null}
        </span>
        <b dir="ltr" style={{ fontSize: 12, color: used >= max ? "#dc2626" : "var(--ia-sub)" }}>{used} / {max}</b>
      </div>
      <div
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        dir="ltr"
        style={{ height: 9, borderRadius: 999, background: "var(--ia-skel)", overflow: "hidden" }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width .5s ease" }} />
      </div>
    </div>
  );
}

/* ── جسم اللوحة (داخل مزوّد اللغة) ── */
function AccountInner({ toast_ }) {
  const { t, lang, dir, setLang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [langSel, setLangSel] = useState("ar");
  const [country, setCountry] = useState("KW");
  const [saving, setSaving] = useState(false);

  const [pricing, setPricing] = useState(null);
  const [plansLoading, setPlansLoading] = useState(true);

  const [noteOpenFor, setNoteOpenFor] = useState(null);
  const [note, setNote] = useState("");
  const [reqBusy, setReqBusy] = useState(false);

  const notify = useCallback((msg, type) => {
    if (typeof toast_ === "function") toast_(msg, type);
  }, [toast_]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/subscription");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j);
      if (j.accountType === "subscriber" && j.profile) {
        setName(j.profile.displayName || "");
        setPhone(j.profile.phone || "");
        setLangSel(j.profile.lang || "ar");
        setCountry(j.profile.country || "KW");
      }
    } catch (e) {
      setErr(e.message || "تعذّر تحميل بيانات الحساب");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // لغة الواجهة تتبع لغة الملف المحفوظة (بعد التحميل وبعد كل حفظ ناجح)
  useEffect(() => {
    const l = data?.profile?.lang;
    if (l && LANGUAGES.some((x) => x.code === l)) setLang(l);
  }, [data, setLang]);

  // الخطط بعملة بلد المشترك
  useEffect(() => {
    if (data?.accountType !== "subscriber") return undefined;
    let alive = true;
    setPlansLoading(true);
    fetch(`/api/pricing?country=${encodeURIComponent(country || "KW")}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (alive && ok) setPricing(j); })
      .catch(() => {})
      .finally(() => { if (alive) setPlansLoading(false); });
    return () => { alive = false; };
  }, [data?.accountType, country]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = { displayName: name, phone: phone, lang: langSel };
      if (country) payload.countryCode = country;
      const res = await fetch("/api/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData((d) => (d ? { ...d, profile: { ...d.profile, displayName: j.profile.displayName, phone: j.profile.phone, lang: j.profile.lang, country: j.profile.countryCode } } : d));
      setCountry(j.profile.countryCode || country);
      setLang(j.profile.lang || langSel);
      notify("✅ " + t("account.saved"));
    } catch (e) {
      notify("❌ " + (e.message || "فشل الحفظ"), "warn");
    } finally {
      setSaving(false);
    }
  };

  const sendRequest = async (planCode, noteText) => {
    setReqBusy(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_plan", planCode, note: noteText }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setNoteOpenFor(null);
      setNote("");
      setData((d) => (d ? { ...d, pendingRequest: { planCode, note: noteText || null } } : d));
      notify("✅ " + t("pricing.requestSent"));
    } catch (e) {
      notify("❌ " + (e.message || "فشل إرسال الطلب"), "warn");
    } finally {
      setReqBusy(false);
    }
  };

  const cancelRequest = async () => {
    setReqBusy(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_request" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData((d) => (d ? { ...d, pendingRequest: null } : d));
      notify("🗑️ " + t("pricing.requestCancelled"));
    } catch (e) {
      notify("❌ " + (e.message || "فشل الإلغاء"), "warn");
    } finally {
      setReqBusy(false);
    }
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(lang === "ar" ? "ar" : lang);
    } catch {
      return String(iso || "").slice(0, 10);
    }
  };

  const lbl = { display: "block", fontSize: 11, color: "var(--ia-sub)", marginBottom: 5, fontWeight: 800 };
  const card = { background: "var(--ia-card)", borderRadius: 14, padding: "20px 22px", border: "1px solid var(--ia-border)", animation: "accFade .45s ease both" };

  /* ── تحميل ── */
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 14, direction: dir }} aria-busy="true">
        <style>{STYLE}</style>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
            <div className="sk" style={{ width: 54, height: 54, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="sk sk-lg" style={{ width: "55%", marginBottom: 9 }} />
              <div className="sk sk-sm" style={{ width: "38%" }} />
            </div>
          </div>
          <div className="acc-grid">
            {[0, 1, 2, 3].map((i) => <div key={i}><div className="sk sk-sm" style={{ width: 70, marginBottom: 7 }} /><div className="sk" style={{ height: 38 }} /></div>)}
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="sk sk-lg" style={{ width: 150, marginBottom: 14 }} />
          {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 10, marginBottom: 13 }} />)}
        </div>
      </div>
    );
  }

  /* ── خطأ ── */
  if (err) {
    return (
      <div style={{ direction: dir }}>
        <style>{STYLE}</style>
        <div style={{ background: "var(--ia-red-bg)", border: "1px solid var(--ia-red-bd)", borderRadius: 12, padding: "22px 24px", color: "var(--ia-red-tx)", fontSize: 13, lineHeight: 1.8, animation: "accFade .45s ease both" }} role="alert">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>❌ {t("common.error")}</div>
          <div style={{ marginBottom: 16 }}>{err}</div>
          <button onClick={load} className="btn acc-btn" style={{ background: "#b91c1c", color: "#fff" }}>🔄 {t("common.retry")}</button>
        </div>
      </div>
    );
  }

  const builtin = data?.accountType !== "subscriber";
  const profile = data?.profile || {};
  const usage = data?.usage;
  const plans = pricing?.plans || [];
  const countries = pricing?.countries || [];
  const curPlanCode = data?.plan?.code;
  const pending = data?.pendingRequest;
  const pendingPlanName = plans.find((p) => p.code === pending?.planCode)?.nameAr || pending?.planCode || "";

  /* ── الحسابات المدمجة: بطاقة واحدة أنيقة ── */
  if (builtin) {
    return (
      <div style={{ direction: dir }}>
        <style>{STYLE}</style>
        <div className="card" style={{ ...card, maxWidth: 640, margin: "0 auto", padding: 28, textAlign: dir === "rtl" ? "right" : "left" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">⭐</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: "var(--ia-text)" }}>
            حساب مؤسسي مدمج — وصول غير محدود بلا حصص
          </h3>
          <div style={{ color: "var(--ia-sub)", fontSize: 12.5, lineHeight: 1.9, marginBottom: 18 }}>
            {t("account.unlimitedNote")}
          </div>

          <div className="acc-grid" style={{ marginBottom: 4 }}>
            <div>
              <label style={lbl}>{t("account.name")}</label>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{profile.displayName || "—"}</div>
            </div>
            <div>
              <label style={lbl}>{t("account.email")}</label>
              <div dir="ltr" style={{ fontWeight: 700, fontSize: 13, color: "var(--ia-text2)" }}>{profile.email || "—"}</div>
            </div>
            <div>
              <label style={lbl}>الصفة</label>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ia-text2)" }}>{profile.role || "—"}</div>
            </div>
            <div>
              <label style={lbl}>{t("account.language")}</label>
              <select
                className="inp"
                value={lang}
                aria-label={t("account.language")}
                onChange={(e) => setLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>
                ))}
              </select>
              <div style={{ fontSize: 10.5, color: "var(--ia-muted)", marginTop: 5 }}>تُطبَّق على الواجهة فوراً</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── المشترك: لوحة كاملة ── */
  const quotaRows = (p) => [
    ["🏢", t("pricing.quotaCompanies"), p.maxCompanies],
    ["👥", t("pricing.quotaCustomers"), p.maxCustomers],
    ["🤖", t("pricing.quotaAiInvoices"), p.monthlyAiInvoices],
  ];

  return (
    <div style={{ display: "grid", gap: 14, direction: dir }}>
      <style>{STYLE}</style>

      {/* ── ١) الملف الشخصي ── */}
      <div className="card" style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
          <div
            aria-hidden="true"
            style={{
              width: 54, height: 54, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#c9a227,#9a7318)", color: "#fff",
              fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(201,162,39,.35)",
            }}
          >
            {(profile.displayName || "؟").trim().charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 900, fontSize: 15.5 }}>{profile.displayName || "—"}</div>
            <div dir="ltr" style={{ color: "var(--ia-sub)", fontSize: 12, marginTop: 3, textAlign: dir === "rtl" ? "right" : "left" }}>{profile.email || "—"}</div>
          </div>
          {data?.plan && (
            <span style={{ background: "rgba(201,162,39,.14)", color: "#9a7318", border: "1px solid rgba(201,162,39,.35)", borderRadius: 30, padding: "5px 14px", fontSize: 11.5, fontWeight: 800 }}>
              ✓ {t("account.plan")}: {data.plan.nameAr}
            </span>
          )}
        </div>

        <div className="acc-grid">
          <div>
            <label style={lbl} htmlFor="acc-name">{t("account.name")}</label>
            <input id="acc-name" className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label style={lbl} htmlFor="acc-phone">{t("account.phone")}</label>
            <input id="acc-phone" className="inp" dir="ltr" inputMode="tel" placeholder="+965…" value={phone || ""} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label style={lbl} htmlFor="acc-lang">{t("account.language")}</label>
            <select
              id="acc-lang"
              className="inp"
              value={langSel}
              aria-label={t("account.language")}
              onChange={(e) => { setLangSel(e.target.value); setLang(e.target.value); }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>{t("account.country")}</label>
            {countries.length > 0 ? (
              <CountryPicker countries={countries} value={country} onChange={setCountry} t={t} disabled={plansLoading} />
            ) : (
              <div className="sk" style={{ height: 38 }} />
            )}
          </div>
          <div>
            <label style={lbl}>{t("account.email")}</label>
            <input className="inp" readOnly dir="ltr" value={profile.email || ""} style={{ background: "var(--ia-soft)", opacity: 0.8, cursor: "default" }} aria-readonly="true" />
          </div>
          <div>
            <label style={lbl}>{t("account.memberSince")}</label>
            <div style={{ border: "1.5px dashed var(--ia-border2)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--ia-text2)" }}>
              📅 {fmtDate(profile.createdAt)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: dir === "rtl" ? "flex-start" : "flex-end" }}>
          <button
            className="btn acc-btn"
            onClick={saveProfile}
            disabled={saving}
            style={{
              background: saving ? "var(--ia-ghost-bg)" : "linear-gradient(135deg,#c9a227,#9a7318)",
              color: saving ? "var(--ia-muted)" : "#fff",
              padding: "11px 28px", cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : "0 5px 16px rgba(201,162,39,.3)",
            }}
          >
            {saving ? "⏳ …" : "💾 " + t("account.save")}
          </button>
        </div>
      </div>

      {/* ── ٢) الاستخدام ── */}
      {usage && (
        <div className="card" style={card}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 15 }}>📊 {t("account.usage")}</div>
          <div style={{ display: "grid", gap: 15 }}>
            <Meter icon="🏢" label={t("account.companiesUsed")} used={usage.companies.used} max={usage.companies.max} />
            <Meter icon="👥" label={t("account.customersUsed")} used={usage.customers.used} max={usage.customers.max} />
            <Meter icon="🤖" label={t("account.aiUsed")} sub={t("account.thisMonth")} used={usage.aiInvoices.used} max={usage.aiInvoices.max} />
          </div>
        </div>
      )}

      {/* ── ٣) الخطط والترقية ── */}
      <div className="card" style={card}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 13 }}>💳 {t("account.upgradeTitle")}</div>

        {pending && (
          <div style={{ background: "var(--ia-warn-bg)", border: "1px solid var(--ia-warn-bd)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 13 }}>
            <b style={{ color: "var(--ia-warn-tx)", fontSize: 13 }}>⏳ {t("account.pendingRequest")} → {pendingPlanName}</b>
            <button className="btn acc-btn" onClick={cancelRequest} disabled={reqBusy} style={{ background: "transparent", border: "1.5px solid var(--ia-warn-bd)", color: "var(--ia-warn-tx)", cursor: reqBusy ? "not-allowed" : "pointer", padding: "7px 16px" }}>
              {reqBusy ? "⏳ …" : "🗑️ " + t("account.cancelRequest")}
            </button>
          </div>
        )}

        {plansLoading ? (
          <div className="acc-plans">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 16, border: "1px solid var(--ia-border)" }}>
                <div className="sk sk-lg" style={{ width: "60%", marginBottom: 12 }} />
                <div className="sk" style={{ height: 26, width: 90, marginBottom: 12 }} />
                <div className="sk sk-sm" style={{ width: "85%", marginBottom: 8 }} />
                <div className="sk sk-sm" style={{ width: "70%", marginBottom: 12 }} />
                <div className="sk" style={{ height: 34 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="acc-plans">
            {plans.map((p) => {
              const isCur = p.code === curPlanCode;
              const pendingHere = pending?.planCode === p.code;
              return (
                <div
                  key={p.code}
                  className="card"
                  style={{
                    padding: 16, display: "flex", flexDirection: "column", gap: 9,
                    border: isCur ? "1.5px solid #c9a227" : "1px solid var(--ia-border)",
                    boxShadow: isCur ? "0 5px 18px rgba(201,162,39,.22)" : undefined,
                  }}
                >
                  {isCur && (
                    <span style={{ alignSelf: "flex-start", background: "rgba(201,162,39,.15)", color: "#9a7318", border: "1px solid rgba(201,162,39,.4)", borderRadius: 30, padding: "3px 12px", fontSize: 10.5, fontWeight: 800 }}>
                      ✓ {t("pricing.currentPlan")}
                    </span>
                  )}
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15.5 }}>{p.nameAr}</div>
                    {p.descAr && <div style={{ color: "var(--ia-sub)", fontSize: 11.5, lineHeight: 1.7, marginTop: 3 }}>{p.descAr}</div>}
                  </div>

                  {!isCur && (
                    <div style={{ paddingBottom: 8, borderBottom: "1px dashed var(--ia-border)" }}>
                      <div dir="ltr" style={{ fontSize: 21, fontWeight: 900, color: "#9a7318", lineHeight: 1.2 }}>
                        {p.priceLocal?.formatted || `${p.priceUsd} USD`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ia-sub)", fontWeight: 700 }}>/ {t("pricing.perMonth")}</div>
                      <div dir="ltr" style={{ fontSize: 10.5, color: "var(--ia-muted)", marginTop: 2 }}>
                        {t("pricing.baseCurrency")}: $ {p.priceUsd} USD
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gap: 5 }}>
                    {quotaRows(p).map(([icon, label, max]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                        <span aria-hidden="true">{icon}</span>
                        <span style={{ flex: 1, color: "var(--ia-sub)", fontWeight: 600 }}>{label}</span>
                        <b dir="ltr" style={{ fontSize: 12 }}>{max}</b>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: 6 }}>
                    {pendingHere ? (
                      <span style={{ display: "block", textAlign: "center", background: "var(--ia-warn-bg)", color: "var(--ia-warn-tx)", borderRadius: 8, padding: "9px 10px", fontSize: 11.5, fontWeight: 800 }}>
                        ⏳ {t("pricing.requestPending")}
                      </span>
                    ) : !isCur && (
                      noteOpenFor === p.code ? (
                        <div style={{ display: "grid", gap: 7 }}>
                          <label style={{ fontSize: 10.5, color: "var(--ia-sub)", fontWeight: 800 }}>{t("account.requestNote")}</label>
                          <textarea
                            className="inp"
                            rows={2}
                            maxLength={300}
                            placeholder={t("account.requestNotePlaceholder")}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            style={{ resize: "vertical", minHeight: 44 }}
                          />
                          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                            <button className="btn acc-btn" onClick={() => sendRequest(p.code, note.trim())} disabled={reqBusy} style={{ background: "#16a34a", color: "#fff", cursor: reqBusy ? "not-allowed" : "pointer", padding: "8px 16px" }}>
                              {reqBusy ? "⏳ …" : "📨 " + t("account.sendRequest")}
                            </button>
                            <button className="btn acc-btn" onClick={() => { setNoteOpenFor(null); setNote(""); }} style={{ background: "var(--ia-ghost-bg)", color: "var(--ia-sub)", padding: "8px 14px" }}>
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn acc-btn" onClick={() => { setNoteOpenFor(p.code); setNote(""); }} style={{ width: "100%", justifyContent: "center", background: "linear-gradient(135deg,#1e3a5f,#2c5282)", color: "#fff", padding: "9px 12px" }}>
                          ⬆️ {t("pricing.requestUpgrade")}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ٤) شركاتك ── */}
      <div className="card" style={card}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 11 }}>🏢 {t("account.companiesList")}</div>
        {Array.isArray(profile.companies) && profile.companies.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {profile.companies.map((slug) => (
              <span key={slug} dir="ltr" style={{ background: "var(--ia-chip)", border: "1px solid var(--ia-border)", color: "var(--ia-text2)", borderRadius: 30, padding: "5px 13px", fontSize: 11.5, fontWeight: 700 }}>
                {slug}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--ia-muted)", fontSize: 12 }}>—</div>
        )}
      </div>
    </div>
  );
}

const STYLE = `
@keyframes accFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.acc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:13px}
.acc-plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:12px}
.acc-scroll{scrollbar-width:thin;scrollbar-color:var(--ia-border2) transparent}
.acc-scroll::-webkit-scrollbar{width:8px}
.acc-scroll::-webkit-scrollbar-track{background:transparent;border-radius:8px}
.acc-scroll::-webkit-scrollbar-thumb{background:var(--ia-border2);border-radius:8px}
.acc-scroll::-webkit-scrollbar-thumb:hover{background:var(--ia-muted)}
.btn.acc-btn:focus-visible,.inp:focus-visible,select.inp:focus-visible{outline:2.5px solid #c9a227;outline-offset:2px}
@media(max-width:480px){
  .acc-grid{grid-template-columns:1fr}
  .acc-plans{grid-template-columns:1fr}
  .btn.acc-btn{min-height:44px}
}
`;

export default function AccountPanel({ toast_ }) {
  return (
    <LangProvider>
      <AccountInner toast_={toast_} />
    </LangProvider>
  );
}
