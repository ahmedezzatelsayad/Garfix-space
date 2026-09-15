"use client";

import { useState, useEffect, useCallback } from "react";
import { tr } from "@/lib/i18n-app";

/**
 * r16: لوحة المؤسس — إعداد Resend (بريد «هل نسيت كلمة السر؟»)
 * - مفتاح API + بريد المرسل يُخزَّنان خادمياً (GET/PUT /api/admin/resend)
 * - زر اختبار إرسال فعلي لأي بريد يحدده المؤسس (POST /api/admin/resend)
 */
export default function ResendPanel({ toast_ }) {
  const [cfg, setCfg] = useState(null); // {from, fromName, configured, apiKeyMasked}
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [from, setFrom] = useState("onboarding@resend.dev");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resend");
      if (res.ok) {
        const data = await res.json();
        setCfg(data.config);
        setFrom(data.config.from || "onboarding@resend.dev");
        setFromName(data.config.fromName || "");
      } else {
        setCfg(null);
      }
    } catch {
      setCfg(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { from, fromName };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      const res = await fetch("/api/admin/resend", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCfg(data.config);
      setApiKey("");
      toast_(tr("✅ تم حفظ إعدادات Resend"));
    } catch (e) {
      toast_("❌ " + (e.message || tr("فشل الحفظ")), "err");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      const res = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast_(tr("📨 أُرسل بريد الاختبار — تحقق من صندوق الوارد"));
    } catch (e) {
      toast_("❌ " + (e.message || tr("فشل الإرسال")), "err");
    } finally {
      setTesting(false);
    }
  };

  const lbl = { fontSize: "11px", color: "var(--ia-sub)", display: "block", marginBottom: "4px", fontWeight: 700 };
  const inp = { width: "100%", border: "1.5px solid var(--ia-border2)", borderRadius: 8, padding: "9px 12px", fontFamily: "inherit", fontSize: 13, background: "var(--ia-card)", color: "var(--ia-text)", outline: "none" };
  const card = { background: "var(--ia-card)", borderRadius: 14, padding: "18px 20px", border: "1px solid var(--ia-border)" };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "var(--ia-sub)" }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>{tr("جارٍ تحميل إعدادات البريد...")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>

      {/* الشرح */}
      <div style={{ ...card, fontSize: 12.5, color: "var(--ia-sub)", lineHeight: 1.9, background: "var(--ia-soft)" }}>
        {tr("📧 خدمة البريد")} <b dir="ltr">Resend</b> {tr("تشغّل ميزة")} <b>{tr("«هل نسيت كلمة السر؟»")}</b> {tr("— عند طلب أي مشترك استعادة كلمة مروره\n        يُرسل له رابط إعادة التعيين بريدياً (صالح 30 دقيقة ولمرة واحدة).")}<br />
        {tr("أنشئ حساباً في")} <span dir="ltr">resend.com</span>{tr("، انسخ مفتاح API (يبدأ بـ")} <span dir="ltr">re_</span>{tr(") والصقه هنا.")}
      </div>

      {/* الحالة */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 22 }}>{cfg?.configured ? "✅" : "⚪"}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: cfg?.configured ? "var(--ia-ok-tx)" : "var(--ia-sub)" }}>
            {cfg?.configured ? tr("خدمة البريد مهيأة وتعمل") : tr("غير مهيأة — أضف المفتاح أدناه")}
          </div>
          {cfg?.configured && (
            <div style={{ fontSize: 11.5, color: "var(--ia-muted)", marginTop: 3, direction: "ltr", textAlign: "start" }}>
              {cfg.apiKeyMasked} → {cfg.from}
            </div>
          )}
        </div>
      </div>

      {/* الإعدادات */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>{tr("⚙️ بيانات الاتصال")}</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={lbl}>{tr("مفتاح Resend API")} {cfg?.configured ? tr("(اتركه فارغاً للإبقاء على الحالي)") : "*"}</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, paddingInlineEnd: 40, direction: "ltr", textAlign: "start" }}
                type={showKey ? "text" : "password"}
                placeholder="re_XXXXXXXXXXXXXXXX"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <span onClick={() => setShowKey(s => !s)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", fontSize: 14, opacity: .5 }}>
                {showKey ? "🙈" : "👁️"}
              </span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>{tr("بريد المرسل")}</label>
              <input style={{ ...inp, direction: "ltr", textAlign: "start" }} placeholder="onboarding@resend.dev" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>{tr("اسم المرسل (اختياري)")}</label>
              <input style={inp} placeholder={tr("نظام إدارة الحسابات")} value={fromName} onChange={e => setFromName(e.target.value)} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ia-muted)", lineHeight: 1.7 }}>
            {tr("💡 بياناتك المجانية في Resend تستخدم")} <span dir="ltr">onboarding@resend.dev</span> {tr("— للبريد باسم نطاقك فعّل نطاقك من لوحة Resend أولاً.")}
          </div>
          <div>
            <button
              onClick={save}
              disabled={saving || (!apiKey.trim() && !cfg?.configured)}
              style={{
                border: "none", borderRadius: 8, padding: "10px 24px", fontFamily: "inherit",
                fontSize: 13, fontWeight: 800, cursor: (saving || (!apiKey.trim() && !cfg?.configured)) ? "not-allowed" : "pointer",
                background: (saving || (!apiKey.trim() && !cfg?.configured)) ? "var(--ia-ghost-bg)" : "linear-gradient(135deg,#1e3a5f,#2563eb)",
                color: (saving || (!apiKey.trim() && !cfg?.configured)) ? "var(--ia-muted)" : "#fff",
              }}
            >
              {saving ? tr("⏳ جارٍ الحفظ...") : tr("💾 حفظ الإعدادات")}
            </button>
          </div>
        </div>
      </div>

      {/* اختبار الإرسال */}
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{tr("🧪 اختبار الإرسال")}</div>
        <div style={{ fontSize: 11.5, color: "var(--ia-muted)", marginBottom: 12, lineHeight: 1.7 }}>
          {tr("أرسل بريداً تجريبياً لأي عنوان تملكه للتأكد أن المفتاح والمرسل يعملان فعلاً.")}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ ...inp, flex: 1, minWidth: 220, direction: "ltr", textAlign: "start" }}
            type="email"
            placeholder="your@email.com"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendTest()}
          />
          <button
            onClick={sendTest}
            disabled={testing || !testTo.trim() || !cfg?.configured}
            style={{
              border: "none", borderRadius: 8, padding: "10px 22px", fontFamily: "inherit",
              fontSize: 13, fontWeight: 800, cursor: (testing || !testTo.trim() || !cfg?.configured) ? "not-allowed" : "pointer",
              background: (testing || !testTo.trim() || !cfg?.configured) ? "var(--ia-ghost-bg)" : "#16a34a",
              color: (testing || !testTo.trim() || !cfg?.configured) ? "var(--ia-muted)" : "#fff",
            }}
          >
            {testing ? tr("⏳ جارٍ الإرسال...") : tr("📨 أرسل بريداً تجريبياً")}
          </button>
        </div>
      </div>
    </div>
  );
}
