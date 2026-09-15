"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useTheme, txAdapt, softAdapt, chartColors } from "../theme";
import { api } from "../api";

// ─── Reports & Analytics Tab ──────────────────────────────────────
// Comprehensive analytics computed client-side from the company invoices
// (same data source as the Dashboard — works offline via localStorage cache).

import { fmtMoney } from "../currency";
import { tr, dateLocale } from "@/lib/i18n-app";
const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN = s => parseFloat(toW(String(s || 0)).replace(/[^\d.]/g, "")) || 0;
const fKWD = n => fmtMoney(n); // r12: عملة الشركة النشطة
const iT = inv => (inv.items || []).reduce((s, it) => s + pN(it.qty) * pN(it.price), 0) + pN(inv.shipping || 0);
const getStatus = inv => {
  if (inv.status === "cancelled") return "cancel";
  const tot = iT(inv); const paid = pN(inv.paid || 0);
  return paid >= tot ? "paid" : paid > 0 ? "part" : "unp";
};
const stLabel = { paid: "مدفوعة", part: "جزئي", unp: "غير مدفوعة", cancel: "ملغية" };
const stColor = { paid: "#16a34a", part: "#d97706", unp: "#dc2626", cancel: "#94a3b8" };

const PERIODS = [
  { id: 3, label: "٣ أشهر" },
  { id: 6, label: "٦ أشهر" },
  { id: 12, label: "سنة" },
  { id: 0, label: "الكل" },
];

const PAY_METHODS = { cash: "نقدي", knet: "كي نت", online: "تحويل", card: "بطاقة" };

export default function ReportsTab({ invoices = [], company, purchases = [] }) {
  const [period, setPeriod] = useState(6); // months; 0 = all
  const [reminders, setReminders] = useState(null); // collection activity (audit log)
  const { dark } = useTheme();
  const ch = chartColors(dark);
  const col = company?.color || "#1e3a5f";
  const colTx = txAdapt(col, dark);

  // ── period filtering ── (React Compiler memoizes automatically)
  const monthsAgo = (() => {
    if (!period) return null;
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() - (period - 1), 1);
  })();

  const scoped = (() => {
    if (!monthsAgo) return invoices;
    const key = monthsAgo.getTime();
    return invoices.filter(inv => {
      if (!inv.date) return false;
      const d = new Date(inv.date + "T00:00:00");
      return d.getTime() >= key;
    });
  })();

  // ── core aggregates ──
  const stats = (() => {
    const active = scoped.filter(inv => getStatus(inv) !== "cancel");
    const totalRev = active.reduce((s, inv) => s + iT(inv), 0);
    const totalPaid = active.reduce((s, inv) => s + Math.min(pN(inv.paid || 0), iT(inv)), 0);
    const outstanding = Math.max(0, totalRev - totalPaid);
    const collectionRate = totalRev > 0 ? (totalPaid / totalRev * 100) : 0;
    const avgInv = active.length ? totalRev / active.length : 0;

    // status amounts (for donut)
    const byStatus = { paid: 0, part: 0, unp: 0, cancel: 0 };
    scoped.forEach(inv => { byStatus[getStatus(inv)] += iT(inv); });

    // overdue
    const todayStr = new Date().toISOString().split("T")[0];
    const overdue = scoped.filter(inv => {
      const st = getStatus(inv);
      return (st === "unp" || st === "part") && inv.dueDate && inv.dueDate < todayStr;
    });
    const overdueAmt = overdue.reduce((s, inv) => s + iT(inv) - pN(inv.paid || 0), 0);

    // customers
    const custMap = {};
    scoped.forEach(inv => {
      const st = getStatus(inv);
      if (st === "cancel") return;
      const k = inv.clientPhone || inv.clientName || tr("عميل");
      if (!custMap[k]) custMap[k] = { name: inv.clientName || inv.clientPhone, phone: inv.clientPhone, rev: 0, cnt: 0, paid: 0 };
      custMap[k].rev += iT(inv);
      custMap[k].cnt += 1;
      custMap[k].paid += Math.min(pN(inv.paid || 0), iT(inv));
    });
    const topCustomers = Object.values(custMap).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const uniqueC = Object.keys(custMap).length;

    // products
    const prodMap = {};
    scoped.forEach(inv => {
      if (getStatus(inv) === "cancel") return;
      (inv.items || []).forEach(it => {
        const name = (it.name || "").trim();
        if (!name) return;
        if (!prodMap[name]) prodMap[name] = { name, qty: 0, rev: 0 };
        prodMap[name].qty += pN(it.qty);
        prodMap[name].rev += pN(it.qty) * pN(it.price);
      });
    });
    const topProducts = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 6);

    // monthly series (full months in period)
    const nMonths = period || 12;
    const now = new Date();
    const series = Array.from({ length: nMonths }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (nMonths - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(dateLocale(), { month: "short" });
      const monthInvs = scoped.filter(x => x.date?.startsWith(key));
      const monthActive = monthInvs.filter(x => getStatus(x) !== "cancel");
      return {
        label, key,
        rev: monthActive.reduce((s, x) => s + iT(x), 0),
        paid: monthActive.reduce((s, x) => s + Math.min(pN(x.paid || 0), iT(x)), 0),
        cnt: monthInvs.length,
      };
    });

    // best month
    const bestMonth = series.reduce((b, m) => (m.rev > (b?.rev || 0) ? m : b), null);
    const bestMonthLabel = bestMonth && bestMonth.rev > 0
      ? bestMonth.label + " (" + fKWD(bestMonth.rev) + ")" : "—";

    return {
      totalRev, totalPaid, outstanding, collectionRate, avgInv, byStatus,
      overdue, overdueAmt, topCustomers, topProducts, series, uniqueC,
      count: scoped.length, activeCount: active.length, bestMonth, bestMonthLabel,
    };
  })();

  const donutData = [
    { name: tr(stLabel.paid), value: stats.byStatus.paid, color: txAdapt(stColor.paid, dark) },
    { name: tr(stLabel.part), value: stats.byStatus.part, color: txAdapt(stColor.part, dark) },
    { name: tr(stLabel.unp), value: stats.byStatus.unp, color: txAdapt(stColor.unp, dark) },
    { name: tr(stLabel.cancel), value: stats.byStatus.cancel, color: txAdapt(stColor.cancel, dark) },
  ].filter(d => d.value > 0);

  const maxCustRev = stats.topCustomers[0]?.rev || 1;
  const maxProdQty = stats.topProducts[0]?.qty || 1;

  // ── receivables aging buckets (تقادم الذمم) ──
  const aging = (() => {
    const buckets = [
      { id: "current", label: tr("غير مستحقة"), sub: tr("لم يحل موعد السداد"), amount: 0, count: 0, color: "#16a34a" },
      { id: "d30", label: tr("١–٣٠ يوم"), sub: tr("تأخير قصير"), amount: 0, count: 0, color: "#65a30d" },
      { id: "d60", label: tr("٣١–٦٠ يوم"), sub: tr("تأخير متوسط"), amount: 0, count: 0, color: "#d97706" },
      { id: "d90", label: tr("٦١–٩٠ يوم"), sub: tr("تأخير طويل"), amount: 0, count: 0, color: "#ea580c" },
      { id: "d90p", label: tr("+٩٠ يوم"), sub: tr("مخاطرة عالية"), amount: 0, count: 0, color: "#dc2626" },
    ];
    scoped.forEach(inv => {
      if (getStatus(inv) === "cancel") return;
      const rem = iT(inv) - pN(inv.paid || 0);
      if (rem <= 0.0001) return;
      let od = 0;
      if (inv.dueDate) {
        const d = new Date(inv.dueDate + "T00:00:00");
        if (!isNaN(d)) od = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
      }
      const idx = od <= 0 ? 0 : od <= 30 ? 1 : od <= 60 ? 2 : od <= 90 ? 3 : 4;
      buckets[idx].amount += rem;
      buckets[idx].count += 1;
    });
    return buckets;
  })();
  const agingTotal = aging.reduce((s, b) => s + b.amount, 0);

  // ── collection-activity stats from the reminder audit log ──
  useEffect(() => {
    let on = true;
    if (!company?.sk) { setReminders([]); return () => { on = false; }; }
    api.listReminders(company.sk)
      .then(list => { if (on) setReminders(list || []); })
      .catch(() => { if (on) setReminders([]); });
    return () => { on = false; };
  }, [company?.sk]);

  const reminderStats = (() => {
    if (!reminders || !reminders.length) return null;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonth = reminders.filter(r => String(r.createdAt || "").startsWith(monthKey)).length;
    const last = reminders[0]; // API returns newest first
    const lastD = new Date(last.createdAt);
    const lastTxt = isNaN(lastD.getTime()) ? "" : lastD.toLocaleDateString(dateLocale());
    const totalAmount = reminders.reduce((s, r) => s + pN(r.amount), 0);
    return { count: reminders.length, thisMonth, lastTxt, totalAmount };
  })();

  // ── auto insights ──
  const insights = (() => {
    const list = [];
    if (stats.collectionRate >= 80) list.push({ icon: "🟢", c: txAdapt("#16a34a", dark), t: tr("نسبة التحصيل ممتازة ({0}%) — استمر في نفس النهج",[stats.collectionRate.toFixed(0)]) });
    else if (stats.collectionRate >= 50) list.push({ icon: "🟡", c: txAdapt("#d97706", dark), t: tr("نسبة التحصيل {0}% — يمكن متابعة العملاء غير المدفوعين لرفعها",[stats.collectionRate.toFixed(0)]) });
    else if (stats.totalRev > 0) list.push({ icon: "🔴", c: txAdapt("#dc2626", dark), t: tr("نسبة التحصيل منخفضة ({0}%) — {1} KD مستحقة عليك متابعتها",[stats.collectionRate.toFixed(0),stats.outstanding.toFixed(1)]) });
    if (stats.overdue.length > 0) list.push({ icon: "⏰", c: txAdapt("#dc2626", dark), t: tr("{0} فاتورة متأخرة عن الاستحقاق بإجمالي {1} — تواصل مع العملاء",[stats.overdue.length,fKWD(stats.overdueAmt)]) });
    if (aging[4].amount > 0) list.push({ icon: "🚨", c: txAdapt("#dc2626", dark), t: tr("{0} فاتورة متأخرة أكثر من ٩٠ يوم ({1}) — أولوية تحصيل قصوى",[aging[4].count,fKWD(aging[4].amount)]) });
    else if (aging[3].amount > 0) list.push({ icon: "⚠️", c: txAdapt("#ea580c", dark), t: tr("{0} فاتورة في نطاق ٦١–٩٠ يوم ({1}) — اقتربت من مرحلة المخاطرة",[aging[3].count,fKWD(aging[3].amount)]) });
    if (stats.bestMonth && stats.bestMonth.rev > 0) list.push({ icon: "🏆", c: dark ? colTx : col, t: tr("أفضل شهر في الفترة: {0} بإيرادات {1}",[stats.bestMonth.label,fKWD(stats.bestMonth.rev)]) });
    if (stats.topProducts[0]) list.push({ icon: "📦", c: txAdapt("#7c3aed", dark), t: tr("المنتج الأكثر مبيعاً: {0} ({1} قطعة)",[stats.topProducts[0].name,stats.topProducts[0].qty]) });
    if (stats.topCustomers[0]) list.push({ icon: "👑", c: txAdapt("#b45309", dark), t: tr("أفضل عميل: {0} بإجمالي {1}",[stats.topCustomers[0].name,fKWD(stats.topCustomers[0].rev)]) });
    // revenue trend vs previous half
    if (stats.series.length >= 2) {
      const half = Math.floor(stats.series.length / 2);
      const recent = stats.series.slice(half).reduce((s, m) => s + m.rev, 0);
      const older = stats.series.slice(0, half).reduce((s, m) => s + m.rev, 0);
      if (older > 0) {
        const pct = ((recent - older) / older * 100);
        list.push({ icon: pct >= 0 ? "📈" : "📉", c: txAdapt(pct >= 0 ? "#16a34a" : "#dc2626", dark), t: tr("النصف الأخير من الفترة {0} بنسبة {1}% من النصف الأول",[pct >= 0 ? tr("أعلى") : tr("أقل"),Math.abs(pct).toFixed(0)]) });
      }
    }
    if (!list.length) list.push({ icon: "📊", c: "var(--ia-sub)", t: tr("لا توجد بيانات كافية في هذه الفترة — جرّب توسيع النطاق الزمني") });
    return list.slice(0, 6);
  })();

  const card = { background: "var(--ia-card)", borderRadius: "14px", padding: "18px 20px", border: "1.5px solid var(--ia-border)" };
  const sectionTitle = { fontSize: "13px", fontWeight: 800, color: "var(--ia-text)", display: "flex", alignItems: "center", gap: "6px" };

  if (!invoices.length) {
    return (
      <div className="card" style={{ padding: "56px", textAlign: "center", color: "var(--ia-muted)" }}>
        <div style={{ fontSize: "44px", marginBottom: "10px" }}>📊</div>
        <div style={{ fontWeight: 700, color: "var(--ia-sub)" }}>{tr("لا توجد بيانات لعرض التقارير")}</div>
        <div style={{ fontSize: "12px", marginTop: "6px" }}>{tr("أنشئ فواتير أو استوردها من ملف CSV / Excel لتظهر التحليلات")}</div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeUp .25s" }}>
      {/* Header + period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: col }}>{tr("📊 التقارير والتحليلات —")} {company?.nameAr}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "6px", background: "var(--ia-card)", padding: "4px", borderRadius: "10px", border: "1.5px solid var(--ia-border)" }}>
          {PERIODS.map(p => {
            const active = period === p.id;
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                border: "none", background: active ? col : "transparent", color: active ? "#fff" : "var(--ia-sub)",
                borderRadius: "7px", padding: "5px 12px", fontFamily: "inherit", fontSize: "12px",
                fontWeight: 700, cursor: "pointer", transition: "all .15s",
              }}>{p.label}</button>
            );
          })}
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <div style={{ background: `linear-gradient(135deg,${softAdapt("#e8f0fe", dark)} 0%,${softAdapt("#dbeafe", dark)} 100%)`, borderRadius: "14px", padding: "14px 16px", border: `1.5px solid ${col}22` }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>💰</div>
          <div style={{ fontSize: "10px", color: "var(--ia-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>{tr("إيرادات الفترة")}</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: dark ? colTx : col, direction: "ltr", textAlign: "start" }}>{fKWD(stats.totalRev)}</div>
          <div style={{ fontSize: "11px", color: "var(--ia-sub)", marginTop: "5px" }}>{stats.count} {tr("فاتورة •")} {stats.uniqueC} {tr("عميل")}</div>
        </div>
        <div style={{ background: `linear-gradient(135deg,${softAdapt("#dcfce7", dark)} 0%,${softAdapt("#d1fae5", dark)} 100%)`, borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #16a34a22" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>✅</div>
          <div style={{ fontSize: "10px", color: "var(--ia-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>{tr("نسبة التحصيل")}</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: txAdapt("#16a34a", dark), direction: "ltr", textAlign: "start" }}>{stats.collectionRate.toFixed(1)}%</div>
          <div style={{ height: "6px", background: "var(--ia-ok-bg)", borderRadius: "4px", marginTop: "7px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, stats.collectionRate)}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: "4px", transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: "10px", color: "var(--ia-sub)", marginTop: "4px" }}>{tr("محصّل")} {fKWD(stats.totalPaid)} {tr("من")} {fKWD(stats.totalRev)}</div>
        </div>
        <div style={{ background: `linear-gradient(135deg,${softAdapt("#fef3c7", dark)} 0%,${softAdapt("#fde68a", dark)} 100%)`, borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #d9770622" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>🧾</div>
          <div style={{ fontSize: "10px", color: "var(--ia-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>{tr("متوسط الفاتورة")}</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: "var(--ia-warn-tx)", direction: "ltr", textAlign: "start" }}>{fKWD(stats.avgInv)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
            <span style={{ fontSize: "11px", color: "var(--ia-sub)" }}>{stats.activeCount} {tr("فاتورة فعّالة")}</span>
            {stats.overdue.length > 0 && <span style={{ fontSize: "10px", fontWeight: 800, color: txAdapt("#dc2626", dark), background: "var(--ia-red-bg)", padding: "1px 8px", borderRadius: "20px" }}>⏰ {stats.overdue.length} {tr("متأخرة")}</span>}
          </div>
        </div>
        <div style={{ background: `linear-gradient(135deg,${softAdapt("#ede9fe", dark)} 0%,${softAdapt("#ddd6fe", dark)} 100%)`, borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #7c3aed22" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>🏆</div>
          <div style={{ fontSize: "10px", color: "var(--ia-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>{tr("أفضل شهر")}</div>
          <div style={{ fontSize: "15px", fontWeight: 900, color: "var(--ia-vio-tx)" }}>{stats.bestMonthLabel}</div>
          <div style={{ fontSize: "11px", color: "var(--ia-sub)", marginTop: "5px" }}>{tr("متبقٍ مستحق:")} {fKWD(stats.outstanding)}</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="chart-grid" style={{ marginBottom: "12px" }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "14px" }}>{tr("📈 اتجاه الإيرادات والمحصّل شهرياً")}</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={dark ? colTx : col} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={dark ? colTx : col} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ch.green} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={ch.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: ch.axis, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: ch.axis2 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [fKWD(v), n === "rev" ? tr("الإيرادات") : tr("المحصّل")]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl", background: "var(--ia-card)", border: "1px solid var(--ia-border)", color: "var(--ia-text)" }} />
              <Area type="monotone" dataKey="rev" name="rev" stroke={dark ? colTx : col} strokeWidth={2.5} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="paid" name="paid" stroke={ch.green} strokeWidth={2} strokeDasharray="5 3" fill="url(#paidGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "14px", marginTop: "4px", fontSize: "11px", color: "var(--ia-sub)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: dark ? colTx : col, display: "inline-block" }} /> {tr("الإيرادات")}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: ch.green, display: "inline-block" }} /> {tr("المحصّل فعلياً")}</span>
          </div>
        </div>
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ ...sectionTitle, marginBottom: "8px" }}>{tr("🍩 توزيع المبالغ حسب الحالة")}</div>
          {donutData.length ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [fKWD(v), tr("المبلغ")]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "auto" }}>
                {donutData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ color: "var(--ia-sub)", fontWeight: 700 }}>{d.name}</span>
                    <span style={{ color: "var(--ia-text)", fontWeight: 800, direction: "ltr" }}>{fKWD(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "40px 0" }}>{tr("لا توجد مبالغ")}</div>}
        </div>
      </div>

      {/* Receivables aging analysis (تقادم الذمم) */}
      <div style={{ ...card, marginBottom: "12px" }}>
        <div style={{ ...sectionTitle, marginBottom: "12px" }}>
          {tr("⏰ تقادم الذمم (Aging)")}
          {agingTotal > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--ia-red-tx)", background: "var(--ia-red-bg)", padding: "1px 10px", borderRadius: "20px" }}>
              {fKWD(agingTotal)} {tr("مستحقة")}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: "10.5px", color: "var(--ia-muted)", fontWeight: 600 }}>{tr("توزيع المتبقي حسب أيام التأخير")}</span>
        </div>
        {agingTotal > 0 ? (
          <>
            {/* stacked distribution bar */}
            <div style={{ display: "flex", height: "16px", borderRadius: "8px", overflow: "hidden", marginBottom: "12px", background: "var(--ia-chip)", direction: "rtl" }} role="img" aria-label={tr("توزيع {0} على فئات التقادم",[fKWD(agingTotal)])}>
              {aging.filter(b => b.amount > 0).map(b => (
                <div key={b.id} style={{ width: `${(b.amount / agingTotal * 100).toFixed(1)}%`, background: b.color, transition: "width .4s" }} title={tr("{0}: {1} — {2} فاتورة",[b.label,fKWD(b.amount),b.count])} />
              ))}
            </div>
            {/* bucket cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))", gap: "8px" }}>
              {aging.map(b => {
                const active = b.amount > 0;
                return (
                  <div key={b.id} style={{ background: active ? `${b.color}${dark ? "26" : "14"}` : "var(--ia-soft)", border: `1px solid ${active ? b.color + "55" : "var(--ia-border)"}`, borderRadius: "10px", padding: "10px 8px", textAlign: "center", transition: "all .15s" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--ia-sub)", marginBottom: "4px" }}>{b.label}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 900, color: active ? txAdapt(b.color, dark) : "var(--ia-muted)", direction: "ltr" }}>{fKWD(b.amount)}</div>
                    <div style={{ fontSize: "9.5px", color: "var(--ia-muted)", marginTop: "3px" }}>{active ? b.count + tr(" فاتورة") : b.sub}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "26px 0", fontSize: "13px" }}>
            <div style={{ fontSize: "26px", marginBottom: "6px" }}>🎉</div>
            {tr("لا توجد مستحقات غير مدفوعة في هذه الفترة — كل الفواتير محصّلة!")}
          </div>
        )}
      </div>

      {/* Collection activity (reminder audit log) */}
      {reminderStats && (
        <div style={{ ...card, marginBottom: "12px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", background: `linear-gradient(135deg,${softAdapt("#f0fdf4", dark)} 0%,${softAdapt("#dcfce7", dark)} 100%)`, border: "1.5px solid #16a34a33" }}>
          <div style={{ width: "44px", height: "44px", background: "#16a34a22", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>📣</div>
          <div style={{ minWidth: "160px", flex: 1 }}>
            <div style={{ fontSize: "13px", fontWeight: 900, color: "var(--ia-text)" }}>{tr("نشاط تذكيرات التحصيل")}</div>
            <div style={{ fontSize: "11.5px", color: "var(--ia-sub)", marginTop: "2px" }}>
              {reminderStats.count} {tr("تذكير مرسل")}{reminderStats.lastTxt ? tr(" — آخر تذكير {0}",[reminderStats.lastTxt]) : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--ia-ok-tx)", background: "var(--ia-ok-bg)", padding: "3px 12px", borderRadius: "20px" }}>{reminderStats.thisMonth} {tr("هذا الشهر")}</span>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--ia-warn-tx)", background: "var(--ia-warn-bg)", padding: "3px 12px", borderRadius: "20px", direction: "ltr" }}>~{fKWD(reminderStats.totalAmount)} {tr("مُطالَب بها")}</span>
          </div>
        </div>
      )}

      {/* Top customers + products */}
      <div className="chart-grid" style={{ marginBottom: "12px" }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "12px" }}>{tr("👑 أفضل ٥ عملاء")}</div>
          {stats.topCustomers.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stats.topCustomers.map((c, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: i === 0 ? `${col}` : "var(--ia-chip)", color: i === 0 ? "#fff" : "var(--ia-sub)", fontSize: "11px", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontWeight: 900, fontSize: "12px", color: dark ? colTx : col, direction: "ltr" }}>{fKWD(c.rev)}</span>
                  </div>
                  <div style={{ height: "7px", background: "var(--ia-chip)", borderRadius: "4px", overflow: "hidden", marginInlineStart: "30px" }}>
                    <div style={{ height: "100%", width: `${(c.rev / maxCustRev * 100).toFixed(1)}%`, background: `linear-gradient(90deg,${dark ? colTx : col},${dark ? colTx : col}bb)`, borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--ia-muted)", marginTop: "2px", marginInlineStart: "30px" }}>{c.cnt} {tr("فاتورة • محصّل")} {fKWD(c.paid)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "30px 0" }}>{tr("لا يوجد عملاء في الفترة")}</div>}
        </div>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "12px" }}>{tr("📦 المنتجات الأكثر مبيعاً")}</div>
          {stats.topProducts.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stats.topProducts.map((p, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px" }}>{["🥇", "🥈", "🥉", "🏅", "🏅", "🏅"][i]}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.name}</span>
                    <span style={{ fontWeight: 900, fontSize: "12px", color: "var(--ia-vio-tx)" }}>{p.qty} {tr("قطعة")}</span>
                  </div>
                  <div style={{ height: "7px", background: "var(--ia-chip)", borderRadius: "4px", overflow: "hidden", marginInlineStart: "30px" }}>
                    <div style={{ height: "100%", width: `${(p.qty / maxProdQty * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)", borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--ia-muted)", marginTop: "2px", marginInlineStart: "30px", direction: "ltr", textAlign: "start" }}>{tr("إيرادات: {0}",[fKWD(p.rev)])}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: "center", color: "var(--ia-muted)", padding: "30px 0" }}>{tr("لا توجد منتجات في الفترة")}</div>}
        </div>
      </div>

      {/* Monthly invoices count */}
      <div style={{ ...card, marginBottom: "12px" }}>
        <div style={{ ...sectionTitle, marginBottom: "14px" }}>{tr("🧾 عدد الفواتير الصادرة شهرياً")}</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={stats.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: ch.axis, fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: ch.axis2 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={v => [v + tr(" فاتورة"), tr("العدد")]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl", background: "var(--ia-card)", border: "1px solid var(--ia-border)", color: "var(--ia-text)" }} />
            <Bar dataKey="cnt" fill={dark ? colTx : col} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div style={{ ...card, background: `linear-gradient(135deg,${softAdapt("#fafafa", dark)} 0%,${softAdapt("#f5f5f5", dark)} 100%)` }}>
        <div style={{ ...sectionTitle, marginBottom: "12px" }}>{tr("💡 تحليلات تلقائية")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "var(--ia-card)", borderRadius: "9px", padding: "9px 12px", border: `1px solid ${ins.c}22` }}>
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{ins.icon}</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ia-text2)", lineHeight: 1.5 }}>{ins.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
