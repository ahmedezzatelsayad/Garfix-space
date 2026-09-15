"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme, softAdapt, txAdapt } from "../theme";
import { tr, dateLocale } from "@/lib/i18n-app";

/**
 * r14: لوحة طوابير المهام (BullMQ) — مراقبة حيّة وإدارة
 * - بطاقات إحصائية: منتظرة/نشطة/مكتملة/فاشلة/مؤجلة/مجدولة
 * - حالة العامل (job-worker) مع آخر نتيجة
 * - المهام المجدولة (Job Schedulers) بمواعيد تشغيلها التالية
 * - آخر 24 مهمة مع مدة التنفيذ والنتيجة + إعادة محاولة الفاشلة
 * - أزرار تنفيذ فوري: نسخة احتياطية / تسخين الكاش / تنظيف / صيانة
 */

const JOB_AR = {
  backup: { label: "نسخة احتياطية", icon: "💾" },
  "cache-warm": { label: "تسخين الكاش", icon: "🔥" },
  "cleanup-backups": { label: "تنظيف النسخ", icon: "🧹" },
  "db-maintenance": { label: "صيانة القاعدة", icon: "🛠️" },
};

function fmtDur(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
function fmtTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return String(ts); }
}
function fmtAgo(ts) {
  if (!ts) return "—";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return tr("قبل {0} ثانية",[s]);
  if (s < 3600) return tr("قبل {0} دقيقة",[Math.floor(s / 60)]);
  if (s < 86400) return tr("قبل {0} ساعة",[Math.floor(s / 3600)]);
  return tr("قبل {0} يوم",[Math.floor(s / 86400)]);
}
function fmtUptime(sec) {
  if (sec == null) return "—";
  if (sec < 60) return tr("{0} ثانية",[sec]);
  if (sec < 3600) return tr("{0} دقيقة",[Math.floor(sec / 60)]);
  if (sec < 86400) return tr("{0} ساعة",[Math.floor(sec / 3600)]);
  return tr("{0} يوم",[Math.floor(sec / 86400)]);
}

export default function JobsPanel({ company, toast }) {
  const col = company?.color || "#1e3a5f";
  const { dark } = useTheme();
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setDenied(true); setData(null); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDenied(false);
      setData(await res.json());
    } catch { setData(null); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load, tick]);

  const run = async (name) => {
    const meta = JOB_AR[name];
    setBusy(name);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", name }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      toast?.(tr("✅ أُضيفت مهمة «{0}» إلى الطابور — رقم #{1}",[meta.label,(d.job?.id ?? "").slice(-6)]), "ok");
      setTimeout(load, 700);
    } catch (e) {
      toast?.(tr("⚠️ تعذر إضافة المهمة: {0}",[e.message]), "warn");
    } finally { setBusy(""); }
  };

  const retryJob = async (jobId) => {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", jobId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      toast?.(tr("🔄 أعيدت المهمة للمحاولة"), "ok");
      setTimeout(load, 600);
    } catch (e) {
      toast?.(`⚠️ ${e.message}`, "warn");
    }
  };

  if (denied) return (
    <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 18 }}>🔒</span>
      <div style={{ fontSize: 13, color: "var(--ia-sub)" }}>
        {tr("لوحة طوابير المهام متاحة")} <b>{tr("لمدير النظام فقط")}</b> {tr("— سجّل الدخول بحساب المدير لعرضها.")}
      </div>
    </div>
  );

  const counts = data?.counts ?? {};
  const worker = data?.worker ?? {};
  const jobs = data?.jobs ?? [];
  const scheduled = data?.scheduled ?? [];
  const workerUp = worker?.ok === true;

  const COUNTERS = [
    ["waiting", tr("منتظرة"), "⏳", "#b45309"],
    ["active", tr("نشطة"), "⚙️", "#2563eb"],
    ["completed", tr("مكتملة"), "✅", "#15803d"],
    ["failed", tr("فاشلة"), "❌", "#b91c1c"],
    ["delayed", tr("مؤجلة (مجدولة)"), "🕒", "#7c3aed"],
    ["paused", tr("موقوفة"), "⏸️", "#64748b"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ————— رأس اللوحة + حالة العامل ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17 }}>🐂</span>
          <b style={{ fontSize: 14 }}>{tr("طوابير المهام الخلفية (BullMQ)")}</b>
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 10px", borderRadius: 20, background: softAdapt("#f1f5f9", dark), color: "var(--ia-sub)" }}>
            {data?.engine || "bullmq@6"} · {data?.queue || "garfix-tasks"}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20,
            background: workerUp ? softAdapt("#dcfce7", dark) : softAdapt("#fee2e2", dark),
            color: workerUp ? txAdapt("#15803d", dark) : txAdapt("#b91c1c", dark),
          }}>
            {workerUp ? tr("🟢 العامل يعمل") : tr("🔴 العامل متوقف")}
          </span>
          <button onClick={() => setTick(t => t + 1)} className="btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }}>
            {tr("⟳ تحديث")}
          </button>
        </div>

        {/* بطاقات العدادات */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
          {COUNTERS.map(([k, label, icon, hue]) => (
            <div key={k} style={{
              padding: "10px 12px", borderRadius: 12, border: "1px solid var(--ia-border)",
              background: softAdapt("#f8fafc", dark), textAlign: "center",
            }}>
              <div style={{ fontSize: 16 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: dark ? "#e2e8f0" : "#0f172a", lineHeight: 1.2 }}>
                {counts[k] ?? 0}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: txAdapt(hue, dark) }}>{label}</div>
            </div>
          ))}
        </div>

        {/* بطاقة العامل */}
        <div style={{
          marginTop: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--ia-border)",
          background: softAdapt("#f8fafc", dark), display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 130 }}>
            <span style={{
              width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17,
              background: workerUp ? softAdapt("#dcfce7", dark) : softAdapt("#fee2e2", dark),
            }}>👷</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 12.5 }}>{tr("عامل المهام")}</div>
              <div style={{ fontSize: 10.5, color: workerUp ? txAdapt("#15803d", dark) : txAdapt("#b91c1c", dark), fontWeight: 700 }}>
                {workerUp ? tr("متصل ويستهلك") : tr("غير متصل")}
              </div>
            </div>
          </div>
          {[
            [tr("المعالجة"), worker.processed ?? 0],
            [tr("الفاشلة"), worker.failed ?? 0],
            [tr("مدة التشغيل"), fmtUptime(worker.uptimeSec)],
            [tr("آخر مهمة"), fmtAgo(worker.lastJobAt)],
          ].map(([k, v]) => (
            <div key={k} style={{ minWidth: 80 }}>
              <div style={{ fontSize: 10, color: "var(--ia-sub)", fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{String(v)}</div>
            </div>
          ))}
          {worker.currentJob && (
            <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: softAdapt("#fef3c7", dark), color: txAdapt("#b45309", dark), direction: "ltr" }}>
              {tr("⚙️ تعالج الآن:")} {worker.currentJob}
            </span>
          )}
        </div>

        {worker.lastError && (
          <div style={{ marginTop: 10, background: softAdapt("#fef2f2", dark), border: `1px solid ${txAdapt("#fca5a5", dark)}66`, color: txAdapt("#b91c1c", dark), borderRadius: 10, padding: "8px 12px", fontSize: 11.5, wordBreak: "break-word" }}>
            {tr("⚠️ آخر خطأ في العامل:")} {worker.lastError}
          </div>
        )}
      </div>

      {/* ————— أزرار التنفيذ الفوري ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <b style={{ fontSize: 13.5 }}>{tr("تنفيذ فوري")}</b>
          <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>{tr("(تُضاف للطابور وينفذها العامل خلال ثوانٍ)")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {Object.entries(JOB_AR).map(([name, meta]) => (
            <button
              key={name}
              onClick={() => run(name)}
              disabled={busy === name}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12,
                border: `1px solid ${col}33`, background: busy === name ? softAdapt("#f1f5f9", dark) : softAdapt("#ffffff", dark),
                cursor: busy === name ? "wait" : "pointer", textAlign: "start", transition: "all .15s",
                opacity: busy === name ? 0.7 : 1,
              }}
              onMouseEnter={(e) => { if (busy !== name) e.currentTarget.style.background = softAdapt("#f0f9ff", dark); }}
              onMouseLeave={(e) => { e.currentTarget.style.background = softAdapt("#ffffff", dark); }}
            >
              <span style={{ fontSize: 19 }}>{meta.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 800 }}>
                  {busy === name ? tr("…جارٍ الإضافة") : tr(meta.label)}
                </span>
                <span style={{ display: "block", fontSize: 10, color: "var(--ia-sub)" }}>
                  {name === "backup" ? tr("نسخة كاملة قابلة للاستعادة بـ Recovery")
                    : name === "cache-warm" ? tr("تسخين لوحات 4 شركات + الصفحات العامة")
                    : name === "cleanup-backups" ? tr("حذف النسخ الأقدم من 14 يوماً")
                    : tr("VACUUM ANALYZE — استعادة الأداء")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ————— المهام المجدولة ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🗓️</span>
          <b style={{ fontSize: 13.5 }}>{tr("الجدولة الدورية (Job Schedulers)")}</b>
          <span style={{ fontSize: 10.5, color: "var(--ia-sub)" }}>{tr("(توقيت Africa/Cairo)")}</span>
        </div>
        {!scheduled.length ? (
          <div className="sk sk-sm" style={{ width: "45%" }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {scheduled.map((s, i) => (
              <div key={i} style={{
                padding: "10px 13px", borderRadius: 12, border: "1px solid var(--ia-border)",
                background: softAdapt("#f8fafc", dark),
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 15 }}>{JOB_AR[s.name]?.icon ?? "📌"}</span>
                  <b style={{ fontSize: 12.5 }}>{tr(JOB_AR[s.name]?.label ?? s.name)}</b>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ia-sub)" }}>
                  <span style={{ fontFamily: "monospace", direction: "ltr", display: "inline-block" }}>{s.cron || "—"}</span>
                  {tr(" · التالية: ")}{fmtTime(s.next)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ————— آخر المهام ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <b style={{ fontSize: 13.5 }}>{tr("آخر المهام")}</b>
          <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>{tr("(تتحدث كل 5 ثوانٍ)")}</span>
        </div>
        {!jobs.length ? (
          <div style={{ fontSize: 12, color: "var(--ia-sub)", textAlign: "center", padding: "18px 0" }}>
            {tr("لا مهام بعد — شغّل مهمة من الأزرار أعلاه أو انتظر المجدولة الدورية.")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ia-border)" }}>
                  {[tr("المهمة"), tr("الحالة"), tr("المدة"), tr("انتهت"), tr("النتيجة"), ""].map((h) => (
                    <th key={h} style={{ textAlign: "start", padding: "7px 8px", fontSize: 10.5, color: "var(--ia-sub)", fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid var(--ia-border)", background: j.state === "failed" ? softAdapt("#fef2f2", dark) : "transparent" }}>
                    <td style={{ padding: "7px 8px", fontWeight: 800, whiteSpace: "nowrap" }}>
                      {JOB_AR[j.name]?.icon ?? "📌"} {tr(JOB_AR[j.name]?.label ?? j.name)}
                      {j.repeat && <span style={{ fontSize: 9, color: "var(--ia-sub)", fontWeight: 700 }}> {tr("↻ مجدولة")}</span>}
                    </td>
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 20,
                        background: j.state === "completed" ? softAdapt("#dcfce7", dark) : softAdapt("#fee2e2", dark),
                        color: j.state === "completed" ? txAdapt("#15803d", dark) : txAdapt("#b91c1c", dark),
                      }}>
                        {j.state === "completed" ? tr("✓ مكتملة") : tr("✗ فاشلة")}
                      </span>
                    </td>
                    <td style={{ padding: "7px 8px", fontFamily: "monospace", direction: "ltr", whiteSpace: "nowrap" }}>{fmtDur(j.durationMs)}</td>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap", color: "var(--ia-sub)" }}>{fmtAgo(j.finishedAt ?? j.enqueuedAt)}</td>
                    <td style={{ padding: "7px 8px", maxWidth: 280 }}>
                      {j.state === "failed" ? (
                        <span style={{ color: txAdapt("#b91c1c", dark), fontSize: 10.5, wordBreak: "break-word" }}>{j.failedReason ?? tr("خطأ غير معروف")}</span>
                      ) : (
                        <ResultSnippet result={j.result} dark={dark} />
                      )}
                    </td>
                    <td style={{ padding: "7px 8px" }}>
                      {j.state === "failed" && (
                        <button onClick={() => retryJob(j.id)} style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 8, border: "1px solid #f59e0b66", background: softAdapt("#fef3c7", dark), color: txAdapt("#b45309", dark), cursor: "pointer" }}>
                          {tr("↻ أعِد المحاولة")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** مقتطف نتيجة المهمة بحسب نوعها */
function ResultSnippet({ result, dark }) {
  if (result == null) return <span style={{ color: "var(--ia-sub)", fontSize: 10.5 }}>—</span>;
  const r = typeof result === "object" ? result : { value: result };
  let text = "";
  if (typeof r.file === "string") text = `📄 ${r.file} (${r.bytes > 1024 ? `${(r.bytes / 1024).toFixed(1)}KB` : `${r.bytes}B`})`;
  else if (typeof r.warmed === "number") text = tr("🔥 سُخّنت {0} نقطة نهاية{1}",[r.warmed,r.errors?.length ? tr(" · {0} أخطاء",[r.errors.length]) : tr(" بلا أخطاء")]);
  else if (typeof r.deleted === "number") text = tr("🧹 حُذفت {0} ملفاً{1}",[r.deleted,r.freedBytes ? ` (${Math.round(r.freedBytes / 1024)}KB)` : ""]);
  else if (r.ok === true && r.command) text = tr("🛠️ {0} في {1}",[r.command,fmtDur(r.durationMs)]);
  else text = JSON.stringify(r).slice(0, 90);
  return <span style={{ fontSize: 10.5, color: "var(--ia-sub)", wordBreak: "break-word", display: "inline-block", maxWidth: 280 }}>{text}</span>;
}
