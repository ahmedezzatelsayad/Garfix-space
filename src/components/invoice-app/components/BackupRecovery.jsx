"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme, txAdapt, softAdapt } from "../theme";
import { tr, dateLocale } from "@/lib/i18n-app";

/* r10: النسخ الاحتياطي والاستعادة (Recovery) + حالة البنية التحتية
 * - ⬇️ نسخة احتياطية كاملة من PostgreSQL (تنزيل JSON)
 * - ♻️ Recovery: رفع ملف نسخة واستعادة استبدالية داخل معاملة ذرّية
 * - 🖥️ حالة النظام: PostgreSQL + Valkey (زمن الاستجابة ونسبة إصابة الكاش)
 */

export default function BackupRecovery({ company }) {
  const col = company?.color || "#1e3a5f";
  const { dark } = useTheme();

  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [lastBackupInfo, setLastBackupInfo] = useState(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // {generatedAt, engine, counts, ok, error}
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState(null); // {restored, message, error}
  const [confirmText, setConfirmText] = useState("");
  const [health, setHealth] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const t = localStorage.getItem("garfix_last_backup");
    if (t) setLastBackup(t);
    const info = localStorage.getItem("garfix_last_backup_info");
    if (info) { try { setLastBackupInfo(JSON.parse(info)); } catch {} }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/healthz");
      setHealth(await res.json());
    } catch { setHealth(null); }
  }, []);
  useEffect(() => { loadHealth(); const t = setInterval(loadHealth, 15000); return () => clearInterval(t); }, [loadHealth]);

  /* ————— النسخة الاحتياطية ————— */
  const doBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const text = await blob.text();
      const data = JSON.parse(text);
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = `garfix-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const now = new Date().toISOString();
      setLastBackup(now);
      localStorage.setItem("garfix_last_backup", now);
      const info = { counts: data.counts, generatedAt: data.generatedAt, engine: data.engine };
      setLastBackupInfo(info);
      localStorage.setItem("garfix_last_backup_info", JSON.stringify(info));
    } catch (e) {
      alert(tr("فشل إنشاء النسخة الاحتياطية: ") + e.message);
    } finally {
      setBackingUp(false);
    }
  };

  /* ————— معاينة ملف الاستعادة ————— */
  const pickFile = async e => {
    const f = e.target.files?.[0];
    setResult(null);
    setConfirmText("");
    setPreview(null);
    setFile(null);
    if (!f) return;
    setFile(f);
    try {
      if (f.size > 100 * 1024 * 1024) throw new Error(tr("الملف كبير جداً (الحد 100MB)"));
      const text = await f.text();
      const data = JSON.parse(text);
      // r21: النسخ القديمة (النظام الأصلي) مقبولة — تُرحَّل تلقائياً عند الاستعادة
      const legacy = data && typeof data === "object" && data.meta && Array.isArray(data.invoices) && data.app !== "garfix-accounts";
      if (!legacy && (data.app !== "garfix-accounts" || !data.data)) throw new Error(tr("هذا الملف ليس نسخة احتياطية من نظام جرفِكس"));
      if (legacy) {
        const counts = {};
        for (const k of ["invoices", "companies", "clients", "catalog", "purchases", "users", "auditLogs"]) {
          if (Array.isArray(data[k])) counts[k] = data[k].length;
        }
        setPreview({
          ok: true,
          legacy: true,
          generatedAt: data.meta?.createdAt,
          engine: "legacy",
          counts,
        });
      } else {
        setPreview({
          ok: true,
          generatedAt: data.generatedAt,
          engine: data.engine,
          counts: data.counts || {},
        });
      }
    } catch (err) {
      setPreview({ ok: false, error: err.message });
    }
  };

  /* ————— الاستعادة ————— */
  const doRecovery = async () => {
    if (!file || !preview?.ok) return;
    if (confirmText.trim() !== tr("استعادة")) return;
    setRestoring(true);
    setResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ ok: true, restored: data.restored, message: data.message, backupGeneratedAt: data.backupGeneratedAt });
      loadHealth();
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setRestoring(false);
      setConfirmText("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const totalRows = preview?.counts
    ? Object.values(preview.counts).reduce((s, n) => s + Number(n || 0), 0)
    : 0;

  const AR_TABLES = {
    companies: tr("الشركات"), clients: tr("العملاء"), invoices: tr("الفواتير"), payments: tr("المدفوعات"),
    productCatalog: tr("الكتالوج"), purchaseInvoices: tr("المشتريات"), reminderLogs: tr("التذكيرات"),
    settings: tr("الإعدادات"), aiConversations: tr("محادثات AI"), aiMessages: tr("رسائل AI"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeUp .25s" }}>
      {/* ————— بطاقتا العمل ————— */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>

        {/* النسخة الاحتياطية */}
        <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${col}, ${txAdapt(col, true)})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: `0 4px 12px ${col}33` }}>⬇️</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14.5 }}>{tr("النسخة الاحتياطية")}</div>
              <div style={{ fontSize: 11.5, color: "var(--ia-sub)" }}>{tr("تنزيل نسخة كاملة من قاعدة PostgreSQL")}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: "var(--ia-sub)", lineHeight: 1.9, marginBottom: 12, flex: 1 }}>
            {tr("تشمل النسخة: الشركات، العملاء، الفواتير، المدفوعات، الكتالوج، المشتريات، التذكيرات، الإعدادات ومحادثات المساعد الذكي.")}
            <br />{tr("🔐 مفتاح DeepSeek")} <b>{tr("لا يُضم")}</b> {tr("إلى النسخة الاحتياطية (يبقى محفوظاً على الخادم).")}
          </div>

          {lastBackupInfo?.counts && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {Object.entries(lastBackupInfo.counts).filter(([, n]) => Number(n) > 0).slice(0, 6).map(([k, n]) => (
                <span key={k} style={{ fontSize: 10.5, background: softAdapt("#eff6ff", dark), color: txAdapt("#1d4ed8", dark), padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>
                  {AR_TABLES[k] || k}: {n}
                </span>
              ))}
            </div>
          )}

          <button className="btn" onClick={doBackup} disabled={backingUp}
            style={{ background: col, color: "#fff", justifyContent: "center", padding: "12px 16px", fontSize: 13.5 }}>
            {backingUp ? tr("⏳ جارٍ تجهيز النسخة…") : tr("⬇️ تنزيل نسخة احتياطية (JSON)")}
          </button>
          {lastBackup && (
            <div style={{ fontSize: 11, color: "var(--ia-sub)", textAlign: "center", marginTop: 8 }}>
              {tr("آخر نسخة:")} {new Date(lastBackup).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
        </div>

        {/* الاستعادة Recovery */}
        <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", border: `1.5px solid ${txAdapt("#f59e0b", dark)}44` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, #d97706, #b45309)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 12px rgba(217,119,6,.3)" }}>♻️</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14.5 }}>{tr("Recovery — الاستعادة")}</div>
              <div style={{ fontSize: 11.5, color: "var(--ia-sub)" }}>{tr("استبدال كامل من ملف نسخة احتياطية")}</div>
            </div>
          </div>

          <div style={{
            fontSize: 11.5, lineHeight: 1.8, marginBottom: 12, flex: 1,
            background: softAdapt("#fef3c7", dark), border: `1px solid ${txAdapt("#fbbf24", dark)}55`,
            color: txAdapt("#92400e", dark), borderRadius: 10, padding: "10px 12px", fontWeight: 600,
          }}>
            {tr("⚠️ عملية")} <b>{tr("استبدالية")}</b>{tr(": كل البيانات الحالية تُمحى وتُستبدال بمحتوى الملف — داخل معاملة ذرّية واحدة (نجاح كامل أو تراجع كامل). إعدادات DeepSeek لا تتأثر.")}
          </div>

          <input ref={fileRef} type="file" accept=".json,application/json" onChange={pickFile}
            style={{ display: "none" }} id="recovery-file" />
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()} disabled={restoring}
            style={{ justifyContent: "center", padding: "11px 16px", marginBottom: 10 }}>
            {tr("📂 اختيار ملف النسخة الاحتياطية…")}
          </button>

          {preview?.ok && (
            <div style={{ background: softAdapt("#f0fdf4", dark), border: `1px solid ${txAdapt("#86efac", dark)}66`, borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <b style={{ fontSize: 12.5 }}>{tr("✅ ملف صالح")}</b>
                <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>
                  {totalRows} {tr("صف إجمالاً • أُنشئ")} {new Date(preview.generatedAt).toLocaleString(dateLocale(), { dateStyle: "short", timeStyle: "short" })}
                  {preview.engine ? ` • ${preview.engine}` : ""}
                  {preview.legacy ? ` • ${tr("نسخة قديمة — ستُرحَّل بياناتها تلقائياً (المستخدمون وسجل التدقيق يُتخطيان)")}` : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {Object.entries(preview.counts).filter(([, n]) => Number(n) > 0).map(([k, n]) => (
                  <span key={k} style={{ fontSize: 10.5, background: softAdapt("#dcfce7", dark), color: txAdapt("#15803d", dark), padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>
                    {AR_TABLES[k] || k}: {n}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11.5, color: "var(--ia-sub)", marginBottom: 4 }}>
                  {tr("للتأكيد اكتب كلمة")} <b style={{ color: txAdapt("#b45309", dark) }}>{tr("«استعادة»")}</b>:
                </div>
                <input className="inp" value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder={tr("استعادة")} style={{ maxWidth: 180, textAlign: "center", fontWeight: 800 }} />
              </div>
              <button className="btn btn-red" onClick={doRecovery} disabled={restoring || confirmText.trim() !== tr("استعادة")}
                style={{ marginTop: 10, width: "100%", justifyContent: "center", padding: "11px 16px" }}>
                {restoring ? tr("⏳ جارٍ الاستعادة…") : tr("♻️ تنفيذ الاستعادة الآن")}
              </button>
            </div>
          )}
          {preview && !preview.ok && (
            <div style={{ background: softAdapt("#fef2f2", dark), border: `1px solid ${txAdapt("#fca5a5", dark)}66`, color: txAdapt("#b91c1c", dark), borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 700 }}>
              ❌ {preview.error}
            </div>
          )}

          {restoring && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: "var(--ia-sub)" }}>
              <span className="sk sk-sm" style={{ display: "inline-block", width: "60%", marginBottom: 6 }} />
              <div>{tr("جارٍ محو البيانات الحالية وإدراج")} {totalRows} {tr("صفاً…")}</div>
            </div>
          )}

          {result?.ok && (
            <div style={{ marginTop: 10, background: softAdapt("#f0fdf4", dark), border: `1px solid ${txAdapt("#86efac", dark)}66`, borderRadius: 10, padding: "12px 14px" }}>
              <b style={{ fontSize: 13, color: txAdapt("#15803d", dark) }}>🎉 {result.message}</b>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                {Object.entries(result.restored || {}).filter(([, n]) => Number(n) > 0).map(([k, n]) => (
                  <span key={k} style={{ fontSize: 10.5, background: softAdapt("#dcfce7", dark), color: txAdapt("#15803d", dark), padding: "2px 9px", borderRadius: 20, fontWeight: 700 }}>
                    {AR_TABLES[k] || k}: {n}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--ia-sub)", marginTop: 8 }}>{tr("ℹ️ أعد تحميل الصفحة (F5) لرؤية البيانات المستعادة في كل التبويبات.")}</div>
            </div>
          )}
          {result && !result.ok && (
            <div style={{ marginTop: 10, background: softAdapt("#fef2f2", dark), border: `1px solid ${txAdapt("#fca5a5", dark)}66`, color: txAdapt("#b91c1c", dark), borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 700, wordBreak: "break-word" }}>
              ❌ {result.error}
            </div>
          )}
        </div>
      </div>

      {/* ————— حالة النظام ————— */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 17 }}>🖥️</span>
          <b style={{ fontSize: 14 }}>{tr("حالة النظام الحيّة")}</b>
          <span style={{ fontSize: 11, color: "var(--ia-sub)" }}>{tr("(تتحدث كل 15 ثانية)")}</span>
          <div style={{ flex: 1 }} />
          {health && (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 12px", borderRadius: 20,
              background: health.status === "ok" ? softAdapt("#dcfce7", dark) : softAdapt("#fef3c7", dark),
              color: health.status === "ok" ? txAdapt("#15803d", dark) : txAdapt("#b45309", dark),
            }}>
              {health.status === "ok" ? tr("🟢 النظام سليم") : tr("🟡 تحذير — يعمل بوضع بديل")}
            </span>
          )}
        </div>
        {!health ? (
          <div className="sk sk-sm" style={{ width: "50%" }} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {/* PostgreSQL */}
            <StatusTile
              icon="🐘" title="PostgreSQL 17" dark={dark}
              ok={health.database?.ok}
              main={health.database?.ok ? tr("متصل ويعمل") : tr("غير متصل!")}
              rows={[
                [tr("زمن الاستجابة"), health.database?.latencyMs != null ? `${health.database.latencyMs}ms` : "—"],
                [tr("المحرك"), health.database?.engine || "postgresql"],
              ]}
              error={health.database?.error}
            />
            {/* Valkey */}
            <StatusTile
              icon="⚡" title={tr("Valkey 8.1 (كاش)")} dark={dark}
              ok={health.cache?.connected}
              main={health.cache?.connected ? tr("متصل — {0}",[health.cache.engine]) : tr("غير متصل — {0}",[health.cache.engine])}
              rows={[
                [tr("نسبة الإصابة"), `${health.cache?.hitRate ?? 0}%`],
                [tr("إصابات / كتابات"), `${health.cache?.hits ?? 0} / ${health.cache?.writes ?? 0}`],
              ]}
              error={health.cache?.lastError}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusTile({ icon, title, ok, main, rows, error, dark }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: softAdapt("#f8fafc", dark), border: "1px solid var(--ia-border)",
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        background: ok ? softAdapt("#dcfce7", dark) : softAdapt("#fee2e2", dark), fontSize: 19, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "#16a34a" : "#dc2626", boxShadow: ok ? "0 0 0 3px rgba(34,197,94,.2)" : "0 0 0 3px rgba(220,38,38,.2)" }} />
          {title}
        </div>
        <div style={{ fontSize: 12, color: ok ? txAdapt("#15803d", dark) : txAdapt("#b91c1c", dark), fontWeight: 700, marginTop: 2 }}>{main}</div>
        {rows.map(([k, v], i) => (
          <div key={i} style={{ fontSize: 11, color: "var(--ia-sub)", marginTop: 3, display: "flex", justifyContent: "space-between" }}>
            <span>{k}</span><b style={{ direction: "ltr" }}>{v}</b>
          </div>
        ))}
        {error && <div style={{ fontSize: 10.5, color: txAdapt("#b91c1c", dark), marginTop: 4, wordBreak: "break-all" }}>{String(error).slice(0, 90)}</div>}
      </div>
    </div>
  );
}
