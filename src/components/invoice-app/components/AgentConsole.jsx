"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme, txAdapt, softAdapt } from "../theme";
import { tr, appDir, companyName } from "@/lib/i18n-app";

/* المرحلة 2 (Agent Engine): وحدة تحكم الوكيل — حلقة Think→Act→Observe مباشرة.
 *
 * ما يميزها عن المساعد الذكي (SmartChat):
 *  - الوكيل ينفّذ أدوات حقيقية (8 أدوات) ويرى نتائجها ويكمل — الحلقة معروضة
 *    مباشرة: 💭 كل فكرة، 🔧 كل استدعاء أداة، 👁 كل نتيجة، ثم الجواب النهائي.
 *  - وضعان: 🔒 قراءة فقط (افتراضي — الكتابة تتحول بطاقة تأكيد يضغطها المستخدم)
 *    و⚡ تنفيذ تلقائي (للمدير — ضمن الحواجز: سقف مالي، لا حذف).
 *  - سجل تدقيق كامل: كل استدعاء أداة مدوَّن في agent_audit_log ويعرض هنا.
 *  - لحظة الإبهار: «اعمل شركة تبيع ملابس ومتجر ليها» — شركة ERP + متجر
 *    Garfix Stores حقيقي بجملة واحدة (الطلبات تتدفق فواتير تلقائياً).
 */

const TOOL_META = {
  search: { icon: "🔍", title: "بحث" },
  list_invoices: { icon: "🧾", title: "الفواتير" },
  list_customers: { icon: "👥", title: "العملاء" },
  list_payments: { icon: "💳", title: "المدفوعات" },
  company_stats: { icon: "📊", title: "الإحصائيات" },
  create_company: { icon: "🏢", title: "إنشاء شركة" },
  create_store: { icon: "🏬", title: "إنشاء متجر Garfix Stores" },
  update_invoice_status: { icon: "✏️", title: "تحديث حالة فاتورة" },
};

const SUGGESTIONS = [
  { icon: "🏬", text: "اعمل شركة تبيع ملابس ومتجر ليها", highlight: true },
  { icon: "📊", text: "إحصائيات الشركة الحالية وأهم المؤشرات" },
  { icon: "⏳", text: "شو الفواتير غير المدفوعة؟ رتّبها بالأولوية" },
  { icon: "👥", text: "مين أعلى العملاء مديونية؟" },
  { icon: "🔍", text: "ابحث عن العميل سارة" },
  { icon: "✏️", text: "حدّث حالة فاتورة INV1001 إلى مُرسلة" },
];

const BLOCKED_LABELS = {
  READONLY_MODE: "بانتظار تأكيدك",
  AMOUNT_CAP: "حاجز السقف المالي",
  NOT_ADMIN: "يتطلب صلاحيات أعلى",
  NO_SUCH_TOOL: "أداة غير معروفة",
  INVALID_ARGS: "وسائط غير صالحة",
  STORES_UNREACHABLE: "منصة المتاجر غير متاحة",
};

export default function AgentConsole({ company, onDataChanged }) {
  const col = company?.color || "#1e3a5f";
  const sk = company?.sk || "";
  const { dark } = useTheme();
  const dir = appDir();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState("readonly"); // readonly | auto
  const [meta, setMeta] = useState(null); // {model, provider, runId}
  const [error, setError] = useState("");
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState(null); // {entries, toolCounts}
  const [auditLoading, setAuditLoading] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const cardBg = "var(--ia-card)";
  const border = "var(--ia-border)";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  /* ————— تحديث بيانات التطبيق بعد نجاح كتابة ————— */
  const notifyDataChanged = useCallback(() => {
    if (typeof onDataChanged === "function") onDataChanged();
  }, [onDataChanged]);

  /* ————— استهلاك بثّ الوكيل (SSE) ————— */
  const runAgent = async (payload, userText) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    setMeta(null);
    setError("");

    // الرسالة الحالية للوكيل — تُبنى تدريجياً من أحداث الحلقة
    let agentMsg = { role: "agent", content: "", turns: [], tools: [], confirm: null, done: false };
    const pushAgent = () => setMessages(prev => [...prev, agentMsg]);
    const patchAgent = fn => {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "agent") copy[copy.length - 1] = fn({ ...last });
        return copy;
      });
    };
    if (userText != null) {
      setMessages(prev => [...prev, { role: "user", content: userText }]);
    }
    pushAgent();

    let wroteSomething = false;

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          companySlug: sk || undefined,
          companyName: companyName(company),
          history: messages
            .filter(m => (m.role === "user" || m.role === "agent") && (m.role === "user" ? m.content : m.content))
            .slice(-6)
            .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.role === "user" ? m.content : m.content || "…" })),
          mode: modeRef.current,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawToolOk = false;

      const handleEvent = (ev, dataStr) => {
        let data = {};
        try { data = JSON.parse(dataStr); } catch { return; }
        if (ev === "meta") {
          setMeta({ model: data.model, provider: data.provider, runId: data.runId, mode: data.mode });
          agentMsg.meta = { model: data.model, provider: data.provider, runId: data.runId };
          patchAgent(m => ({ ...m, meta: agentMsg.meta }));
        } else if (ev === "turn_start") {
          agentMsg.turns.push({ text: "", hasToolCall: false, done: false });
          patchAgent(m => ({ ...m, turns: [...agentMsg.turns] }));
        } else if (ev === "thought") {
          const t = agentMsg.turns[agentMsg.turns.length - 1];
          if (t) { t.text += data.text || ""; t.done = false; }
          patchAgent(m => ({ ...m, turns: [...agentMsg.turns] }));
        } else if (ev === "turn_end") {
          const t = agentMsg.turns[agentMsg.turns.length - 1];
          if (t) { t.hasToolCall = !!data.hasToolCall; t.done = true; }
          patchAgent(m => ({ ...m, turns: [...agentMsg.turns] }));
          // الجواب النهائي = نص آخر دور بلا أداة
          if (!data.hasToolCall && t) agentMsg.content = t.text;
        } else if (ev === "tool_call") {
          agentMsg.tools.push({
            tool: data.tool, kind: data.kind, args: data.args || {},
            ok: null, blocked: null, summary: "", durationMs: null, running: true,
          });
          patchAgent(m => ({ ...m, tools: [...agentMsg.tools] }));
        } else if (ev === "tool_result") {
          const t = agentMsg.tools[agentMsg.tools.length - 1];
          if (t) {
            t.running = false;
            t.ok = !!data.ok;
            t.blocked = data.blocked || null;
            t.summary = data.summary || "";
            t.durationMs = data.durationMs ?? null;
          }
          patchAgent(m => ({ ...m, tools: [...agentMsg.tools] }));
          if (data.ok) { sawToolOk = true; wroteSomething = true; }
        } else if (ev === "confirmation_required") {
          agentMsg.confirm = { token: data.token, actions: data.actions || [], pending: true };
          patchAgent(m => ({ ...m, confirm: agentMsg.confirm }));
        } else if (ev === "final") {
          agentMsg.content = data.text || "";
          patchAgent(m => ({ ...m, content: agentMsg.content }));
        } else if (ev === "error") {
          setError(data.error || "خطأ من محرك الوكيل");
        } else if (ev === "done") {
          agentMsg.done = true;
          agentMsg.steps = data.steps;
          agentMsg.latencyMs = data.latencyMs;
          patchAgent(m => ({ ...m, done: true, steps: data.steps, latencyMs: data.latencyMs }));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          let ev = "";
          let dataLines = [];
          for (const line of lines) {
            if (line.startsWith("event: ")) ev = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
          }
          if (ev) handleEvent(ev, dataLines.join("\n"));
        }
      }
      if (sawToolOk) notifyDataChanged();
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "تعذر تشغيل الوكيل");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    await runAgent({ message: text }, text);
  };

  /* ————— تأكيد الأفعال المحجوبة (بطاقة التنفيذ) ————— */
  const confirmActions = async () => {
    // ابحث آخر رسالة فيها بطاقة تأكيد معلّقة
    const idx = [...messages].reverse().findIndex(m => m.role === "agent" && m.confirm && m.confirm.pending);
    if (idx === -1) return;
    const realIdx = messages.length - 1 - idx;
    const token = messages[realIdx].confirm.token;

    // علّم البطاقة كمنفَّذة
    setMessages(prev => {
      const copy = [...prev];
      copy[realIdx] = { ...copy[realIdx], confirm: { ...copy[realIdx].confirm, pending: false, busy: true } };
      return copy;
    });

    const userCtx = messages[realIdx - 1]?.content || "تنفيذ الأفعال المؤكدة";
    await runAgent({ message: userCtx, confirmToken: token }, null);
    setMessages(prev => {
      const copy = [...prev];
      copy[realIdx] = { ...copy[realIdx], confirm: { ...copy[realIdx].confirm, busy: false, resolved: true } };
      return copy;
    });
    loadAudit();
  };

  /* ————— سجل التدقيق ————— */
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/agent/audit?limit=60${sk ? `&company=${encodeURIComponent(sk)}` : ""}`);
      const data = await res.json();
      setAudit(data);
    } catch { /* تجاهل */ }
    setAuditLoading(false);
  }, [sk]);

  useEffect(() => { if (showAudit && !audit) loadAudit(); }, [showAudit, audit, loadAudit]);

  const emptyState = messages.length === 0 && !streaming;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12, animation: "fadeUp .25s" }}>
      <AgentHeader
        col={col} dark={dark} meta={meta} mode={mode} setMode={setMode}
        showAudit={showAudit} setShowAudit={setShowAudit}
        streaming={streaming}
      />

      {showAudit && (
        <AuditPanel
          dark={dark} col={col} audit={audit} loading={auditLoading}
          onRefresh={loadAudit} onClose={() => setShowAudit(false)}
        />
      )}

      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 420 }}>
        <div ref={scrollRef} style={{ maxHeight: "min(56vh, 540px)", minHeight: 300, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {emptyState ? (
            <EmptyState col={col} dark={dark} company={company} onPick={send} mode={mode} />
          ) : (
            messages.map((m, i) => m.role === "user" ? (
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "82%", background: col, color: "#fff",
                  borderRadius: dir === "rtl" ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
                  padding: "10px 14px", fontSize: 13.5, lineHeight: 1.7,
                  boxShadow: `0 2px 10px ${col}33`, whiteSpace: "pre-wrap",
                }}>{m.content}</div>
              </div>
            ) : (
              <AgentMessage
                key={i} m={m} dark={dark} col={col} streaming={streaming}
                onConfirm={confirmActions}
              />
            ))
          )}
          {error && (
            <div style={{ background: softAdapt("#fee2e2", dark), color: txAdapt("#b91c1c", dark), borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 700 }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* منطقة الإدخال */}
        <div style={{ borderTop: `1px solid ${border}`, padding: 12, display: "flex", gap: 8, background: cardBg }}>
          <textarea
            ref={taRef} className="inp" rows={1}
            placeholder={tr("كلّم الوكيل… مثلاً: اعمل شركة تبيع ملابس ومتجر ليها")}
            value={input}
            disabled={streaming}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            style={{ flex: 1, resize: "none", minHeight: 42, maxHeight: 130 }}
          />
          {streaming ? (
            <button className="btn btn-red" onClick={() => abortRef.current?.abort()} style={{ alignSelf: "flex-end", height: 42 }}>
              {tr("⏹ إيقاف")}
            </button>
          ) : (
            <button className="btn" style={{ background: col, color: "#fff", alignSelf: "flex-end", height: 42, minWidth: 84 }} onClick={() => send()} disabled={!input.trim()}>
              {tr("⚡ شغّل")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ————— الهيدر ————— */

function AgentHeader({ col, dark, meta, mode, setMode, showAudit, setShowAudit, streaming }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, #0f766e, #14b8a6)`, fontSize: 22, flexShrink: 0,
        boxShadow: "0 4px 14px rgba(13,148,136,.4)",
      }}>🤖</div>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{tr("وكيل جارفِكس — Agent Engine")}</div>
        <div style={{ fontSize: 11.5, color: "var(--ia-sub)" }}>
          {tr("يخطّط، ينفّذ أدوات حقيقية، ويرى النتائج — Think → Act → Observe")}
          {meta?.model ? tr(" • {0}", [meta.model?.includes("reasoner") ? "🧠 Reasoner" : meta.model]) : ""}
        </div>
      </div>

      {/* مفتاح الوضع */}
      <div style={{ display: "inline-flex", borderRadius: 10, border: `1.5px solid var(--ia-border2)`, overflow: "hidden" }}>
        <button
          onClick={() => setMode("readonly")}
          style={{
            border: "none", padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            background: mode === "readonly" ? softAdapt("#fef3c7", dark) : "transparent",
            color: mode === "readonly" ? txAdapt("#b45309", dark) : "var(--ia-sub)",
            fontFamily: "inherit",
          }}
          title={tr("الوضع الآمن: الكتابات تتحول بطاقة تأكيد تضغطها بنفسك")}
        >🔒 {tr("قراءة فقط")}</button>
        <button
          onClick={() => setMode("auto")}
          style={{
            border: "none", padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer",
            background: mode === "auto" ? softAdapt("#ccfbf1", dark) : "transparent",
            color: mode === "auto" ? txAdapt("#0f766e", dark) : "var(--ia-sub)",
            fontFamily: "inherit",
          }}
          title={tr("تنفيذ فوري ضمن الحواجز: سقف مالي، لا حذف، تدقيق كامل")}
        >⚡ {tr("تنفيذ تلقائي")}</button>
      </div>

      <button className="btn btn-outline" onClick={() => setShowAudit(s => !s)} disabled={streaming}>
        🕵️ {tr("سجل التدقيق")}
      </button>
      {streaming && (
        <span style={{ fontSize: 11, color: "var(--ia-sub)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <PulseDot /> {tr("الحلقة تعمل…")}
        </span>
      )}
    </div>
  );
}

function PulseDot() {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", background: "#14b8a6", display: "inline-block",
      animation: "garfixAgentPulse 1.1s infinite",
    }} />
  );
}

/* ————— الحالة الفارغة ————— */

function EmptyState({ col, dark, company, onPick, mode }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 10px" }}>
      <div style={{ fontSize: 42, marginBottom: 6 }}>🤖</div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{tr("أنا وكيلك — أُنفّذ، لا أكتفي بالكلام")}</div>
      <div style={{ fontSize: 12.5, color: "var(--ia-sub)", marginBottom: 10, maxWidth: 480, marginInline: "auto", lineHeight: 1.8 }}>
        {tr("أفكّر خطوة خطوة، أستدعي أدوات حقيقية في نظامك (فواتير، عملاء، مدفوعات، إحصائيات، شركات، متاجر)، أقرأ النتائج، وأكمّل حتى إنجاز المهمة.") }
        {" "}{tr("كل خطوة تظهر أمامك مباشرة، وكل استدعاء يُدوَّن في سجل التدقيق.")}
      </div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center",
        background: mode === "auto" ? softAdapt("#ccfbf1", dark) : softAdapt("#fef3c7", dark),
        color: mode === "auto" ? txAdapt("#0f766e", dark) : txAdapt("#b45309", dark),
        borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 700, marginBottom: 16,
      }}>
        {mode === "auto" ? tr("⚡ وضع التنفيذ التلقائي: الكتابات تُنفَّذ فوراً ضمن الحواجز") : tr("🔒 وضع القراءة: الكتابات بانتظار تأكيدك بضغطة زر")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8, maxWidth: 680, marginInline: "auto" }}>
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className="btn btn-outline" onClick={() => onPick(tr(s.text))}
            style={{
              justifyContent: "flex-start", textAlign: "start", fontWeight: 600, fontSize: 12.5,
              padding: "10px 12px", height: "auto",
              ...(s.highlight ? { borderColor: softAdapt("#99f6e4", dark), background: softAdapt("#f0fdfa", dark) } : {}),
            }}>
            <span style={{ fontSize: 16 }}>{s.icon}</span> {tr(s.text)}
            {s.highlight && <span style={{ fontSize: 10, fontWeight: 900, color: txAdapt("#0f766e", dark), marginInlineStart: 4 }}>✨</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ————— رسالة الوكيل (أدوار + أدوات + تأكيد + نهائي) ————— */

function AgentMessage({ m, dark, col, streaming, onConfirm }) {
  const bubble = {
    maxWidth: "92%", width: "fit-content",
    background: "var(--ia-ghost-bg)",
    borderRadius: dirless(14, 4), padding: "10px 14px", fontSize: 13.5, lineHeight: 1.75,
    border: "1px solid var(--ia-border)",
  };
  const isWorking = streaming && !m.done && !m.content && !m.turns?.length && !m.tools?.length;

  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{ maxWidth: "94%", width: "fit-content", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>🤖</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("وكيل جارفِكس")}</span>
          {m.meta?.model && <span style={{ fontSize: 10, color: "var(--ia-sub)" }}>{m.meta.model.includes("builtin") ? tr("المدمج") : m.meta.model}</span>}
          {m.steps != null && <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr" }}>{m.steps} {tr("خطوة")}</span>}
          {m.latencyMs ? <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr" }}>{(m.latencyMs / 1000).toFixed(1)}s</span> : null}
        </div>

        {/* أدوار التفكير */}
        {(m.turns || []).map((t, i) => (
          t.text && !t.hasToolCall ? null : (
            <div key={i} style={{ ...bubble, background: softAdapt("#f8fafc", dark), borderColor: "var(--ia-border3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: t.text ? 6 : 0 }}>
                <span style={{ fontSize: 12 }}>💭</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)", textTransform: "uppercase", letterSpacing: ".4px" }}>
                  {tr("فكرة")} {i + 1}{t.hasToolCall ? tr(" → قرار أداة") : ""}
                </span>
                {!t.done && <PulseDot />}
              </div>
              {t.text ? (
                <div style={{ fontSize: 12.5, color: "var(--ia-text2)", maxHeight: 160, overflowY: "auto", lineHeight: 1.7 }}>
                  {t.text.slice(0, 1200)}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <div className="sk sk-sm" style={{ width: 60 }} />
                  <div className="sk sk-sm" style={{ width: 120 }} />
                </div>
              )}
            </div>
          )
        ))}

        {/* استدعاءات الأدوات + نتائجها */}
        {(m.tools || []).map((t, i) => (
          <ToolChip key={i} t={t} dark={dark} col={col} />
        ))}

        {/* بطاقة التأكيد */}
        {m.confirm && (
          <ConfirmCard m={m} dark={dark} col={col} onConfirm={onConfirm} streaming={streaming} />
        )}

        {/* الجواب النهائي */}
        {(m.content || (m.done && !m.confirm && !(m.tools || []).length)) && (
          <div style={{ ...bubble, background: softAdapt("#f0fdfa", dark), borderColor: softAdapt("#99f6e4", dark) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>✅</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: txAdapt("#0f766e", dark), textTransform: "uppercase", letterSpacing: ".4px" }}>
                {tr("النتيجة النهائية")}
              </span>
            </div>
            <div className="agent-md" style={{ fontSize: 13 }}>
              <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* نبض أثناء العمل بلا محتوى بعد */}
        {isWorking && (
          <div style={{ ...bubble, display: "flex", gap: 6, alignItems: "center" }}>
            <PulseDot />
            <span style={{ fontSize: 12, color: "var(--ia-sub)" }}>{tr("الوكيل يفكّر…")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function dirless(a, b) { return `${a}px ${a}px ${a}px ${b}px`; }

/* ————— شريحة الأداة (ACT + OBSERVE) ————— */

function ToolChip({ t, dark, col }) {
  const meta = TOOL_META[t.tool] || { icon: "🔧", title: t.tool };
  const tone =
    t.running ? { bg: softAdapt("#e0f2fe", dark), tx: txAdapt("#0369a1", dark) } :
    t.blocked ? { bg: softAdapt("#fef3c7", dark), tx: txAdapt("#b45309", dark) } :
    t.ok ? { bg: softAdapt("#dcfce7", dark), tx: txAdapt("#15803d", dark) } :
            { bg: softAdapt("#fee2e2", dark), tx: txAdapt("#b91c1c", dark) };
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      background: "var(--ia-ghost-bg)", border: `1px solid ${softAdapt(tone.bg, dark)}`,
      borderRadius: 12, overflow: "hidden", width: "fit-content", maxWidth: "94%",
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        className="trow"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer" }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: tone.bg, fontSize: 13, flexShrink: 0,
        }}>{meta.icon}</span>
        <div style={{ minWidth: 120 }}>
          <div style={{ fontSize: 12, fontWeight: 800 }}>{meta.title}</div>
          <div style={{ fontSize: 10, color: "var(--ia-sub)" }}>
            {t.running ? tr("⚡ تنفيذ…") : (
              t.blocked
                ? `${BLOCKED_LABELS[t.blocked] || t.blocked}${t.durationMs ? ` • ${t.durationMs}ms` : ""}`
                : `${t.ok ? tr("نجح") : tr("فشل")}${t.durationMs != null ? ` • ${t.durationMs}ms` : ""}`
            )}
          </div>
        </div>
        <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr", marginLeft: "auto" }}>
          {Object.keys(t.args || {}).slice(0, 3).map(k => `${k}: ${String(t.args[k]).slice(0, 24)}`).join(" · ")}
        </span>
        <span style={{ fontSize: 10, color: "var(--ia-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ borderTop: "1px solid var(--ia-border3)", padding: "10px 12px", fontSize: 12 }}>
          <div style={{ fontSize: 10, color: "var(--ia-sub)", marginBottom: 4, fontWeight: 800 }}>🔧 {tr("الوسائط")}</div>
          <pre style={{ margin: 0, fontSize: 10.5, whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left", color: "var(--ia-text2)" }}>
            {JSON.stringify(t.args, null, 1).slice(0, 500)}
          </pre>
          {t.summary && (
            <>
              <div style={{ fontSize: 10, color: "var(--ia-sub)", margin: "8px 0 4px", fontWeight: 800 }}>👁 {tr("الملاحظة")}</div>
              <div style={{ whiteSpace: "pre-wrap", color: "var(--ia-text2)", lineHeight: 1.65, maxHeight: 220, overflowY: "auto" }}>
                {t.summary.slice(0, 1500)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ————— بطاقة تأكيد الكتابات ————— */

function ConfirmCard({ m, dark, col, onConfirm, streaming }) {
  const c = m.confirm;
  if (!c) return null;
  return (
    <div style={{
      background: softAdapt("#fffbeb", dark), border: `1.5px solid ${softAdapt("#fde68a", dark)}`,
      borderRadius: 12, padding: "12px 14px", maxWidth: "94%",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🔐</span>
        <span style={{ fontSize: 12.5, fontWeight: 900, color: txAdapt("#b45309", dark) }}>
          {tr("الوكيل يريد تنفيذ {0} عملية — أكّد بنفسك", [c.actions.length])}
        </span>
      </div>
      {c.actions.map((a, i) => {
        const meta = TOOL_META[a.tool] || { icon: "🔧", title: a.tool };
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8,
            background: softAdapt("#fef3c7", dark), marginBottom: 6, fontSize: 12, fontWeight: 700,
          }}>
            <span>{meta.icon}</span>
            <span>{meta.title}</span>
            <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr", marginLeft: "auto" }}>
              {JSON.stringify(a.args).slice(0, 90)}
            </span>
          </div>
        );
      })}
      {c.pending ? (
        <button className="btn" style={{ background: "#b45309", color: "#fff", width: "100%", marginTop: 4 }} disabled={streaming} onClick={onConfirm}>
          {tr("✅ تنفيذ العمليات المُدرجة")}
        </button>
      ) : c.busy ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ia-sub)", padding: 4 }}>
          <PulseDot /> {tr("جارٍ التنفيذ…")}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--ia-sub)", padding: 4 }}>✓ {tr("مُصادَقة ونُفِّذت — انظر النتيجة تحت")}</div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--ia-sub)", marginTop: 6 }}>
        {tr("صالحة 5 دقائق • تُنفَّذ ضمن الحواجز (سقف مالي، لا حذف) • كل خطوة تُدوَّن في التدقيق")}
      </div>
    </div>
  );
}

/* ————— لوحة سجل التدقيق ————— */

function AuditPanel({ dark, col, audit, loading, onRefresh, onClose }) {
  const entries = audit?.entries || [];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ia-border)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>🕵️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 13.5 }}>{tr("سجل تدقيق الوكيل — كل استدعاء أداة")}</div>
          <div style={{ fontSize: 11, color: "var(--ia-sub)" }}>
            {tr("نجاح، حجب الحواجز، فشل — مع الوسائط والمدة والمسؤول")}
          </div>
        </div>
        <button className="btn btn-outline" onClick={onRefresh} disabled={loading}>{loading ? tr("…") : tr("🔄")}</button>
        <button className="btn btn-outline" onClick={onClose}>✕</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {loading && !entries.length ? (
          <div style={{ padding: 16 }}><div className="sk sk-lg" /></div>
        ) : !entries.length ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 12.5, color: "var(--ia-sub)" }}>
            {tr("لا استدعاءات مدوَّنة بعد — شغّل الوكيل وستظهر هنا فوراً")}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--ia-hover)" }}>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("الأداة")}</th>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("الحالة")}</th>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("الوسائط")}</th>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("المدة")}</th>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("بواسطة")}</th>
                <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("الوقت")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const meta = TOOL_META[e.tool] || { icon: "🔧", title: e.tool };
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--ia-border3)" }}>
                    <td style={{ padding: "7px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{meta.icon} {meta.title}</td>
                    <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                      {e.blocked ? (
                        <span style={{ background: softAdapt("#fef3c7", dark), color: txAdapt("#b45309", dark), borderRadius: 20, padding: "1px 8px", fontSize: 10.5, fontWeight: 800 }}>
                          {BLOCKED_LABELS[e.blocked] || e.blocked}
                        </span>
                      ) : e.ok ? (
                        <span style={{ background: softAdapt("#dcfce7", dark), color: txAdapt("#15803d", dark), borderRadius: 20, padding: "1px 8px", fontSize: 10.5, fontWeight: 800 }}>{tr("نجح")}</span>
                      ) : (
                        <span style={{ background: softAdapt("#fee2e2", dark), color: txAdapt("#b91c1c", dark), borderRadius: 20, padding: "1px 8px", fontSize: 10.5, fontWeight: 800 }}>{tr("فشل")}</span>
                      )}
                      <span style={{ fontSize: 9.5, color: "var(--ia-sub)", marginInlineStart: 4 }}>{e.mode}</span>
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 10.5, color: "var(--ia-sub)", direction: "ltr", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {JSON.stringify(e.args).slice(0, 70)}
                    </td>
                    <td style={{ padding: "7px 10px", fontSize: 10.5, color: "var(--ia-sub)", direction: "ltr", whiteSpace: "nowrap" }}>{e.durationMs}ms</td>
                    <td style={{ padding: "7px 10px", fontSize: 10.5, color: "var(--ia-sub)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.userEmail}</td>
                    <td style={{ padding: "7px 10px", fontSize: 10.5, color: "var(--ia-sub)", whiteSpace: "nowrap" }}>
                      {new Date(e.createdAt).toLocaleString("ar", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
