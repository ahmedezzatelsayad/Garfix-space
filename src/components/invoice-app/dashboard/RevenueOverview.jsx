"use client";
/**
 * RevenueOverview — بطاقة نظرة الإيرادات الكبرى (r25).
 *
 * مخطط مساحي (recharts) بتحكم 7 أيام/30 يوماً/3 أشهر/12 شهراً + تجميع
 * يومي/أسبوعي/شهري، وملخص جانبي (إجمالي الإيراد/عدد الفواتير/متوسط الفاتورة).
 * RTL: يُعكس ترتيب البيانات فيمشي الزمن من اليمين إلى اليسار، والتلميحات
 * والتسميات تُترجم وتُنسّق بعملة الجلسة وأرقام جدولية.
 */
import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { appDir, dateLocale, tr } from "@/lib/i18n-app";
import { useTheme, chartColors } from "../theme";
import { CardHead } from "./chartlets";

const toN = s => { const v = parseFloat(String(s ?? 0).replace(/[^\d.-]/g, "")); return isFinite(v) ? v : 0; };
const invTotal = inv => (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0) + toN(inv.shipping || 0) + (() => {
  const rate = toN(inv.taxRate || 0);
  if (!(rate > 0)) return 0;
  const sub = (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0);
  return +(sub * rate / 100).toFixed(2);
})();

const RANGES = [
  { id: "7d", days: 7, label: () => tr("7 أيام"), gran: "day" },
  { id: "30d", days: 30, label: () => tr("30 يوماً"), gran: "day" },
  { id: "3m", days: 91, label: () => tr("3 أشهر"), gran: "week" },
  { id: "12m", days: 365, label: () => tr("12 شهراً"), gran: "month" },
];
const GRANS = [
  { id: "day", label: () => tr("يومي") },
  { id: "week", label: () => tr("أسبوعي") },
  { id: "month", label: () => tr("شهري") },
];

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* تلميح الرسم — معرّف خارج الرندر (يعمل مع React Compiler) ويستقبل fmt كخاصية */
function RevTip({ active, payload, fmt }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div style={{ background: "var(--ia-card)", border: "1px solid var(--ia-border2)", borderRadius: 12,
      padding: "9px 13px", boxShadow: "0 10px 30px rgba(15,23,42,.15)", direction: appDir(), fontSize: 12 }}>
      <div style={{ fontWeight: 800, color: "var(--ia-text)", marginBottom: 5 }}>{r.label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ color: "var(--ia-sub)", fontWeight: 600 }}>{tr("الإيراد")}</span>
          <b className="gx-num" style={{ color: "var(--ia-text)" }}>{fmt(r.rev)}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ color: "var(--ia-sub)", fontWeight: 600 }}>{tr("فواتير")}</span>
          <b className="gx-num" style={{ color: "var(--ia-text)" }}>{r.cnt}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
          <span style={{ color: "var(--ia-sub)", fontWeight: 600 }}>{tr("متوسط الفاتورة")}</span>
          <b className="gx-num" style={{ color: "var(--ia-text)" }}>{fmt(r.avg)}</b>
        </div>
      </div>
    </div>
  );
}

export default function RevenueOverview({ invoices = [], fmt, sparkColor = "#2563EB" }) {
  const [rangeId, setRangeId] = useState("30d");
  const [granOverride, setGran] = useState(null);
  const { dark } = useTheme();
  const ch = chartColors(dark);
  const rtl = appDir() === "rtl";
  const range = RANGES.find(r => r.id === rangeId) || RANGES[1];
  const gran = granOverride || range.gran;

  const series = useMemo(() => {
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - (range.days - 1));
    const fromKey = dayKey(from);
    const inRange = invoices.filter(inv => (inv.date || "") >= fromKey);

    const buckets = [];
    if (gran === "month") {
      const n = range.days > 200 ? 12 : 3;
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString(dateLocale(), { month: "short", year: "2-digit" }) });
      }
    } else if (gran === "week") {
      const n = Math.ceil(range.days / 7);
      for (let i = n - 1; i >= 0; i--) {
        const end = new Date(now); end.setDate(end.getDate() - i * 7);
        const start = new Date(end); start.setDate(start.getDate() - 6);
        buckets.push({ key: `w${dayKey(start)}`, from: dayKey(start), to: dayKey(end),
          label: start.toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) });
      }
    } else {
      for (let i = range.days - 1; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const k = dayKey(d);
        buckets.push({ key: k, label: d.toLocaleDateString(dateLocale(),
          range.days <= 7 ? { weekday: "short" } : { day: "numeric", month: "short" }) });
      }
    }

    const rows = buckets.map(b => ({ label: b.label, rev: 0, cnt: 0, _k: b.key, _from: b.from, _to: b.to }));
    const idx = new Map(rows.map((r, i) => [r._k, i]));
    for (const inv of inRange) {
      const d = inv.date || "";
      let key = d;
      if (gran === "week") { const row = rows.find(r => d >= r._from && d <= r._to); key = row ? row._k : null; }
      if (gran === "month") key = d.slice(0, 7);
      if (key == null) continue;
      const i = idx.get(key);
      if (i == null) continue;
      rows[i].rev += invTotal(inv);
      rows[i].cnt += 1;
    }
    for (const r of rows) r.avg = r.cnt ? r.rev / r.cnt : 0;
    return rows.map(({ label, rev, cnt, avg }) => ({ label, rev, cnt, avg }));
  }, [invoices, range.days, gran]);

  const data = rtl ? [...series].reverse() : series;
  const totalRev = series.reduce((s, r) => s + r.rev, 0);
  const totalCnt = series.reduce((s, r) => s + r.cnt, 0);
  const avgInv = totalCnt ? totalRev / totalCnt : 0;

  const compact = v => v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));

  return (
    <div className="gx-card">
      <CardHead
        icon={<TrendingUp size={15} />}
        iconBg="rgba(37,99,235,.1)" iconColor="#2563EB"
        title={tr("نظرة عامة على الإيرادات")}
        right={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <div className="gx-chips" role="tablist" aria-label={tr("مدى الرسم")}>
              {RANGES.map(r => (
                <button key={r.id} className={`gx-chip${rangeId === r.id ? " on" : ""}`}
                  role="tab" aria-selected={rangeId === r.id}
                  onClick={() => { setRangeId(r.id); setGran(null); }}>{r.label()}</button>
              ))}
            </div>
            <div className="gx-chips" role="tablist" aria-label={tr("التجميع")}>
              {GRANS.map(g => (
                <button key={g.id} className={`gx-chip${gran === g.id ? " on" : ""}`}
                  role="tab" aria-selected={gran === g.id}
                  onClick={() => setGran(g.id)}>{g.label()}</button>
              ))}
            </div>
          </div>
        }
      />
      <div className="gx-card-b gx-rev-grid">
        <div style={{ minHeight: 225 }}>
          <ResponsiveContainer width="100%" height={225}>
            <AreaChart data={data} margin={{ top: 8, right: rtl ? 4 : 10, bottom: 0, left: rtl ? 10 : 4 }}>
              <defs>
                <linearGradient id="gxrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={ch.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: ch.axis, fontFamily: "Inter,Cairo" }}
                axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 10, fill: ch.axis2 }} axisLine={false} tickLine={false} width={42}
                orientation={rtl ? "right" : "left"}
                tickFormatter={compact} />
              <Tooltip content={<RevTip fmt={fmt} />} cursor={{ stroke: ch.axis2, strokeDasharray: "3 3" }} />
              <Area type="monotone" dataKey="rev" stroke={sparkColor} strokeWidth={2.4}
                fill="url(#gxrev)" activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--ia-card)" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="gx-sum gx-rev-sum">
          <div className="gx-sum-row">
            <span className="gx-sum-l">{tr("إجمالي الإيراد")}</span>
            <span className="gx-sum-v gx-num">{fmt(totalRev)}</span>
          </div>
          <div className="gx-sum-row">
            <span className="gx-sum-l">{tr("عدد الفواتير")}</span>
            <span className="gx-sum-v gx-num">{totalCnt.toLocaleString("en-US")}</span>
          </div>
          <div className="gx-sum-row">
            <span className="gx-sum-l">{tr("متوسط الفاتورة")}</span>
            <span className="gx-sum-v gx-num">{fmt(avgInv)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
