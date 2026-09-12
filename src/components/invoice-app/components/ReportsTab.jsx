"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Reports & Analytics Tab ──────────────────────────────────────
// Comprehensive analytics computed client-side from the company invoices
// (same data source as the Dashboard — works offline via localStorage cache).

const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const pN = s => parseFloat(toW(String(s || 0)).replace(/[^\d.]/g, "")) || 0;
const fKWD = n => pN(n).toFixed(3) + " KD";
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
  const col = company?.color || "#1e3a5f";

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
      const k = inv.clientPhone || inv.clientName || "عميل";
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
      const label = d.toLocaleDateString("ar", { month: "short" });
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
    { name: stLabel.paid, value: stats.byStatus.paid, color: stColor.paid },
    { name: stLabel.part, value: stats.byStatus.part, color: stColor.part },
    { name: stLabel.unp, value: stats.byStatus.unp, color: stColor.unp },
    { name: stLabel.cancel, value: stats.byStatus.cancel, color: stColor.cancel },
  ].filter(d => d.value > 0);

  const maxCustRev = stats.topCustomers[0]?.rev || 1;
  const maxProdQty = stats.topProducts[0]?.qty || 1;

  // ── auto insights ──
  const insights = (() => {
    const list = [];
    if (stats.collectionRate >= 80) list.push({ icon: "🟢", c: "#16a34a", t: `نسبة التحصيل ممتازة (${stats.collectionRate.toFixed(0)}%) — استمر في نفس النهج` });
    else if (stats.collectionRate >= 50) list.push({ icon: "🟡", c: "#d97706", t: `نسبة التحصيل ${stats.collectionRate.toFixed(0)}% — يمكن متابعة العملاء غير المدفوعين لرفعها` });
    else if (stats.totalRev > 0) list.push({ icon: "🔴", c: "#dc2626", t: `نسبة التحصيل منخفضة (${stats.collectionRate.toFixed(0)}%) — ${stats.outstanding.toFixed(1)} KD مستحقة عليك متابعتها` });
    if (stats.overdue.length > 0) list.push({ icon: "⏰", c: "#dc2626", t: `${stats.overdue.length} فاتورة متأخرة عن الاستحقاق بإجمالي ${fKWD(stats.overdueAmt)} — تواصل مع العملاء` });
    if (stats.bestMonth && stats.bestMonth.rev > 0) list.push({ icon: "🏆", c: col, t: `أفضل شهر في الفترة: ${stats.bestMonth.label} بإيرادات ${fKWD(stats.bestMonth.rev)}` });
    if (stats.topProducts[0]) list.push({ icon: "📦", c: "#7c3aed", t: `المنتج الأكثر مبيعاً: ${stats.topProducts[0].name} (${stats.topProducts[0].qty} قطعة)` });
    if (stats.topCustomers[0]) list.push({ icon: "👑", c: "#b45309", t: `أفضل عميل: ${stats.topCustomers[0].name} بإجمالي ${fKWD(stats.topCustomers[0].rev)}` });
    // revenue trend vs previous half
    if (stats.series.length >= 2) {
      const half = Math.floor(stats.series.length / 2);
      const recent = stats.series.slice(half).reduce((s, m) => s + m.rev, 0);
      const older = stats.series.slice(0, half).reduce((s, m) => s + m.rev, 0);
      if (older > 0) {
        const pct = ((recent - older) / older * 100);
        list.push({ icon: pct >= 0 ? "📈" : "📉", c: pct >= 0 ? "#16a34a" : "#dc2626", t: `النصف الأخير من الفترة ${pct >= 0 ? "أعلى" : "أقل"} بنسبة ${Math.abs(pct).toFixed(0)}% من النصف الأول` });
      }
    }
    if (!list.length) list.push({ icon: "📊", c: "#6b7280", t: "لا توجد بيانات كافية في هذه الفترة — جرّب توسيع النطاق الزمني" });
    return list.slice(0, 6);
  })();

  const card = { background: "#fff", borderRadius: "14px", padding: "18px 20px", border: "1.5px solid #e5e7eb" };
  const sectionTitle = { fontSize: "13px", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "6px" };

  if (!invoices.length) {
    return (
      <div className="card" style={{ padding: "56px", textAlign: "center", color: "#9ca3af" }}>
        <div style={{ fontSize: "44px", marginBottom: "10px" }}>📊</div>
        <div style={{ fontWeight: 700, color: "#6b7280" }}>لا توجد بيانات لعرض التقارير</div>
        <div style={{ fontSize: "12px", marginTop: "6px" }}>أنشئ فواتير أو استوردها من Aliphia لتظهر التحليلات</div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeUp .25s" }}>
      {/* Header + period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: col }}>📊 التقارير والتحليلات — {company?.nameAr}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "6px", background: "#fff", padding: "4px", borderRadius: "10px", border: "1.5px solid #e5e7eb" }}>
          {PERIODS.map(p => {
            const active = period === p.id;
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                border: "none", background: active ? col : "transparent", color: active ? "#fff" : "#6b7280",
                borderRadius: "7px", padding: "5px 12px", fontFamily: "inherit", fontSize: "12px",
                fontWeight: 700, cursor: "pointer", transition: "all .15s",
              }}>{p.label}</button>
            );
          })}
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid">
        <div style={{ background: "linear-gradient(135deg,#e8f0fe 0%,#dbeafe 100%)", borderRadius: "14px", padding: "14px 16px", border: `1.5px solid ${col}22` }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>💰</div>
          <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>إيرادات الفترة</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: col, direction: "ltr", textAlign: "right" }}>{fKWD(stats.totalRev)}</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "5px" }}>{stats.count} فاتورة • {stats.uniqueC} عميل</div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#dcfce7 0%,#d1fae5 100%)", borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #16a34a22" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>✅</div>
          <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>نسبة التحصيل</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: "#16a34a", direction: "ltr", textAlign: "right" }}>{stats.collectionRate.toFixed(1)}%</div>
          <div style={{ height: "6px", background: "#d1fae5", borderRadius: "4px", marginTop: "7px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, stats.collectionRate)}%`, background: "linear-gradient(90deg,#16a34a,#22c55e)", borderRadius: "4px", transition: "width .3s" }} />
          </div>
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "4px" }}>محصّل {fKWD(stats.totalPaid)} من {fKWD(stats.totalRev)}</div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)", borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #d9770622" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>🧾</div>
          <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>متوسط الفاتورة</div>
          <div style={{ fontSize: "17px", fontWeight: 900, color: "#b45309", direction: "ltr", textAlign: "right" }}>{fKWD(stats.avgInv)}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
            <span style={{ fontSize: "11px", color: "#6b7280" }}>{stats.activeCount} فاتورة فعّالة</span>
            {stats.overdue.length > 0 && <span style={{ fontSize: "10px", fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "1px 8px", borderRadius: "20px" }}>⏰ {stats.overdue.length} متأخرة</span>}
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)", borderRadius: "14px", padding: "14px 16px", border: "1.5px solid #7c3aed22" }}>
          <div style={{ fontSize: "22px", marginBottom: "6px" }}>🏆</div>
          <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: "3px" }}>أفضل شهر</div>
          <div style={{ fontSize: "15px", fontWeight: 900, color: "#7c3aed" }}>{stats.bestMonthLabel}</div>
          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "5px" }}>متبقٍ مستحق: {fKWD(stats.outstanding)}</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="chart-grid" style={{ marginBottom: "12px" }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "14px" }}>📈 اتجاه الإيرادات والمحصّل شهرياً</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={col} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="paidGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [fKWD(v), n === "rev" ? "الإيرادات" : "المحصّل"]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl" }} />
              <Area type="monotone" dataKey="rev" name="rev" stroke={col} strokeWidth={2.5} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="paid" name="paid" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 3" fill="url(#paidGrad)" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "14px", marginTop: "4px", fontSize: "11px", color: "#6b7280" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: col, display: "inline-block" }} /> الإيرادات</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#16a34a", display: "inline-block" }} /> المحصّل فعلياً</span>
          </div>
        </div>
        <div style={{ ...card, display: "flex", flexDirection: "column" }}>
          <div style={{ ...sectionTitle, marginBottom: "8px" }}>🍩 توزيع المبالغ حسب الحالة</div>
          {donutData.length ? (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [fKWD(v), "المبلغ"]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl" }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "auto" }}>
                {donutData.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ color: "#6b7280", fontWeight: 700 }}>{d.name}</span>
                    <span style={{ color: "#111827", fontWeight: 800, direction: "ltr" }}>{fKWD(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>لا توجد مبالغ</div>}
        </div>
      </div>

      {/* Top customers + products */}
      <div className="chart-grid" style={{ marginBottom: "12px" }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "12px" }}>👑 أفضل ٥ عملاء</div>
          {stats.topCustomers.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stats.topCustomers.map((c, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: i === 0 ? `${col}` : "#f3f4f6", color: i === 0 ? "#fff" : "#6b7280", fontSize: "11px", fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontWeight: 900, fontSize: "12px", color: col, direction: "ltr" }}>{fKWD(c.rev)}</span>
                  </div>
                  <div style={{ height: "7px", background: "#f3f4f6", borderRadius: "4px", overflow: "hidden", marginRight: "30px" }}>
                    <div style={{ height: "100%", width: `${(c.rev / maxCustRev * 100).toFixed(1)}%`, background: `linear-gradient(90deg,${col},${col}bb)`, borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px", marginRight: "30px" }}>{c.cnt} فاتورة • محصّل {fKWD(c.paid)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: "center", color: "#9ca3af", padding: "30px 0" }}>لا يوجد عملاء في الفترة</div>}
        </div>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: "12px" }}>📦 المنتجات الأكثر مبيعاً</div>
          {stats.topProducts.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stats.topProducts.map((p, i) => (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "14px" }}>{["🥇", "🥈", "🥉", "🏅", "🏅", "🏅"][i]}</span>
                    <span style={{ fontWeight: 700, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.name}</span>
                    <span style={{ fontWeight: 900, fontSize: "12px", color: "#7c3aed" }}>{p.qty} قطعة</span>
                  </div>
                  <div style={{ height: "7px", background: "#f3f4f6", borderRadius: "4px", overflow: "hidden", marginRight: "30px" }}>
                    <div style={{ height: "100%", width: `${(p.qty / maxProdQty * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)", borderRadius: "4px" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px", marginRight: "30px", direction: "ltr", textAlign: "right" }}>Revenue: {fKWD(p.rev)}</div>
                </div>
              ))}
            </div>
          ) : <div style={{ textAlign: "center", color: "#9ca3af", padding: "30px 0" }}>لا توجد منتجات في الفترة</div>}
        </div>
      </div>

      {/* Monthly invoices count */}
      <div style={{ ...card, marginBottom: "12px" }}>
        <div style={{ ...sectionTitle, marginBottom: "14px" }}>🧾 عدد الفواتير الصادرة شهرياً</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={stats.series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280", fontFamily: "Cairo" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={v => [v + " فاتورة", "العدد"]} contentStyle={{ fontFamily: "Cairo", fontSize: 12, borderRadius: 8, direction: "rtl" }} />
            <Bar dataKey="cnt" fill={col} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div style={{ ...card, background: "linear-gradient(135deg,#fafafa 0%,#f5f5f5 100%)" }}>
        <div style={{ ...sectionTitle, marginBottom: "12px" }}>💡 تحليلات تلقائية</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "#fff", borderRadius: "9px", padding: "9px 12px", border: `1px solid ${ins.c}22` }}>
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{ins.icon}</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151", lineHeight: 1.5 }}>{ins.t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
