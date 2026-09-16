"use client";
/**
 * chartlets — عناصر رسومية صغيرة للوحة GarfiX (r25).
 *
 * Sparkline: خط SVG مصغّر بتدرّج شفيف (يُعكس زمنياً في RTL — الزمن يتدفق من اليمين).
 * Donut: حلقة SVG بقطاعات دائرية مع تمركز إجمالي ونِسب.
 * StatusBadge: شارة حالة (لون + نقطة + نص — إتاحة بلا الون وحده).
 */
import { appDir, tr } from "@/lib/i18n-app";

/* ─── Sparkline ─── */
export function Sparkline({ data = [], color = "#2563EB", height = 34, ariaLabel }) {
  const W = 200;
  const H = height;
  const pts = appDir() === "rtl" ? [...data].reverse() : data;
  if (!pts.length) return <div style={{ height: H }} aria-hidden="true" />;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const step = pts.length > 1 ? W / (pts.length - 1) : W;
  const P = pts.map((v, i) => {
    const x = i * step;
    const y = H - 4 - ((v - min) / span) * (H - 8);
    return [x, y];
  });
  const line = P.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const gid = `gxsp${Math.round(max * 1000)}${pts.length}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none"
      role="img" aria-label={ariaLabel || tr("مخطط مصغّر")} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {pts.length > 1 && (
        <>
          <polygon points={`${P[0][0]},${H} ${line} ${P[P.length - 1][0]},${H}`} fill={`url(#${gid})`} />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"
            strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={P[P.length - 1][0]} cy={P[P.length - 1][1]} r="2.6" fill={color} />
        </>
      )}
      {pts.length === 1 && <circle cx={W / 2} cy={H / 2} r="3" fill={color} />}
    </svg>
  );
}

/* ─── Donut ─── */
export function Donut({ segments = [], size = 168, thickness = 22, centerValue, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  // قطاعات محسوبة مسبقاً (زاوية البداية لكل قطاع) — بلا إعادة إسناد داخل الرندر
  const arcs = segments.reduce((acc, s, i) => {
    const start = acc.offset;
    acc.offset += s.value;
    acc.list.push({ ...s, i, rot: (start / total) * 360 - 90 });
    return acc;
  }, { offset: 0, list: [] }).list;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={centerLabel ? `${centerLabel}: ${centerValue}` : tr("مخطط دائري")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ia-soft)" strokeWidth={thickness} />
        {arcs.map(a => (
          <circle key={a.i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color}
            strokeWidth={thickness} strokeDasharray={`${(a.value / total) * C} ${C - (a.value / total) * C}`}
            transform={`rotate(${a.rot} ${size / 2} ${size / 2})`}
            strokeLinecap="butt" style={{ transition: "stroke-dasharray .4s ease" }}>
            <title>{`${a.label}: ${a.pct}%`}</title>
          </circle>
        ))}
      </svg>
      {(centerValue != null) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div className="gx-num" style={{ fontSize: 16.5, fontWeight: 800, color: "var(--ia-text)", textAlign: "center", maxWidth: "72%" }}>{centerValue}</div>
          {centerLabel && <div style={{ fontSize: 9.5, color: "var(--ia-muted)", fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: ".5px", textAlign: "center" }}>{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

/* ─── شارة الحالة (نص + نقطة) ─── */
const ST_META = {
  paid: { label: () => tr("مدفوعة"), cls: "paid" },
  part: { label: () => tr("جزئي"), cls: "pending" },
  pending: { label: () => tr("قيد الانتظار"), cls: "pending" },
  overdue: { label: () => tr("متأخرة"), cls: "overdue" },
  draft: { label: () => tr("مسودة"), cls: "draft" },
  cancel: { label: () => tr("ملغاة"), cls: "cancel" },
};
export function StatusBadge({ st }) {
  const m = ST_META[st] || ST_META.pending;
  return <span className={`gx-st ${m.cls}`}>{m.label()}</span>;
}

/* ─── رأس بطاقة قياسي ─── */
export function CardHead({ icon, iconBg, iconColor, title, sub, right, style }) {
  return (
    <div className="gx-card-h" style={style}>
      {icon && (
        <span className="gx-ico" style={{ background: iconBg || "var(--ia-soft)", color: iconColor || "var(--ia-sub)" }}>
          {icon}
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="gx-card-t">{title}</div>
        {sub && <div className="gx-card-sub">{sub}</div>}
      </div>
      <span className="gx-sp" />
      {right}
    </div>
  );
}
