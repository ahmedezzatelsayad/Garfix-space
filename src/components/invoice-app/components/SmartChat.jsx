"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme, txAdapt, softAdapt } from "../theme";

/* r10: المساعد الذكي — شات متصل بكامل المشروع
 * - بثّ حيّ (SSE) من الخادم (DeepSeek عند تفعيله / المزوّد المدمج)
 * - محادثات محفوظة على الخادم لكل شركة مع استرجاعها
 * - سياق حيّ من قاعدة البيانات (فواتير، عملاء، كتالوج، مستحقات)
 */

const SUGGESTIONS = [
  { icon: "📊", text: "ملخص مبيعات الشهر وأهم المؤشرات" },
  { icon: "⏳", text: "أعلى العملاء مديونية وما الاقتراحات للتحصيل؟" },
  { icon: "📦", text: "حلّل الكتالوج واقترح هوامش ربح أفضل" },
  { icon: "🔍", text: "فحص الفواتير غير المدفوعة وترتيبها بالأولوية" },
  { icon: "✍️", text: "اكتب لي رسالة تذكير ودّية لأهم عميل مدين" },
  { icon: "📈", text: "قارن أداء الشهور الأخيرة وحدّد الاتجاه" },
];

const fKD = n => `${Number(n ?? 0).toFixed(3)} د.ك`;

export default function SmartChat({ company }) {
  const col = company?.color || "#1e3a5f";
  const sk = company?.sk || "";
  const { dark } = useTheme();

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamMeta, setStreamMeta] = useState(null); // {model, provider, scope}
  const [error, setError] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);

  const cardBg = "var(--ia-card)";
  const border = "var(--ia-border)";

  /* ————— تحميل المحادثات ————— */
  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await fetch(`/api/ai/conversations?companySlug=${encodeURIComponent(sk)}&limit=50`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [sk]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  /* استرجاع آخر محادثة مفتوحة لهذه الشركة */
  useEffect(() => {
    if (!sk || convLoading || !conversations.length) return;
    const saved = Number(localStorage.getItem(`garfix_chat_active_${sk}`) || 0);
    if (saved && conversations.some(c => c.id === saved) && activeId == null) {
      openConversation(saved);
    }
  }, [convLoading, conversations, sk]);

  /* ————— فتح محادثة ————— */
  const openConversation = async id => {
    setError("");
    setActiveId(id);
    setShowSidebar(false);
    localStorage.setItem(`garfix_chat_active_${sk}`, String(id));
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(
        (data.messages || [])
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content, model: m.model, latencyMs: m.latencyMs }))
      );
    } catch {
      setError("تعذّر تحميل المحادثة");
      setMessages([]);
    }
  };

  const newConversation = () => {
    setActiveId(null);
    setMessages([]);
    setError("");
    setShowSidebar(false);
    localStorage.removeItem(`garfix_chat_active_${sk}`);
    taRef.current?.focus();
  };

  const deleteConversation = async (e, id) => {
    e.stopPropagation();
    if (!confirm("حذف هذه المحادثة نهائياً؟")) return;
    try {
      await fetch(`/api/ai/conversations?id=${id}`, { method: "DELETE" });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeId === id) newConversation();
    } catch { /* تجاهل */ }
  };

  /* ————— تمرير تلقائي ————— */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  /* ————— الإرسال (بثّ SSE) ————— */
  const send = async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;
    setError("");
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setStreaming(true);
    setStreamMeta(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let assistant = { role: "assistant", content: "", reasoning: "", model: null, latencyMs: null };
    setMessages(prev => [...prev, assistant]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: activeId, companySlug: sk || undefined, companyName: company?.nameAr }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handleEvent = (ev, dataStr) => {
        let data = {};
        try { data = JSON.parse(dataStr); } catch { return; }
        if (ev === "meta") {
          setStreamMeta({ model: data.model, provider: data.provider, scope: data.scope });
          if (!activeId && data.conversationId) {
            setActiveId(data.conversationId);
            localStorage.setItem(`garfix_chat_active_${sk}`, String(data.conversationId));
          }
        } else if (ev === "delta") {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + (data.text || "") };
            return copy;
          });
        } else if (ev === "reasoning") {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, reasoning: (last.reasoning || "") + (data.text || "") };
            return copy;
          });
        } else if (ev === "error") {
          setError(data.error || "خطأ من مزوّد الذكاء الاصطناعي");
        } else if (ev === "done") {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") copy[copy.length - 1] = { ...last, model: data.model, latencyMs: data.latencyMs };
            return copy;
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const evMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.*)$/m);
          if (evMatch && dataMatch) handleEvent(evMatch[1].trim(), dataMatch[1]);
        }
      }
      loadConversations(); // تحديث القائمة الجانبية (العنوان/الوقت)
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "تعذّر الاتصال بالمساعد");
      // إزالة الفقاعة الفارغة لو أُلغيت
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === "assistant" && !last.content && !last.reasoning) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  /* ————— نموّ تلقائي لمربع الكتابة ————— */
  const taInput = e => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };

  const onKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      send();
    }
  };

  const providerChip = useMemo(() => {
    if (!streamMeta) return null;
    const isDS = streamMeta.provider === "deepseek";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: softAdapt(isDS ? "#dbeafe" : "#dcfce7", dark),
        color: txAdapt(isDS ? "#1d4ed8" : "#15803d", dark),
        borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      }}>
        {isDS ? `🔵 ${streamMeta.model}` : "🟢 المزوّد المدمج"}
      </span>
    );
  }, [streamMeta, dark]);

  const emptyState = messages.length === 0 && !streaming;

  /* ————— العرض ————— */
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12, animation: "fadeUp .25s" }}>
      {/* الهيدر */}
      <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${col}, ${txAdapt(col, true)})`, fontSize: 22, flexShrink: 0,
          boxShadow: `0 4px 12px ${col}44`,
        }}>🤖</div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>مساعد جرفِكس الذكي</div>
          <div style={{ fontSize: 11.5, color: "var(--ia-sub)" }}>
            متصل ببيانات {company?.nameAr || "الشركة"} — فواتير، عملاء، مستحقات وكتالوج (لقطة حيّة)
          </div>
        </div>
        {providerChip}
        <button className="btn btn-outline" onClick={() => setShowSidebar(s => !s)}
          style={{ display: conversations.length ? "inline-flex" : "none" }}>
          🗂️ المحادثات {conversations.length ? `(${conversations.length})` : ""}
        </button>
        <button className="btn" style={{ background: col, color: "#fff" }} onClick={newConversation}>➕ محادثة جديدة</button>
      </div>

      {/* القائمة الجانبية (قابلة للطي) */}
      {showSidebar && (
        <div className="card" style={{ padding: 8, maxHeight: 260, overflowY: "auto" }}>
          {convLoading ? (
            <div className="sk sk-sm" style={{ margin: 8 }} />
          ) : conversations.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12.5, color: "var(--ia-sub)", textAlign: "center" }}>لا توجد محادثات محفوظة بعد</div>
          ) : (
            conversations.map(c => (
              <div key={c.id}
                onClick={() => openConversation(c.id)}
                className="trow"
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                  background: activeId === c.id ? softAdapt(col + "18", dark) : "transparent",
                  cursor: "pointer",
                }}>
                <span style={{ fontSize: 14 }}>{c.model?.includes("reasoner") ? "🧠" : "💬"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ia-sub)" }}>
                    {c.messageCount} رسالة • {new Date(c.updatedAt).toLocaleString("ar", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button onClick={e => deleteConversation(e, c.id)} title="حذف"
                  style={{ border: "none", background: "transparent", color: txAdapt("#dc2626", dark), cursor: "pointer", fontSize: 14, padding: 4 }}>🗑️</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* منطقة المحادثة */}
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 420 }}>
        <div ref={scrollRef} style={{ maxHeight: "min(58vh, 560px)", minHeight: 300, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {emptyState ? (
            <div style={{ textAlign: "center", padding: "28px 10px" }}>
              <div style={{ fontSize: 44, marginBottom: 6 }}>🤖</div>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>اسألني أي شيء عن مشروعك</div>
              <div style={{ fontSize: 12.5, color: "var(--ia-sub)", marginBottom: 18, maxWidth: 420, marginInline: "auto" }}>
                أرى بيانات {company?.nameAr || "الشركة"} الحيّة: الفواتير، المدفوعات، المستحقات، العملاء والكتالوج — ويمكنني تحليلها وكتابة الرسائل والتقارير.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxWidth: 640, marginInline: "auto" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="btn btn-outline" onClick={() => send(s.text)}
                    style={{ justifyContent: "flex-start", textAlign: "right", fontWeight: 600, fontSize: 12.5, padding: "10px 12px", height: "auto" }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span> {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => m.role === "user" ? (
              /* — فقاعة المستخدم — */
              <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "82%", background: col, color: "#fff",
                  borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13.5, lineHeight: 1.7,
                  boxShadow: `0 2px 10px ${col}33`, whiteSpace: "pre-wrap",
                }}>{m.content}</div>
              </div>
            ) : (
              /* — رد المساعد — */
              <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ maxWidth: "88%", width: "fit-content" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>🤖</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>مساعد جرفِكس</span>
                    {m.latencyMs ? <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr" }}>{(m.latencyMs / 1000).toFixed(1)}s</span> : null}
                  </div>
                  {m.reasoning ? (
                    <details style={{ marginBottom: 6 }}>
                      <summary style={{ fontSize: 11, color: "var(--ia-sub)", cursor: "pointer", fontWeight: 700 }}>🧠 سلسلة التفكير ({m.reasoning.length} حرف)</summary>
                      <div style={{ fontSize: 11.5, color: "var(--ia-sub)", whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto", padding: "6px 8px", background: softAdapt("#f1f5f9", dark), borderRadius: 8 }}>{m.reasoning}</div>
                    </details>
                  ) : null}
                  <div style={{
                    background: dark ? "var(--ia-ghost-bg)" : softAdapt("#f8fafc", dark),
                    border: `1px solid ${border}`, borderRadius: "14px 14px 4px 14px",
                    padding: "10px 14px", fontSize: 13.5, lineHeight: 1.9,
                  }}>
                    {m.content ? (
                      <div className="md-body">
                        <ReactMarkdown
                          components={{
                            strong: props => <strong style={{ color: txAdapt(col, dark) }}>{props.children}</strong>,
                            table: props => (
                              <table style={{ borderCollapse: "collapse", fontSize: 12, margin: "6px 0" }}>
                                {props.children}
                              </table>
                            ),
                            th: props => <th style={{ border: `1px solid ${border}`, padding: "4px 8px", background: softAdapt("#f1f5f9", dark), fontSize: 11.5 }}>{props.children}</th>,
                            td: props => <td style={{ border: `1px solid ${border}`, padding: "4px 8px", fontSize: 12 }}>{props.children}</td>,
                          }}
                        >{m.content}</ReactMarkdown>
                      </div>
                    ) : streaming && i === messages.length - 1 ? (
                      <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <Dot delay="0s" /><Dot delay=".15s" /><Dot delay=".3s" />
                        <span style={{ fontSize: 11, color: "var(--ia-sub)", marginRight: 6 }}>يفكّر…</span>
                      </span>
                    ) : null}
                    {streaming && m.content && i === messages.length - 1 ? (
                      <span style={{ display: "inline-block", width: 8, height: 16, background: txAdapt(col, dark), marginRight: 2, animation: "blink 1s step-end infinite", verticalAlign: "middle", borderRadius: 2 }} />
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* شريط الخطأ */}
        {error && (
          <div style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: 8, background: softAdapt("#fee2e2", dark), color: txAdapt("#b91c1c", dark), fontSize: 12.5, fontWeight: 700 }}>
            ⚠️ {error}
          </div>
        )}

        {/* شريط الإدخال */}
        <div style={{ borderTop: `1px solid ${border}`, padding: 12, display: "flex", gap: 8, alignItems: "flex-end", background: dark ? "var(--ia-ghost-bg)" : "transparent" }}>
          <textarea ref={taRef} className="inp" value={input} onChange={taInput} onKeyDown={onKeyDown}
            placeholder="اكتب سؤالك… (Enter للإرسال • Shift+Enter لسطر جديد)"
            rows={1}
            disabled={streaming}
            style={{ resize: "none", maxHeight: 140, lineHeight: 1.6, flex: 1, direction: "rtl" }} />
          {streaming ? (
            <button className="btn btn-red" onClick={stop} style={{ height: 42 }}>⏹ إيقاف</button>
          ) : (
            <button className="btn" onClick={() => send()} disabled={!input.trim()}
              style={{ background: col, color: "#fff", height: 42, opacity: input.trim() ? 1 : .5 }}>📨 إرسال</button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0 } }
        @keyframes pulseDot { 0%,100% { opacity: .3; transform: scale(.85) } 50% { opacity: 1; transform: scale(1.15) } }
        .md-body p { margin: 0 0 6px; } .md-body p:last-child { margin: 0 }
        .md-body ul, .md-body ol { margin: 4px 0; padding-inline-start: 20px }
        .md-body li { margin-bottom: 3px }
        .md-body h1, .md-body h2, .md-body h3 { font-size: 14px; font-weight: 900; margin: 8px 0 4px }
        .md-body code { background: ${softAdapt("#f1f5f9", dark)}; padding: 1px 5px; border-radius: 4px; font-size: 12 }
        .md-body blockquote { border-inline-start: 3px solid ${txAdapt(col, dark)}; margin: 6px 0; padding: 2px 10px; color: var(--ia-sub) }
      `}</style>
    </div>
  );
}

function Dot({ delay }) {
  return <span style={{
    width: 7, height: 7, borderRadius: "50%", background: "var(--ia-muted)",
    display: "inline-block", animation: `pulseDot 1s ${delay} infinite`,
  }} />;
}
