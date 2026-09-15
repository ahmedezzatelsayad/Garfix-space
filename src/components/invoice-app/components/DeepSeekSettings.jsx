"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme, txAdapt, softAdapt } from "../theme";
import { tr } from "@/lib/i18n-app";

/* r10: صفحة DeepSeek — إضافة مفتاح API، اختبار الاتصال الفعلي،
 * واختيار الموديل من الموديلات المدفوعة (deepseek-chat / deepseek-reasoner).
 * عند التفعيل تمرّ كل مميزات الذكاء الاصطناعي في المشروع عبر DeepSeek
 * مع سقوط تلقائي آمن للمزوّد المدمج عند أي تعطل.
 */

const DS_BLUE = "#2563eb";
const DS_DARK = "#0f2f6b";

export default function DeepSeekSettings({ company }) {
  const col = company?.color || "#1e3a5f";
  const { dark } = useTheme();

  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, latencyMs, models, reply, error}
  const [toast, setToast] = useState(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const toast_ = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/config");
      const data = await res.json();
      setCfg(data);
      setBaseUrl(data.baseUrl || "https://api.deepseek.com");
      setModel(data.model || "deepseek-chat");
      setEnabled(!!data.enabled);
      setApiKey("");
    } catch {
      toast_(tr("تعذّر تحميل الإعدادات"), "warn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ————— الحفظ ————— */
  const save = async (silent = false) => {
    setSaving(true);
    try {
      const body = { baseUrl, model };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!silent) toast_(tr("✅ تم حفظ إعدادات DeepSeek"));
      setApiKey("");
      await load();
    } catch (e) {
      toast_(e.message || tr("فشل الحفظ"), "warn");
    } finally {
      setSaving(false);
    }
  };

  /* ————— اختبار الاتصال ————— */
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const body = { baseUrl, model };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast_(tr("✅ الاتصال ناجح — {0} ملّي ثانية",[data.latencyMs]));
        setApiKey("");
        await load();
      } else {
        toast_(tr("❌ فشل الاتصال — انظر التفاصيل"), "warn");
      }
    } catch (e) {
      setTestResult({ ok: false, error: e.message });
      toast_(tr("❌ تعذّر إجراء الاختبار"), "warn");
    } finally {
      setTesting(false);
    }
  };

  /* ————— تفعيل / تعطيل ————— */
  const toggleEnabled = async () => {
    if (enabled) {
      if (!confirmOff) { setConfirmOff(true); return; }
      setConfirmOff(false);
    }
    const next = !enabled;
    if (next && !cfg?.hasKey && !apiKey.trim()) {
      toast_(tr("أدخل مفتاح API واختبره أولاً قبل التفعيل"), "warn");
      return;
    }
    setEnabled(next);
    try {
      const res = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast_(next ? tr("🔵 تم تفعيل DeepSeek لكل مميزات الذكاء الاصطناعي") : tr("⏸️ تم التحويل للمزوّد المدمج"));
      setApiKey("");
      await load();
    } catch (e) {
      setEnabled(!next);
      toast_(e.message || tr("فشل التبديل"), "warn");
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="sk sk-lg" style={{ width: "40%", marginBottom: 12 }} />
        <div className="sk sk-sm" style={{ width: "80%", marginBottom: 8 }} />
        <div className="sk sk-sm" style={{ width: "60%" }} />
      </div>
    );
  }

  const MODELS = cfg?.models || [];
  const activeModel = MODELS.find(m => m.id === model);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp .25s" }}>
      {toast && (
        <div style={{
          position: "sticky", top: 60, zIndex: 50, alignSelf: "center",
          background: toast.type === "warn" ? "#f59e0b" : "#16a34a", color: "#fff",
          padding: "8px 22px", borderRadius: 50, fontWeight: 800, fontSize: 13,
          boxShadow: "0 4px 16px rgba(0,0,0,.2)", animation: "toastIn .2s",
        }}>{toast.msg}</div>
      )}

      {/* ————— بطاقة الحالة ————— */}
      <div className="card" style={{
        padding: "18px 20px",
        background: enabled
          ? `linear-gradient(135deg, ${softAdapt("#dbeafe", dark)}, ${dark ? DS_DARK + "cc" : "#eff6ff"})`
          : "var(--ia-card)",
        border: `1.5px solid ${enabled ? txAdapt(DS_BLUE, dark) + "55" : "var(--ia-border)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${DS_BLUE}, ${DS_DARK})`, color: "#fff", fontSize: 15, fontWeight: 900,
            boxShadow: `0 6px 18px ${DS_BLUE}44`, flexShrink: 0, letterSpacing: "-.5px",
          }}>DS</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{tr("DeepSeek API — مزوّد الذكاء الاصطناعي")}</div>
            <div style={{ fontSize: 12.5, color: "var(--ia-sub)", marginTop: 2 }}>
              {tr("معالجة كل مميزات الذكاء الاصطناعي في المشروع: المساعد الذكي 🤖 + معالجة العناصر 📦")}
            </div>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: enabled ? softAdapt("#dcfce7", dark) : softAdapt("#f1f5f9", dark),
            color: enabled ? txAdapt("#15803d", dark) : "var(--ia-sub)",
            borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 800,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: enabled ? "#16a34a" : "var(--ia-muted)", boxShadow: enabled ? "0 0 0 3px rgba(34,197,94,.25)" : "none" }} />
            {enabled ? tr("مفعّل — الموديل المدفوع يعمل") : cfg?.hasKey ? tr("معطّل — المزوّد المدمج يعمل") : tr("غير مضبوط — المزوّد المدمج يعمل")}
          </span>
        </div>

        {cfg?.lastTestedAt && (
          <div style={{
            marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "8px 12px", borderRadius: 10, fontSize: 12,
            background: cfg.lastTestOk ? softAdapt("#f0fdf4", dark) : softAdapt("#fef2f2", dark),
            border: `1px solid ${cfg.lastTestOk ? txAdapt("#86efac", dark) + "66" : txAdapt("#fca5a5", dark) + "66"}`,
          }}>
            <span>{cfg.lastTestOk ? "✅" : "❌"}</span>
            <b>{tr("آخر اختبار:")}</b>
            <span>{new Date(cfg.lastTestedAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</span>
            {cfg.lastTestModel && <span dir="ltr" style={{ fontFamily: "monospace" }}>({cfg.lastTestModel})</span>}
            {cfg.lastTestLatency != null && <span style={{ direction: "ltr" }}>— {cfg.lastTestLatency}ms</span>}
            {cfg.lastTestError && <span style={{ color: txAdapt("#b91c1c", dark), fontSize: 11 }}>— {cfg.lastTestError.slice(0, 120)}</span>}
          </div>
        )}
      </div>

      {/* ————— المفتاح ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 17 }}>🔑</span>
          <b style={{ fontSize: 14 }}>{tr("مفتاح API")}</b>
          {cfg?.hasKey && (
            <span style={{ fontSize: 11.5, color: "var(--ia-sub)", background: softAdapt("#f1f5f9", dark), padding: "3px 10px", borderRadius: 20, direction: "ltr", fontFamily: "monospace" }}>
              {tr("محفوظ:")} {cfg.keyMasked}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <input className="inp" type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={cfg?.hasKey ? tr("أدخل مفتاحاً جديداً للاستبدال — أو اتركه فارغاً للإبقاء") : "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              dir="ltr" style={{ paddingInlineEnd: 40, fontFamily: "monospace", fontSize: 13 }} autoComplete="off" />
            <button type="button" onClick={() => setShowKey(s => !s)} title={showKey ? tr("إخفاء") : tr("إظهار")}
              style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 15, padding: 4 }}>
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ia-sub)", marginTop: 8, lineHeight: 1.8 }}>
          {tr("💡 احصل على المفتاح من")} <b dir="ltr">platform.deepseek.com</b> {tr("— يُخزَّن في قاعدة البيانات على خادمك فقط ولا يظهر أبداً في الواجهة أو النسخ الاحتياطية.")}
          {!cfg?.hasKey && <> {tr("اتركه فارغاً الآن والصق مفتاحك ثم اضغط «اختبار الاتصال» (الاختبار يحفظه تلقائياً).")}</>}
        </div>

        {/* رابط الخدمة (متقدم) */}
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: "var(--ia-sub)", cursor: "pointer", fontWeight: 700 }}>{tr("⚙️ إعدادات متقدمة — رابط الخدمة (Base URL)")}</summary>
          <input className="inp" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} dir="ltr"
            style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12.5 }} placeholder="https://api.deepseek.com" />
        </details>
      </div>

      {/* ————— اختيار الموديل المدفوع ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 17 }}>💎</span>
          <b style={{ fontSize: 14 }}>{tr("اختيار الموديل (مدفوع)")}</b>
          <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>{tr("(تُحتسب بالاستخدام من رصيد DeepSeek)")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          {MODELS.map(m => {
            const sel = model === m.id;
            return (
              <button key={m.id} onClick={() => setModel(m.id)}
                style={{
                  textAlign: "start", cursor: "pointer", fontFamily: "inherit",
                  border: `2px solid ${sel ? txAdapt(DS_BLUE, dark) : "var(--ia-border2)"}`,
                  borderRadius: 12, padding: "14px 16px",
                  background: sel ? softAdapt("#eff6ff", dark) : "var(--ia-card)",
                  boxShadow: sel ? `0 4px 16px ${DS_BLUE}22` : "none",
                  transform: sel ? "translateY(-1px)" : "none",
                  transition: "all .18s", position: "relative",
                }}>
                {sel && <span style={{ position: "absolute", top: 10, left: 12, fontSize: 15 }}>✅</span>}
                <div style={{ fontWeight: 900, fontSize: 13.5, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{m.id === "deepseek-reasoner" ? "🧠" : "⚡"}</span>
                  <span dir="ltr">{m.name}</span>
                </div>
                <div style={{ fontSize: 11, color: txAdapt(DS_BLUE, dark), fontWeight: 800, marginBottom: 6 }}>{m.tag}</div>
                <div style={{ fontSize: 11.5, color: "var(--ia-sub)", lineHeight: 1.7, marginBottom: 10 }}>{m.desc}</div>
                <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: "var(--ia-sub)" }}>
                  <span style={{ flex: 1 }}>
                    {tr("السرعة")}
                    <Bars n={m.speed} color="#16a34a" dark={dark} />
                  </span>
                  <span style={{ flex: 1 }}>
                    {tr("العمق")}
                    <Bars n={m.depth} color="#7c3aed" dark={dark} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {activeModel && model === "deepseek-reasoner" && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--ia-sub)", background: softAdapt("#fef3c7", dark), padding: "8px 12px", borderRadius: 8, lineHeight: 1.8 }}>
            {tr("🧠 موديل التفكير يعرض «سلسلة التفكير» في المساعد الذكي قبل الجواب النهائي — مثالي للتحليل المالي المعقّد لكنه أبطأ.")}
          </div>
        )}
      </div>

      {/* ————— أزرار التحكم ————— */}
      <div className="card" style={{ padding: "16px 20px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" onClick={() => save()} disabled={saving || testing}
          style={{ background: DS_BLUE, color: "#fff", minWidth: 130, justifyContent: "center" }}>
          {saving ? tr("⏳ جارٍ الحفظ…") : tr("💾 حفظ الإعدادات")}
        </button>
        <button className="btn" onClick={test} disabled={testing || saving || (!cfg?.hasKey && !apiKey.trim())}
          style={{ background: "#16a34a", color: "#fff", minWidth: 150, justifyContent: "center" }}>
          {testing ? tr("🔄 جارٍ اختبار الاتصال…") : tr("🔌 اختبار الاتصال")}
        </button>
        <button
          className={`btn ${enabled ? "btn-red" : ""}`}
          onClick={toggleEnabled}
          disabled={(!cfg?.hasKey && !apiKey.trim() && !enabled) || saving || testing}
          style={enabled ? {} : { background: col, color: "#fff" }}>
          {enabled ? (confirmOff ? tr("⚠️ متأكد؟ اضغط مجدداً للتعطيل") : tr("🚫 تعطيل DeepSeek")) : tr("🔵 تفعيل DeepSeek")}
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>
          {tr("المفعّل حالياً:")} <b dir="ltr">{enabled ? cfg?.model : tr("المزوّد المدمج")}</b>
        </span>
      </div>

      {/* ————— نتيجة الاختبار ————— */}
      {testing && (
        <div className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>🔄</div>
          <b style={{ fontSize: 13 }}>{tr("جارٍ اختبار الاتصال الفعلي…")}</b>
          <div style={{ fontSize: 11.5, color: "var(--ia-sub)", marginTop: 4 }}>{tr("جلب قائمة الموديلات + إكمال مصغّر وقياس زمن الاستجابة")}</div>
        </div>
      )}
      {testResult && !testing && (
        <div className="card" style={{
          padding: "16px 20px",
          border: `1.5px solid ${testResult.ok ? txAdapt("#86efac", dark) : txAdapt("#fca5a5", dark)}`,
          background: testResult.ok ? softAdapt("#f0fdf4", dark) : softAdapt("#fef2f2", dark),
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>{testResult.ok ? "✅" : "❌"}</span>
            <b style={{ fontSize: 14 }}>{testResult.ok ? tr("الاتصال ناجح — المفتاح يعمل") : tr("فشل الاتصال")}</b>
            {testResult.ok && (
              <span style={{ fontSize: 11.5, fontWeight: 800, background: softAdapt("#dcfce7", dark), color: txAdapt("#15803d", dark), padding: "3px 12px", borderRadius: 20, direction: "ltr" }}>
                ⏱ {testResult.latencyMs}ms
              </span>
            )}
          </div>
          {testResult.models?.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {testResult.models.map(mid => (
                <span key={mid} dir="ltr" style={{
                  fontSize: 11, fontFamily: "monospace", padding: "3px 10px", borderRadius: 6,
                  background: softAdapt("#eff6ff", dark), color: txAdapt(DS_BLUE, dark), fontWeight: 700,
                  border: `1px solid ${mid === model ? txAdapt(DS_BLUE, dark) : "transparent"}`,
                }}>
                  {mid === model ? "★ " : ""}{mid}
                </span>
              ))}
            </div>
          ) : null}
          {testResult.reply && (
            <div style={{ fontSize: 12, color: "var(--ia-sub)" }}>{tr("ردّ نموذج الاختبار: «")}{testResult.reply}»</div>
          )}
          {testResult.error && (
            <div style={{ fontSize: 12, color: txAdapt("#b91c1c", dark), fontFamily: "monospace", direction: "ltr", textAlign: "end", background: softAdapt("#fee2e2", dark), padding: "8px 10px", borderRadius: 8, wordBreak: "break-all" }}>
              {testResult.error}
            </div>
          )}
        </div>
      )}

      {/* ————— كيف يعمل ————— */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 17 }}>🧭</span><b style={{ fontSize: 14 }}>{tr("كيف يعمل التوجيه؟")}</b>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          {[
            { icon: "🔵", t: tr("DeepSeek مفعّل"), d: tr("كل استدعاءات الذكاء (المساعد الذكي، معالجة العناصر بالـ AI) تذهب إلى DeepSeek بالموديل المختار — بثّ حيّ حقيقي.") },
            { icon: "🟢", t: tr("سقوط آمن تلقائي"), d: tr("إن تعطّل DeepSeek أو انتهت صلاحيته، يكمل النظام فوراً بالمزوّد المدمج دون توقف الخدمة.") },
            { icon: "🗄️", t: tr("محفوظات على الخادم"), d: tr("المحادثات ورسائلها تُخزَّن في PostgreSQL مع الكاش في Valkey — تعمل من أي جهاز.") },
          ].map((x, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: softAdapt("#f8fafc", dark), border: "1px solid var(--ia-border)" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{x.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 3 }}>{x.t}</div>
              <div style={{ fontSize: 11.5, color: "var(--ia-sub)", lineHeight: 1.8 }}>{x.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bars({ n, color, dark }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, marginInlineStart: 6, verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{
          width: 5, height: 6, borderRadius: 2,
          background: i <= n ? txAdapt(color, dark) : softAdapt("#e2e8f0", dark),
          display: "inline-block",
        }} />
      ))}
    </span>
  );
}
