"use client";
/**
 * KpiCards — بطاقات المؤشرات الأربعة للوحة GarfiX (r25).
 *
 * كل بطاقة: أيقونة + تسمية + رقم رئيسي (جدولي، عدّ تصاعدي) + مقارنة بالفترة
 * السابقة (سهم أعلى/أسفل) + مخطط مصغّر + نقرة تفتح الفواتير المفلترة.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { Sparkline } from "./chartlets";

/* عدّ تصاعدي سلس (easeOutCubic) */
function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = typeof target === "number" && isFinite(target) ? target : 0;
    const start = performance.now();
    let raf = 0;
    const tick = now => {
      const p = from === to ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function DeltaChip({ pct }) {
  if (pct == null || !isFinite(pct)) return null;
  const up = pct > 0.05, down = pct < -0.05;
  const cls = up ? "up" : down ? "down" : "flat";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={`gx-delta ${cls}`} title={tr("مقارنة بالفترة السابقة")}>
      <Icon size={11} strokeWidth={2.6} />
      <span className="gx-num">{Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%</span>
    </span>
  );
}

export function KpiCard({ k }) {
  const v = useCountUp(k.num ?? 0);
  const display = k.money
    ? k.fmt(v)
    : k.suffix
      ? `${Math.round(v).toLocaleString("en-US")}${k.suffix}`
      : Math.round(v).toLocaleString("en-US");
  return (
    <button className="gx-kpi" onClick={k.onClick} title={k.tooltip || k.label} type="button"
      aria-label={`${k.label}: ${k.tooltip || ""}`}>
      <div className="gx-kpi-top">
        <span className="gx-kpi-ico" style={{ background: k.bg, color: k.color }}>
          <k.icon size={17} strokeWidth={2.1} />
        </span>
        <span className="gx-kpi-label">{k.label}</span>
      </div>
      <div className="gx-kpi-val gx-num" style={k.color ? { color: k.color } : undefined}>{display}</div>
      <div className="gx-kpi-foot">
        <DeltaChip pct={k.delta} />
        <span className="gx-kpi-sub">{k.sub}</span>
      </div>
      <div className="gx-kpi-spark">
        <Sparkline data={k.spark || []} color={k.color || "#2563EB"} height={34}
          ariaLabel={tr("اتجاه {0}", [k.label])} />
      </div>
    </button>
  );
}

export default function KpiCards({ kpis = [] }) {
  return (
    <div className="gx-kpis" role="list" aria-label={tr("مؤشرات الأداء")}>
      {kpis.map(k => <KpiCard key={k.id} k={k} />)}
    </div>
  );
}
