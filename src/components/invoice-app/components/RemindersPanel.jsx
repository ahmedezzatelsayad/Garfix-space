"use client";

import { useState, useEffect } from "react";
import { api } from "../api";
import { txAdapt } from "../theme";
import { tr, dateLocale } from "@/lib/i18n-app";

// ─── Reminders panel (invoice detail) ────────────────────────────
// Audit trail of the WhatsApp payment reminders sent for this invoice.
// Every 📣 click (single or bulk) records a log entry server-side; this
// panel shows them so the collection follow-up history is visible.

const CHANNELS = [
  { id: "whatsapp", label: "واتساب", icon: "💬", color: "#16a34a", bg: "#dcfce7" },
  { id: "call", label: "اتصال", icon: "📞", color: "#2563eb", bg: "#dbeafe" },
  { id: "manual", label: "يدوي", icon: "✍️", color: "#b45309", bg: "#fef3c7" },
  { id: "payment_request", label: "طلب دفع", icon: "💳", color: "#0d9488", bg: "#ccfbf1" },
  { id: "statement", label: "كشف حساب", icon: "📄", color: "#7c3aed", bg: "#ede9fe" },
];

const timeAgoAr = iso => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tr("الآن");
  if (mins < 60) return tr("قبل {0} دقيقة",[mins]);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tr("قبل {0} ساعة",[hours]);
  const days = Math.floor(hours / 24);
  if (days < 30) return tr("قبل {0} يوم",[days]);
  return d.toLocaleDateString(dateLocale());
};

export default function RemindersPanel({ inv, company }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const col = company?.color || "#1e3a5f";
  const [dark, setDark] = useState(false);

  // track theme without pulling the full hook (this file runs under App root)
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const channelOf = id => {
    const c = CHANNELS.find(x => x.id === id) || CHANNELS[0];
    return { ...c, color: txAdapt(c.color, dark), bg: dark ? "rgba(255,255,255,.06)" : c.bg };
  };

  const load = async () => {
    if (!inv?.id) return;
    setLoading(true);
    try {
      const list = await api.listReminders(null, inv.id);
      setReminders(list || []);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [inv?.id]);

  // live-refresh when a reminder is logged from anywhere in the app
  useEffect(() => {
    const onLogged = e => {
      if (e.detail?.invoiceId == null || e.detail.invoiceId === inv?.id) load();
    };
    window.addEventListener("reminder-logged", onLogged);
    return () => window.removeEventListener("reminder-logged", onLogged);
  }, [inv?.id]);

  return (
    <div className="card" style={{ overflow: "hidden", marginTop: "12px", animation: "fadeUp .25s" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#15803d 0%,#16a34a 100%)", color: "#fff", padding: "12px 18px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "17px" }}>📣</span>
        <div style={{ fontWeight: 900, fontSize: "14px" }}>{tr("سجل التذكيرات")}</div>
        <span style={{ background: "rgba(255,255,255,.18)", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 }}>
          {reminders.length} {tr("تذكير")}
        </span>
        <div style={{ flex: 1 }} />
        {reminders.length > 0 && (
          <span style={{ fontSize: "11px", background: "rgba(255,255,255,.18)", padding: "3px 10px", borderRadius: "20px", fontWeight: 700 }}>
            {tr("آخر تذكير")} {timeAgoAr(reminders[0].createdAt)}
          </span>
        )}
      </div>

      {/* List */}
      <div style={{ padding: "8px 18px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "18px 0", fontSize: "13px" }}>{tr("⏳ جارٍ تحميل السجل...")}</div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "18px 0", fontSize: "13px" }}>
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>📭</div>
            {tr("لم يُرسل أي تذكير لهذه الفاتورة بعد")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "7px", maxHeight: "300px", overflowY: "auto" }}>
            {reminders.map((r) => {
              const c = channelOf(r.channel);
              const isOpen = expanded === r.id;
              return (
                <div key={r.id} style={{ background: "var(--ia-row-alt)", border: "1px solid var(--ia-border3)", borderRadius: "9px", padding: "9px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "34px", height: "34px", borderRadius: "9px", background: c.bg, color: c.color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: "0", fontSize: "15px" }}>{c.icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "10.5px", background: c.bg, color: c.color, padding: "1px 8px", borderRadius: "20px", fontWeight: 800 }}>{c.label}</span>
                        {r.amount != null && (
                          <span style={{ fontWeight: 800, fontSize: "12.5px", color: "var(--ia-red-tx)", direction: "ltr" }}>
                            {Number(r.amount).toFixed(3)} KD
                          </span>
                        )}
                        <span style={{ fontSize: "11px", color: "var(--ia-muted)" }}>{timeAgoAr(r.createdAt)}</span>
                      </div>
                      {r.message && !isOpen && (
                        <div style={{ fontSize: "11.5px", color: "var(--ia-sub)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.message.replace(/\n/g, " • ").slice(0, 80)}
                        </div>
                      )}
                    </div>
                    {r.message && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        title={isOpen ? tr("طي الرسالة") : tr("عرض الرسالة كاملة")}
                        style={{ background: "transparent", border: `1px solid ${col}44`, color: `var(--ia-text2)`, borderRadius: "7px", padding: "4px 9px", fontFamily: "inherit", fontSize: "11px", cursor: "pointer", flexShrink: 0 }}
                      >
                        {isOpen ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                  {r.message && isOpen && (
                    <div style={{ marginTop: "7px", padding: "9px 12px", background: "var(--ia-soft)", border: "1px solid var(--ia-border3)", borderRadius: "7px", fontSize: "11.5px", color: "var(--ia-text2)", whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                      {r.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
