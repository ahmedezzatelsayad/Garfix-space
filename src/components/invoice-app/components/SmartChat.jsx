"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme, txAdapt, softAdapt } from "../theme";
import { fmtMoney } from "../currency";
import { tr, appLang, companyName } from "@/lib/i18n-app";

/* r10: المساعد الذكي — شات متصل بكامل المشروع
 * r15: إكمال المساعد — إجراءات تنفيذية حقيقية (إنسان في الحلقة):
 *  - المساعد يقترح إجراءً بكتلة ```garfix-action {json}```
 *  - الواجهة تعرضها بطاقة أنيقة، والمستخدم يؤكد «تنفيذ»
 *  - POST /api/ai/action ينفّذ بعد تحقق صارم ويعيد ملخصاً عربياً
 *  + نسخ أي رسالة، تصدير المحادثة Markdown، اقتراحات إجرائية
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

const ACTION_SUGGESTIONS = [
  { icon: "🧾", text: "أنشئ فاتورة جديدة للعميل سارة الأحمد ببندَين: «منتج تجريبي» كمية 2 بسعر 15.500" },
  { icon: "👤", text: "أضف عميل جديد باسم محمد العتيبي ورقم +96591234567" },
  { icon: "💰", text: "سجّل دفعة 10 دنانير على فاتورة INV10005" },
];

/* ————— بيانات الإجراءات (لعرض البطاقات) ————— */

const ACTION_META = {
  create_client: { icon: "👤", title: "إضافة عميل جديد", tone: "#16a34a" },
  create_invoice: { icon: "🧾", title: "إنشاء فاتورة جديدة", tone: "#2563eb" },
  register_payment: { icon: "💰", title: "تسجيل دفعة", tone: "#d97706" },
  add_catalog_item: { icon: "📦", title: "إضافة صنف للكتالوج", tone: "#7c3aed" },
  log_reminder: { icon: "📨", title: "تسجيل تذكير", tone: "#0369a1" },
};

const PAY_METHOD_LABELS = { knet: "كي نت", cash: "نقدي", online: "أونلاين", card: "بطاقة" };
const CHANNEL_LABELS = { whatsapp: "واتساب", call: "مكالمة", manual: "يدوي" };

/**
 * فصل كتل الإجراءات عن نص الرد:
 * أي كتلة كود مسوّرة (```garfix-action أو ```json) يفسَّر محتواها JSON
 * ويحتوي حقل action صالحاً → تُعتبر كتلة إجراء وتُنزع من النص المعروض.
 */
function parseActionBlocks(content) {
  const actions = [];
  if (!content) return { text: content || "", actions };
  const text = String(content).replace(/```[a-zA-Z-]*\s*\n([\s\S]*?)```/g, (full, inner) => {
    try {
      const obj = JSON.parse(inner.trim());
      if (obj && typeof obj.action === "string" && ACTION_META[obj.action] && obj.args && typeof obj.args === "object") {
        actions.push({ action: obj.action, args: obj.args });
        return ""; // انزع الكتلة من النص
      }
    } catch { /* كتلة كود عادية — تُعرض كما هي */ }
    return full;
  });
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), actions: actions.slice(0, 3) };
}

export default function SmartChat({ company, onDataChanged }) {
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
  const [copiedIdx, setCopiedIdx] = useState(-1);
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
          .map(m => {
            if (m.role !== "assistant") return { role: m.role, content: m.content };
            const { text, actions } = parseActionBlocks(m.content);
            return {
              role: m.role, content: text, model: m.model, latencyMs: m.latencyMs,
              actions: actions.map(a => ({ ...a, status: "history" })),
            };
          })
      );
    } catch {
      setError(tr("تعذّر تحميل المحادثة"));
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
    if (!confirm(tr("حذف هذه المحادثة نهائياً؟"))) return;
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

    let assistant = { role: "assistant", content: "", reasoning: "", model: null, latencyMs: null, actions: [] };
    setMessages(prev => [...prev, assistant]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: activeId, companySlug: sk || undefined, companyName: companyName(company), lang: appLang() }),
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
          setError(data.error || tr("خطأ من مزوّد الذكاء الاصطناعي"));
        } else if (ev === "done") {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              // r15: فصل كتل الإجراءات عن النص عند اكتمال الرد
              const { text, actions } = parseActionBlocks(last.content);
              copy[copy.length - 1] = {
                ...last, content: text, model: data.model, latencyMs: data.latencyMs,
                actions: actions.map(a => ({ ...a, status: "pending" })),
              };
            }
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
      // أمان: إن انتهى البث بلا حدث done (قطع اتصال) — افصل الإجراءات الآن
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && last.content && (!last.actions || !last.actions.length)) {
          const { text, actions } = parseActionBlocks(last.content);
          if (actions.length) copy[copy.length - 1] = { ...last, content: text, actions: actions.map(a => ({ ...a, status: "pending" })) };
        }
        return copy;
      });
      loadConversations(); // تحديث القائمة الجانبية (العنوان/الوقت)
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || tr("تعذّر الاتصال بالمساعد"));
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

  /* ————— r15: تنفيذ إجراء مقترح ————— */
  const runAction = async (msgIdx, actIdx) => {
    setMessages(prev => {
      const copy = [...prev];
      const msg = copy[msgIdx];
      if (!msg || !msg.actions) return prev;
      const actions = [...msg.actions];
      actions[actIdx] = { ...actions[actIdx], status: "executing", result: null };
      copy[msgIdx] = { ...msg, actions };
      return copy;
    });

    const act = messages[msgIdx]?.actions?.[actIdx];
    if (!act) return;
    try {
      const res = await fetch("/api/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act.action, args: act.args, companySlug: sk || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      setMessages(prev => {
        const copy = [...prev];
        const msg = copy[msgIdx];
        if (!msg || !msg.actions) return prev;
        const actions = [...msg.actions];
        actions[actIdx] = {
          ...actions[actIdx],
          status: data.ok ? "done" : "failed",
          result: data.ok ? (data.summary || tr("تم التنفيذ")) : ((data.errors || []).join(" — ") || tr("فشل التنفيذ")),
        };
        copy[msgIdx] = { ...msg, actions };
        return copy;
      });
      // r15: نجاح الإجراء = بيانات المشروع تغيّرت — أبلغ التطبيق ليُحدّث قوائمه
      if (data.ok && typeof onDataChanged === "function") {
        try { onDataChanged(); } catch { /* تجاهل */ }
      }
    } catch (e) {
      setMessages(prev => {
        const copy = [...prev];
        const msg = copy[msgIdx];
        if (!msg || !msg.actions) return prev;
        const actions = [...msg.actions];
        actions[actIdx] = { ...actions[actIdx], status: "failed", result: e.message || tr("تعذّر الاتصال بالخادم") };
        copy[msgIdx] = { ...msg, actions };
        return copy;
      });
    }
  };

  const dismissAction = (msgIdx, actIdx) => {
    setMessages(prev => {
      const copy = [...prev];
      const msg = copy[msgIdx];
      if (!msg || !msg.actions) return prev;
      const actions = [...msg.actions];
      actions[actIdx] = { ...actions[actIdx], status: "dismissed" };
      copy[msgIdx] = { ...msg, actions };
      return copy;
    });
  };

  /* ————— نسخ رسالة ————— */
  const copyMessage = async (i, content) => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(-1), 1600);
    } catch { /* تجاهل */ }
  };

  /* ————— تصدير المحادثة (Markdown) ————— */
  const exportConversation = () => {
    if (!messages.length) return;
    const title = conversations.find(c => c.id === activeId)?.title || tr("محادثة جديدة");
    const lines = [
      tr("# 🤖 محادثة مساعد جرفِكس الذكي — {0}",[company?.nameAr || tr("الشركة")]),
      ``,
      tr("> {0} • {1} • {2} رسالة",[title,new Date().toLocaleString("ar"),messages.length]),
      ``,
      ...messages.map(m => (m.role === "user"
        ? tr("## 👤 أنت\n\n{0}",[m.content])
        : tr("## 🤖 المساعد{0}\n\n{1}{2}",[m.model ? ` (${m.model})` : "",m.content,(m.actions || []).filter(a => a.status === "done").length ? tr("\n\n*(إجراءات نُفِّذت: {0})*",[(m.actions || []).filter(a => a.status === "done").map(a => ACTION_META[a.action]?.title || a.action).join("، ")]) : ""]))),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `garfix-chat-${activeId || "new"}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
        {isDS ? `🔵 ${streamMeta.model}` : tr("🟢 المزوّد المدمج")}
      </span>
    );
  }, [streamMeta, dark]);

  const emptyState = messages.length === 0 && !streaming;
  const totalMsgs = messages.filter(m => m.role === "user").length + messages.filter(m => m.role === "assistant").length;

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
          <div style={{ fontWeight: 900, fontSize: 15 }}>{tr("مساعد جرفِكس الذكي")}</div>
          <div style={{ fontSize: 11.5, color: "var(--ia-sub)" }}>
            {tr("متصل ببيانات")} {company?.nameAr || tr("الشركة")} {tr("— تحليل، تقارير، وإجراءات تنفيذية حقيقية")}
            {totalMsgs > 0 ? tr(" • {0} رسالة",[totalMsgs]) : ""}
          </div>
        </div>
        {providerChip}
        <button className="btn btn-outline" onClick={() => setShowSidebar(s => !s)}
          style={{ display: conversations.length ? "inline-flex" : "none" }}>
          {tr("🗂️ المحادثات")} {conversations.length ? `(${conversations.length})` : ""}
        </button>
        <button className="btn btn-outline" onClick={exportConversation}
          title={tr("تنزيل هذه المحادثة كملف Markdown")}
          style={{ display: messages.length ? "inline-flex" : "none" }}>{tr("⬇️ تصدير")}</button>
        <button className="btn" style={{ background: col, color: "#fff" }} onClick={newConversation}>{tr("➕ محادثة جديدة")}</button>
      </div>

      {/* القائمة الجانبية (قابلة للطي) */}
      {showSidebar && (
        <div className="card" style={{ padding: 8, maxHeight: 260, overflowY: "auto" }}>
          {convLoading ? (
            <div className="sk sk-sm" style={{ margin: 8 }} />
          ) : conversations.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12.5, color: "var(--ia-sub)", textAlign: "center" }}>{tr("لا توجد محادثات محفوظة بعد")}</div>
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
                    {c.messageCount} {tr("رسالة •")} {new Date(c.updatedAt).toLocaleString("ar", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <button onClick={e => deleteConversation(e, c.id)} title={tr("حذف")}
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
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{tr("اسألني أي شيء عن مشروعك")}</div>
              <div style={{ fontSize: 12.5, color: "var(--ia-sub)", marginBottom: 8, maxWidth: 460, marginInline: "auto" }}>
                {tr("أرى بيانات")} {company?.nameAr || tr("الشركة")} {tr("الحيّة: الفواتير، المدفوعات، المستحقات، العملاء والكتالوج — ويمكنني تحليلها وكتابة الرسائل والتقارير.")}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: softAdapt("#fef3c7", dark), color: txAdapt("#b45309", dark), borderRadius: 20, padding: "4px 12px", fontSize: 11.5, fontWeight: 700, marginBottom: 18 }}>
                {tr("⚡ جرّب أيضاً: اطلب مني إنشاء فاتورة أو إضافة عميل أو تسجيل دفعة — سأجهّزها لك وتؤكدها بضغطة زر")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxWidth: 640, marginInline: "auto" }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="btn btn-outline" onClick={() => send(tr(s.text))}
                    style={{ justifyContent: "flex-start", textAlign: "start", fontWeight: 600, fontSize: 12.5, padding: "10px 12px", height: "auto" }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span> {tr(s.text)}
                  </button>
                ))}
              </div>
              <div style={{ maxWidth: 640, marginInline: "auto", marginTop: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ia-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{tr("⚡ أمثلة إجرائية — سأنفّذها فعلياً")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {ACTION_SUGGESTIONS.map((s, i) => (
                    <button key={i} className="btn btn-outline" onClick={() => send(tr(s.text))}
                      style={{ justifyContent: "flex-start", textAlign: "start", fontWeight: 600, fontSize: 12, padding: "10px 12px", height: "auto", borderColor: softAdapt("#fde68a", dark), background: softAdapt("#fffbeb", dark) }}>
                      <span style={{ fontSize: 16 }}>{s.icon}</span> {tr(s.text)}
                    </button>
                  ))}
                </div>
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
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--ia-sub)" }}>{tr("مساعد جرفِكس")}</span>
                    {m.latencyMs ? <span style={{ fontSize: 10, color: "var(--ia-sub)", direction: "ltr" }}>{(m.latencyMs / 1000).toFixed(1)}s</span> : null}
                    {m.content ? (
                      <button onClick={() => copyMessage(i, m.content)} title={tr("نسخ الرد")}
                        className="chat-copy"
                        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 12, padding: "1px 4px", color: copiedIdx === i ? "#16a34a" : "var(--ia-muted)" }}>
                        {copiedIdx === i ? tr("✓ تم النسخ") : "📋"}
                      </button>
                    ) : null}
                  </div>
                  {m.reasoning ? (
                    <details style={{ marginBottom: 6 }}>
                      <summary style={{ fontSize: 11, color: "var(--ia-sub)", cursor: "pointer", fontWeight: 700 }}>{tr("🧠 سلسلة التفكير (")}{m.reasoning.length} {tr("حرف)")}</summary>
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
                        <span style={{ fontSize: 11, color: "var(--ia-sub)", marginInlineStart: 6 }}>{tr("يفكّر…")}</span>
                      </span>
                    ) : null}
                    {streaming && m.content && i === messages.length - 1 ? (
                      <span style={{ display: "inline-block", width: 8, height: 16, background: txAdapt(col, dark), marginInlineStart: 2, animation: "blink 1s step-end infinite", verticalAlign: "middle", borderRadius: 2 }} />
                    ) : null}
                  </div>

                  {/* r15: بطاقات الإجراءات المقترحة */}
                  {(m.actions || []).map((act, ai) => (
                    <ActionCard key={ai} act={act} col={col} dark={dark}
                      onRun={() => runAction(i, ai)}
                      onDismiss={() => dismissAction(i, ai)} />
                  ))}
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
            placeholder={tr("اكتب سؤالك أو اطلب إجراءً (مثال: أنشئ فاتورة…) — Enter للإرسال • Shift+Enter لسطر جديد")}
            rows={1}
            disabled={streaming}
            style={{ resize: "none", maxHeight: 140, lineHeight: 1.6, flex: 1, direction: "rtl" }} />
          {streaming ? (
            <button className="btn btn-red" onClick={stop} style={{ height: 42 }}>{tr("⏹ إيقاف")}</button>
          ) : (
            <button className="btn" onClick={() => send()} disabled={!input.trim()}
              style={{ background: col, color: "#fff", height: 42, opacity: input.trim() ? 1 : .5 }}>{tr("📨 إرسال")}</button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0 } }
        @keyframes pulseDot { 0%,100% { opacity: .3; transform: scale(.85) } 50% { opacity: 1; transform: scale(1.15) } }
        @keyframes spinS { to { transform: rotate(360deg) } }
        .md-body p { margin: 0 0 6px; } .md-body p:last-child { margin: 0 }
        .md-body ul, .md-body ol { margin: 4px 0; padding-inline-start: 20px }
        .md-body li { margin-bottom: 3px }
        .md-body h1, .md-body h2, .md-body h3 { font-size: 14px; font-weight: 900; margin: 8px 0 4px }
        .md-body code { background: ${softAdapt("#f1f5f9", dark)}; padding: 1px 5px; border-radius: 4px; font-size: 12 }
        .md-body blockquote { border-inline-start: 3px solid ${txAdapt(col, dark)}; margin: 6px 0; padding: 2px 10px; color: var(--ia-sub) }
        .chat-copy { opacity: .55; transition: opacity .15s, color .15s } .chat-copy:hover { opacity: 1 }
        .act-card { border-radius: 12px; border: 1.5px solid; overflow: hidden; margin-top: 8px; animation: fadeUp .3s }
        .act-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08) }
        .act-row { display: flex; gap: 6px; align-items: baseline; font-size: 12.5; padding: 2px 0 }
        .act-k { color: var(--ia-sub); font-weight: 700; white-space: nowrap; min-width: 86px }
        .act-v { color: var(--ia-text); font-weight: 600; word-break: break-word }
      `}</style>
    </div>
  );
}

/* ————— r15: بطاقة إجراء مقترح — إنسان في الحلقة ————— */
function ActionCard({ act, col, dark, onRun, onDismiss }) {
  const meta = ACTION_META[act.action] || { icon: "⚡", title: act.action, tone: "#6b7280" };
  const tone = meta.tone;
  const soft = softAdapt(tone + "14", dark);

  const fields = useMemo(() => {
    const a = act.args || {};
    const f = [];
    const push = (k, v) => { if (v !== undefined && v !== null && String(v).trim() !== "") f.push([k, String(v)]); };
    if (act.action === "create_client") {
      push(tr("الاسم"), a.name); push(tr("الهاتف"), a.phone); push(tr("البريد"), a.email); push(tr("العنوان"), a.address);
    } else if (act.action === "create_invoice") {
      push(tr("العميل"), a.clientName); push(tr("الهاتف"), a.clientPhone);
      if (Array.isArray(a.items)) {
        const itemsTxt = a.items.map(it => `${it.name || tr("بند")} × ${it.qty ?? 1} @ ${Number(it.price ?? 0).toLocaleString("ar")}`).join(" • ");
        push(tr("البنود"), itemsTxt);
        const tot = a.items.reduce((s, it) => s + (Number(it.qty) || 1) * (Number(it.price) || 0), 0);
        push(tr("الإجمالي"), fmtMoney(tot));
      }
      push(tr("الاستحقاق"), a.dueDate); push(tr("ملاحظات"), a.notes);
    } else if (act.action === "register_payment") {
      push(tr("رقم الفاتورة"), a.invoiceNumber);
      push(tr("المبلغ"), a.amount != null ? fmtMoney(Number(a.amount)) : "");
      push(tr("الطريقة"), PAY_METHOD_LABELS[String(a.method || "knet").toLowerCase()] || a.method);
      push(tr("التاريخ"), a.date); push(tr("ملاحظة"), a.note);
    } else if (act.action === "add_catalog_item") {
      push(tr("الصنف"), a.name);
      push(tr("سعر البيع"), a.sellingPrice != null ? fmtMoney(Number(a.sellingPrice)) : "");
      push(tr("سعر الشراء"), a.purchasePrice != null ? fmtMoney(Number(a.purchasePrice)) : "");
      if (Array.isArray(a.aliases) && a.aliases.length) push(tr("أسماء بديلة"), a.aliases.join("، "));
    } else if (act.action === "log_reminder") {
      push(tr("العميل"), a.clientName); push(tr("الهاتف"), a.clientPhone);
      push(tr("القناة"), CHANNEL_LABELS[String(a.channel || "whatsapp").toLowerCase()] || a.channel);
      push(tr("رقم الفاتورة"), a.invoiceNumber);
      if (a.message) push(tr("الرسالة"), String(a.message).length > 80 ? String(a.message).slice(0, 80) + "…" : a.message);
    }
    return f;
  }, [act]);

  const status = act.status || "pending";

  return (
    <div className="act-card" style={{ borderColor: softAdapt(tone + "55", dark) }}>
      {/* رأس البطاقة */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: soft }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
          background: tone, color: "#fff", fontSize: 15, flexShrink: 0,
        }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: txAdapt(tone, dark) }}>{meta.title}</div>
          <div style={{ fontSize: 10.5, color: "var(--ia-sub)" }}>
            {status === "pending" ? tr("اقتراح من المساعد — راجع التفاصيل ثم نفّذ") :
             status === "executing" ? tr("جارٍ التنفيذ…") :
             status === "done" ? tr("✅ نُفِّذ بنجاح") :
             status === "failed" ? tr("فشل التنفيذ") :
             status === "dismissed" ? tr("تم التجاهل") : tr("إجراء من محادثة سابقة")}
          </div>
        </div>
        {status === "pending" && (
          <button onClick={onDismiss} title={tr("تجاهل الإجراء")}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 15, color: "var(--ia-muted)", padding: 4 }}>✖️</button>
        )}
      </div>

      {/* التفاصيل */}
      {status !== "dismissed" && fields.length > 0 && (
        <div style={{ padding: "8px 12px", background: "var(--ia-card)" }}>
          {fields.map(([k, v], i) => (
            <div key={i} className="act-row">
              <span className="act-k">{k}:</span>
              <span className="act-v">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* النتيجة */}
      {(status === "done" || status === "failed") && act.result && (
        <div style={{
          padding: "9px 12px", fontSize: 12.5, fontWeight: 700,
          background: status === "done" ? softAdapt("#dcfce7", dark) : softAdapt("#fee2e2", dark),
          color: status === "done" ? txAdapt("#15803d", dark) : txAdapt("#b91c1c", dark),
        }}>
          {status === "done" ? "✅ " : "⚠️ "}{act.result}
        </div>
      )}

      {/* أزرار التأكيد */}
      {status === "pending" && (
        <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: soft }}>
          <button onClick={onRun} style={{
            flex: 1, border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer",
            background: tone, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 800,
          }}>{tr("✅ تنفيذ الإجراء الآن")}</button>
          <button onClick={onDismiss} style={{
            border: "1.5px solid var(--ia-border2)", borderRadius: 8, padding: "9px 14px", cursor: "pointer",
            background: "transparent", color: "var(--ia-sub)", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          }}>{tr("تجاهل")}</button>
        </div>
      )}

      {status === "executing" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", background: soft, fontSize: 12.5, fontWeight: 700, color: "var(--ia-sub)" }}>
          <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${tone}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spinS .8s linear infinite" }} />
          {tr("جارٍ تنفيذ")} {meta.title}…
        </div>
      )}
    </div>
  );
}

function Dot({ delay }) {
  return <span style={{
    width: 7, height: 7, borderRadius: "50%", background: "var(--ia-muted)",
    display: "inline-block", animation: `pulseDot 1s ${delay} infinite`,
  }} />;
}
