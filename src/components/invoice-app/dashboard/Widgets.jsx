"use client";
/**
 * Widgets — بطاقات لوحة GarfiX الثانوية (r25).
 *
 * SalesByProduct: مخطط دائري (إيراد/كمية) بأعلى المنتجات + «أخرى».
 * TopCustomers: كبار العملاء (صورة-حرفية + الإنفاق + عدد الفواتير + فرز).
 * GlobalStatus: بصمة العمارة العالمية (دول العالم · لغات المنصة · أي عملة · الشركات).
 * AlertCenter: تنبيهات الأعمال الحية + توصية AI بزر «راجع مع AI».
 * AiInsights: ماذا حدث / لماذا يهم / الإجراء الموصى / الأثر المتوقع.
 */
import { useState } from "react";
import {
  PieChart, Users, Globe2, Languages, Coins, Building2, ShieldCheck, Sparkles,
  AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Zap,
} from "lucide-react";
import { appDir, tr } from "@/lib/i18n-app";
import { LANGUAGES } from "@/lib/i18n";
import { WORLD_COUNTRIES } from "@/lib/countries-world";
import { Donut, CardHead } from "./chartlets";

/* ── ألوان القطاعات ── */
const SEG_COLORS = ["#2563EB", "#D4AF37", "#10B981", "#7C3AED", "#94A3B8"];

/* ═══ المبيعات حسب المنتج ═══ */
export function SalesByProduct({ items = [], fmt, totalLabel }) {
  const [mode, setMode] = useState("rev"); // rev | qty
  const val = it => (mode === "rev" ? it.rev : it.qty);
  const sorted = [...items].sort((a, b) => val(b) - val(a));
  const top3 = sorted.slice(0, 3);
  const othersVal = sorted.slice(3).reduce((s, x) => s + val(x), 0);
  const total = sorted.reduce((s, x) => s + val(x), 0) || 1;
  const segs = top3.map((it, i) => ({
    label: it.name, value: val(it), color: SEG_COLORS[i], pct: Math.round(val(it) / total * 100),
  }));
  if (othersVal > 0 && sorted.length > 3) {
    segs.push({ label: tr("أخرى"), value: othersVal, color: SEG_COLORS[4], pct: Math.round(othersVal / total * 100) });
  }
  return (
    <div className="gx-card">
      <CardHead
        icon={<PieChart size={15} />} iconBg="rgba(124,58,237,.1)" iconColor="#7C3AED"
        title={tr("المبيعات حسب المنتج")}
        right={
          <div className="gx-chips">
            <button className={`gx-chip${mode === "rev" ? " on" : ""}`} onClick={() => setMode("rev")}>{tr("الإيراد")}</button>
            <button className={`gx-chip${mode === "qty" ? " on" : ""}`} onClick={() => setMode("qty")}>{tr("الكمية")}</button>
          </div>
        }
      />
      <div className="gx-card-b">
        {items.length === 0 ? (
          <div className="gx-empty" style={{ padding: "22px 8px" }}>
            <div className="gx-empty-t">{tr("لا مبيعات بعد")}</div>
            <div className="gx-empty-s">{tr("ستظهر توزيعة المنتجات هنا مع أول فاتورة.")}</div>
          </div>
        ) : (
          <>
            <Donut segments={segs} size={172} thickness={23}
              centerValue={mode === "rev" ? fmt(total) : String(total)}
              centerLabel={mode === "rev" ? (totalLabel || tr("إجمالي المبيعات")) : tr("وحدة مباعة")} />
            <div className="gx-legend">
              {segs.map((s, i) => (
                <div key={i} className="gx-legend-row">
                  <span className="gx-legend-dot" style={{ background: s.color }} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  <span className="gx-legend-v gx-num">{mode === "rev" ? fmt(s.value) : s.value}</span>
                  <span className="gx-legend-p gx-num">{s.pct}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══ كبار العملاء ═══ */
const AV_COLORS = ["#2563EB", "#7C3AED", "#059669", "#B45309", "#0D9488", "#B91C1C"];
export function TopCustomers({ customers = [], fmt, onOpen }) {
  const [sort, setSort] = useState("rev"); // rev | cnt | out
  const sorted = [...customers].sort((a, b) =>
    sort === "rev" ? b.total - a.total : sort === "cnt" ? b.count - a.count : (b.outstanding || 0) - (a.outstanding || 0));
  const rows = sorted.slice(0, 6);
  return (
    <div className="gx-card">
      <CardHead
        icon={<Users size={15} />} iconBg="rgba(16,185,129,.12)" iconColor="#059669"
        title={tr("كبار العملاء")}
        right={
          <div className="gx-chips">
            <button className={`gx-chip${sort === "rev" ? " on" : ""}`} onClick={() => setSort("rev")}>{tr("الإيراد")}</button>
            <button className={`gx-chip${sort === "cnt" ? " on" : ""}`} onClick={() => setSort("cnt")}>{tr("الفواتير")}</button>
            <button className={`gx-chip${sort === "out" ? " on" : ""}`} onClick={() => setSort("out")}>{tr("المستحق")}</button>
          </div>
        }
      />
      <div className="gx-card-b" style={{ paddingTop: 6 }}>
        {rows.length === 0 ? (
          <div className="gx-empty" style={{ padding: "22px 8px" }}>
            <div className="gx-empty-t">{tr("لا عملاء بعد")}</div>
            <div className="gx-empty-s">{tr("أضف عملاءك وابدأ رحلة البيع.")}</div>
          </div>
        ) : rows.map((c, i) => (
          <button key={c.key} className="gx-cust" style={{ border: "none", background: "transparent", cursor: "pointer",
            width: "100%", textAlign: "start", fontFamily: "inherit", padding: "9px 2px" }}
            onClick={() => onOpen?.(c)}>
            <span className="gx-cust-av" style={{ background: AV_COLORS[i % AV_COLORS.length] }}>
              {(c.name || "?").trim().charAt(0)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="gx-cust-n" style={{ display: "block" }}>{c.name || tr("عميل")}</span>
              <span className="gx-cust-s" style={{ display: "block" }}>
                <span className="gx-num">{c.count}</span> {tr("فاتورة")}
                {(c.outstanding || 0) > 0 && <> · <span className="gx-num" style={{ color: "#B91C1C", fontWeight: 700 }}>{fmt(c.outstanding)}</span> {tr("مستحق")}</>}
              </span>
            </span>
            <span className="gx-num" style={{ fontWeight: 800, fontSize: 13.5, color: "var(--ia-text)", whiteSpace: "nowrap" }}>
              {fmt(c.total)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══ الحالة العالمية للأعمال ═══ */
export function GlobalStatus({ companiesCount = 1, usersCount = 1 }) {
  // r29 (M6): الأعداد تُشتق من البيانات نفسها — كانت «195/28» صلبة ولا تطابق 196/27
  const stats = [
    { v: String(WORLD_COUNTRIES.length), l: () => tr("دولة"), icon: Globe2 },
    { v: String(LANGUAGES.length), l: () => tr("لغة"), icon: Languages },
    { v: tr("أي"), l: () => tr("عملة"), icon: Coins },
    { v: String(companiesCount), l: () => tr("شركة"), icon: Building2 },
    { v: String(usersCount), l: () => tr("مستخدم"), icon: ShieldCheck },
  ];
  return (
    <div className="gx-card">
      <CardHead
        icon={<Globe2 size={15} />} iconBg="rgba(212,175,55,.14)" iconColor="#B8860B"
        title={tr("حالة الأعمال العالمية")}
        sub={tr("بنية GarfiX العالمية — جاهزة لأي سوق")} />
      <div className="gx-card-b">
        <div className="gx-world">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="gx-world-i">
                <Icon size={15} color="var(--ia-muted)" style={{ margin: "0 auto 3px" }} />
                <div className="gx-world-v gx-num">{s.v}</div>
                <div className="gx-world-l">{s.l()}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ مركز التنبيهات ═══ */
export function AlertCenter({ alerts = [], aiRec, onReviewWithAI }) {
  const BackIcon = appDir() === "rtl" ? ArrowLeft : ArrowRight;
  return (
    <div className="gx-card">
      <CardHead
        icon={<AlertTriangle size={15} />} iconBg="rgba(245,158,11,.13)" iconColor="#B45309"
        title={tr("مركز التنبيهات")}
        sub={alerts.length ? tr("{0} تنبيهات تحتاج انتباهك", [alerts.length]) : tr("كل شيء تحت السيطرة")} />
      <div className="gx-card-b" style={{ paddingTop: 8 }}>
        {alerts.length === 0 && (
          <div className="gx-alert ok">
            <CheckCircle2 size={16} color="#059669" className="gx-alert-ico" />
            <span>{tr("لا تنبيهات — أعمالك تسير بسلاسة")}</span>
          </div>
        )}
        {alerts.map((a, i) => (
          <div key={i} className={`gx-alert ${a.kind === "ok" ? "ok" : a.kind === "bad" ? "bad" : "warn"}`}>
            {a.kind === "ok"
              ? <CheckCircle2 size={16} color="#059669" className="gx-alert-ico" />
              : <AlertTriangle size={16} color={a.kind === "bad" ? "#DC2626" : "#D97706"} className="gx-alert-ico" />}
            <span style={{ flex: 1 }}>{a.msg}</span>
            {a.go && (
              <button className="gx-link" style={{ flexShrink: 0 }} onClick={a.go}>{tr("عرض")} <BackIcon size={12} /></button>
            )}
          </div>
        ))}
        {aiRec && (
          <div className="gx-ai-rec">
            <div className="gx-ai-rec-t">
              <Sparkles size={14} color="#B8860B" /> {tr("توصية GarfiX AI")}
            </div>
            <div className="gx-ai-rec-b">{aiRec}</div>
            <button className="gx-link" style={{ marginTop: 8, fontWeight: 800, background: "rgba(212,175,55,.12)", color: "#8a6a0e" }}
              onClick={onReviewWithAI}>
              {tr("راجع مع AI")} <BackIcon size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ رؤى الذكاء الاصطناعي للأعمال ═══ */
export function AiInsights({ insight, onApply, onAskAI }) {
  if (!insight) return null;
  const BackIcon = appDir() === "rtl" ? ArrowLeft : ArrowRight;
  const rows = [
    { k: tr("ماذا حدث"), v: insight.what },
    { k: tr("لماذا يهم"), v: insight.why },
    { k: tr("الإجراء الموصى"), v: insight.action },
    { k: tr("الأثر المتوقع"), v: insight.impact },
  ];
  return (
    <div className="gx-card" style={{ border: "1px solid rgba(212,175,55,.3)" }}>
      <CardHead
        icon={<Sparkles size={15} />} iconBg="rgba(212,175,55,.15)" iconColor="#B8860B"
        title={tr("رؤى الذكاء الاصطناعي للأعمال")}
        sub={tr("تحليل لحظي لبياناتك")}
        right={<span className="gx-ai-badge" style={{ background: "rgba(212,175,55,.15)", color: "#B8860B", border: "1px solid rgba(212,175,55,.35)", fontSize: 9, fontWeight: 800, borderRadius: 6, padding: "2px 7px", letterSpacing: 1, textTransform: "uppercase" }}>AI</span>} />
      <div className="gx-card-b" style={{ paddingTop: 4 }}>
        {rows.map((r, i) => (
          <div key={i} className="gx-ins-row">
            <span className="gx-ins-k">{r.k}</span>
            <span className="gx-ins-v">{r.v}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="gx-btn-primary" onClick={onApply}>
            <Zap size={13} /> {tr("تنفيذ التوصية")}
          </button>
          <button className="gx-btn-ai" onClick={onAskAI}>
            <Sparkles size={13} /> {tr("اسأل AI")}
          </button>
        </div>
      </div>
      <style>{`
.gx-btn-primary{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:10px;
  padding:8px 15px;background:#2563EB;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;
  cursor:pointer;transition:filter .15s,box-shadow .15s}
.gx-btn-primary:hover{filter:brightness(1.08);box-shadow:0 5px 16px rgba(37,99,235,.35)}
.gx-btn-ai{display:inline-flex;align-items:center;gap:6px;border:1.5px solid rgba(124,58,237,.4);
  border-radius:10px;padding:8px 15px;background:rgba(124,58,237,.07);color:#7C3AED;font-family:inherit;
  font-size:12.5px;font-weight:800;cursor:pointer;transition:background .15s}
.gx-btn-ai:hover{background:rgba(124,58,237,.13)}
`}</style>
    </div>
  );
}
