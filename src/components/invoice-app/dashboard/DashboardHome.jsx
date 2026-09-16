"use client";
/**
 * DashboardHome — لوحة تحكم GarfiX Business OS الرئيسية (r25).
 *
 * الترويسة: تحية زمنية بالاسم + التاريخ المُعرب + منتقي المدى
 * (اليوم/7/30/هذا الشهر/الشهر الماضي/مخصص). المؤشرات الأربعة بحساب
 * مقارنة بالفترة السابقة ومخططات مصغرة، نظرة الإيرادات، أحدث الفواتير،
 * الإجراءات السريعة، المستحقات، المبيعات حسب المنتج، كبار العملاء،
 * الحالة العالمية، مركز التنبيهات، ورؤى AI — مع هياكل تحميل وفراغ وخطأ.
 */
import { useMemo, useState } from "react";
import { FileText, CheckCircle2, Clock, AlertTriangle, CalendarRange, RefreshCcw, FilePlus2, Upload, SearchX } from "lucide-react";
import { dateLocale, tr } from "@/lib/i18n-app";
import { useCurrency } from "../currency";
import { useTheme } from "../theme";
import { DASH_CSS } from "./dash-css";
import KpiCards from "./KpiCards";
import RevenueOverview from "./RevenueOverview";
import RecentInvoices from "./RecentInvoices";
import QuickActions from "./QuickActions";
import OutstandingPayments from "./OutstandingPayments";
import { SalesByProduct, TopCustomers, GlobalStatus, AlertCenter, AiInsights } from "./Widgets";

/* ── أدوات الأرقام ── */
const toW = s => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const toN = s => { const v = parseFloat(String(s ?? 0).replace(/[^\d.-]/g, "")); return isFinite(v) ? v : 0; };
const iT = inv => (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0) + toN(inv.shipping || 0) + (() => {
  const rate = toN(inv.taxRate || 0); if (!(rate > 0)) return 0;
  const sub = (inv.items || []).reduce((s, it) => s + toN(it.qty) * toN(it.price), 0);
  return +(sub * rate / 100).toFixed(2);
})();
const paidOf = inv => Math.min(toN(inv.paid || 0), iT(inv));
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const overdueDays = inv => {
  if (inv.status === "cancelled") return 0;
  const tot = iT(inv), paid = toN(inv.paid || 0);
  if (paid >= tot) return 0;
  if (!inv.dueDate) return 0;
  const today = dayKey(new Date());
  if (inv.dueDate >= today) return 0;
  return Math.floor((new Date(today) - new Date(inv.dueDate)) / 86400000);
};
const stOf = inv => {
  if (inv.status === "cancelled") return "cancel";
  const tot = iT(inv), paid = toN(inv.paid || 0);
  if (paid >= tot) return "paid";
  if (paid > 0) return "part";
  return overdueDays(inv) > 0 ? "overdue" : "pending";
};

/* ── تعريفات المدى ── */
const RANGE_DEFS = [
  { id: "today", label: () => tr("اليوم") },
  { id: "7d", label: () => tr("7 أيام") },
  { id: "30d", label: () => tr("30 يوماً") },
  { id: "month", label: () => tr("هذا الشهر") },
  { id: "lastmonth", label: () => tr("الشهر الماضي") },
  { id: "custom", label: () => tr("مخصص") },
];
function rangeDates(id, custom) {
  const now = new Date();
  const t = dayKey(now);
  const mkFrom = days => { const d = new Date(now); d.setDate(d.getDate() - (days - 1)); return dayKey(d); };
  const ym = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  switch (id) {
    case "today": return { from: t, to: t };
    case "7d": return { from: mkFrom(7), to: t };
    case "30d": return { from: mkFrom(30), to: t };
    case "month": return { from: `${ym(now.getFullYear(), now.getMonth())}-01`, to: t };
    case "lastmonth": {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      return { from: `${ym(lm.getFullYear(), lm.getMonth())}-01`, to: `${ym(lm.getFullYear(), lm.getMonth())}-${lastDay}` };
    }
    case "custom": return { from: custom.from || t, to: custom.to || t };
    default: return { from: `${ym(now.getFullYear(), now.getMonth())}-01`, to: t };
  }
}
const prevDates = ({ from, to }) => {
  const f = new Date(from), t = new Date(to);
  const len = Math.max(1, Math.round((t - f) / 86400000) + 1);
  const pTo = new Date(f); pTo.setDate(pTo.getDate() - 1);
  const pFrom = new Date(pTo); pFrom.setDate(pFrom.getDate() - (len - 1));
  return { from: dayKey(pFrom), to: dayKey(pTo) };
};

/* ── التحية الزمنية ── */
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return tr("صباح الخير");
  if (h >= 12 && h < 17) return tr("طاب يومك");
  if (h >= 17 && h < 21) return tr("مساء الخير");
  return tr("ليلة سعيدة");
}

const pctDelta = (cur, prev) => {
  if (!prev && !cur) return 0;
  if (!prev) return cur > 0 ? 100 : 0;
  return (cur - prev) / prev * 100;
};

export default function DashboardHome({
  invoices = [], clients = [], company, companiesCount = 1, usersCount = 1,
  loading = false, error = null, onRetry,
  profileName = "", onNavigate, onAction,
  invCallbacks = {},  // onView/onEdit/onDuplicate/onPdf/onSend/onRecordPayment/onSendReminder/onBulkRemind/onOpenCustomer
  statusFilterSetter,
}) {
  const [rangeId, setRangeId] = useState("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const cur = useCurrency();
  const { dark } = useTheme();
  const fmt = v => cur.fmt(v);

  const R = rangeDates(rangeId, custom);
  const P = prevDates(R);
  const inRange = invoices.filter(inv => (inv.date || "") >= R.from && (inv.date || "") <= R.to);
  const inPrev = invoices.filter(inv => (inv.date || "") >= P.from && (inv.date || "") <= P.to);
  const companyId = company?.id || ""; // مُلتقط كثابت — تطابق استدلال تبعيات المذكّرة

  /* ── المؤشرات ── */
  const kpi = useMemo(() => {
    const paidSum = list => list.reduce((s, i) => s + paidOf(i), 0);
    const pendSum = list => list.filter(i => stOf(i) !== "paid" && stOf(i) !== "cancel")
      .reduce((s, i) => s + (iT(i) - paidOf(i)), 0);
    const overdueAll = invoices.filter(i => overdueDays(i) > 0);
    const overdueSum = overdueAll.reduce((s, i) => s + (iT(i) - paidOf(i)), 0);
    const overduePrev = invoices.filter(i => {
      if (i.status === "cancelled" || paidOf(i) >= iT(i) || !i.dueDate) return false;
      return i.dueDate >= P.from && i.dueDate <= P.to;
    }).reduce((s, i) => s + (iT(i) - paidOf(i)), 0);

    // سلاسل 14 يوماً للمخططات المصغرة
    const days14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return dayKey(d);
    });
    const sparkCount = days14.map(k => invoices.filter(i => (i.date || "") === k).length);
    const sparkPaid = days14.map(k => invoices.filter(i => (i.date || "") === k).reduce((s, i) => s + paidOf(i), 0));
    const sparkPend = days14.map(k => invoices.filter(i => (i.date || "") === k && stOf(i) !== "paid" && stOf(i) !== "cancel")
      .reduce((s, i) => s + (iT(i) - paidOf(i)), 0));
    const sparkOver = days14.map(k => invoices.filter(i => i.dueDate === k && overdueDays(i) > 0)
      .reduce((s, i) => s + (iT(i) - paidOf(i)), 0));

    return [
      {
        id: "count", icon: FileText, label: tr("إجمالي الفواتير"), num: inRange.length,
        delta: pctDelta(inRange.length, inPrev.length),
        sub: tr("{0} في الفترة السابقة", [inPrev.length]), money: false, fmt,
        spark: sparkCount, color: "#2563EB", bg: "rgba(37,99,235,.1)",
        tooltip: tr("عدد الفواتير الصادرة خلال المدى المحدد — انقر لعرض القائمة"),
        onClick: () => { statusFilterSetter?.("all"); onNavigate?.("list"); },
      },
      {
        id: "paid", icon: CheckCircle2, label: tr("المدفوع"), num: paidSum(inRange),
        delta: pctDelta(paidSum(inRange), paidSum(inPrev)),
        sub: tr("{0} فاتورة محصّلة", [inRange.filter(i => stOf(i) === "paid").length]), money: true, fmt,
        spark: sparkPaid, color: "#059669", bg: "rgba(16,185,129,.12)",
        tooltip: tr("المبالغ المحصّلة من فواتير الفترة — انقر لعرض المدفوعة"),
        onClick: () => { statusFilterSetter?.("paid"); onNavigate?.("list"); },
      },
      {
        id: "pending", icon: Clock, label: tr("قيد الانتظار"), num: pendSum(inRange),
        delta: pctDelta(pendSum(inRange), pendSum(inPrev)),
        sub: tr("{0} فاتورة غير مكتملة", [inRange.filter(i => ["part", "pending"].includes(stOf(i))).length]), money: true, fmt,
        spark: sparkPend, color: "#B45309", bg: "rgba(245,158,11,.13)",
        tooltip: tr("المتبقي من فواتير الفترة غير المسددة بالكامل"),
        onClick: () => onNavigate?.("payments"),
      },
      {
        id: "overdue", icon: AlertTriangle, label: tr("متأخر"), num: overdueSum,
        delta: pctDelta(overdueSum, overduePrev),
        sub: tr("{0} فاتورة تجاوزت الاستحقاق", [overdueAll.length]), money: true, fmt,
        spark: sparkOver, color: "#DC2626", bg: "rgba(239,68,68,.1)",
        tooltip: tr("إجمالي المتبقي من الفواتير المتأخرة عن تاريخ الاستحقاق"),
        onClick: () => onNavigate?.("reminders"),
      },
    ];
  }, [invoices, inRange, inPrev, R, P, fmt, onNavigate, statusFilterSetter]);

  /* ── أحدث الفواتير (مُعلّمة) ── */
  const recent = useMemo(() => [...invoices]
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.invNum || "").localeCompare(a.invNum || ""))
    .slice(0, 8)
    .map(inv => ({ ...inv, _st: stOf(inv), _total: iT(inv) })), [invoices]);

  /* ── المستحقات حسب العميل ── */
  const outstandingRows = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const st = stOf(inv);
      if (st === "paid" || st === "cancel") continue;
      const key = inv.clientPhone || inv.clientName || "?";
      const rem = iT(inv) - paidOf(inv);
      if (rem <= 0) continue;
      const days = overdueDays(inv);
      const row = map.get(key) || { key, name: inv.clientName || tr("عميل"), phone: inv.clientPhone, amount: 0, days: 0, invs: [] };
      row.amount += rem;
      row.days = Math.max(row.days, days);
      row.invs.push(inv);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  /* ── المبيعات حسب المنتج (فترة الرأس) ── */
  const productItems = useMemo(() => {
    const map = new Map();
    for (const inv of inRange) {
      for (const it of inv.items || []) {
        const name = (it.name || "").trim() || tr("منتج");
        const row = map.get(name) || { name, rev: 0, qty: 0 };
        row.rev += toN(it.qty) * toN(it.price);
        row.qty += parseInt(toW(String(it.qty || 1))) || 1;
        map.set(name, row);
      }
    }
    return [...map.values()].filter(x => x.rev > 0);
  }, [inRange]);

  /* ── كبار العملاء (كل الفواتير) ── */
  const topCustomers = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const st = stOf(inv);
      if (st === "cancel") continue;
      const key = inv.clientPhone || inv.clientName || "?";
      const row = map.get(key) || { key, name: inv.clientName || tr("عميل"), total: 0, count: 0, outstanding: 0 };
      row.total += iT(inv);
      row.count += 1;
      if (st !== "paid") row.outstanding += iT(inv) - paidOf(inv);
      map.set(key, row);
    }
    return [...map.values()];
  }, [invoices]);

  /* ── التنبيهات + رؤية AI ── */
  const { alerts, insight } = useMemo(() => {
    const list = [];
    const todayKey = dayKey(new Date());
    const overdueAll = invoices.filter(i => overdueDays(i) > 0);
    if (overdueAll.length) {
      list.push({ kind: "bad", id: "overdue",
        msg: tr("{0} فاتورة متأخرة عن الاستحقاق", [overdueAll.length]),
        go: () => onNavigate?.("reminders") });
    }
    const paidToday = invoices.filter(i => (i.date || "") === todayKey && stOf(i) === "paid").length;
    if (paidToday) list.push({ kind: "ok", id: "paidtoday", msg: tr("{0} فواتير حُصّلت اليوم", [paidToday]), go: () => onNavigate?.("payments") });

    const now = new Date();
    const mk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const tm = mk(now), pm = mk(new Date(now.getFullYear(), now.getMonth() - 1));
    const tmRev = invoices.filter(i => (i.date || "").startsWith(tm)).reduce((s, i) => s + iT(i), 0);
    const pmRev = invoices.filter(i => (i.date || "").startsWith(pm)).reduce((s, i) => s + iT(i), 0);
    const growth = pmRev > 0 ? Math.round((tmRev - pmRev) / pmRev * 100) : null;
    if (growth != null && growth !== 0) {
      list.push({ kind: growth > 0 ? "ok" : "warn", id: "growth",
        msg: growth > 0 ? tr("إيراد الشهر ارتفع {0}%", [growth]) : tr("إيراد الشهر انخفض {0}%", [Math.abs(growth)]),
        go: () => onNavigate?.("reports") });
    }

    // حد الائتمان (من خريطة الشركة المحلية tw_credit_{id})
    let creditOver = 0;
    try {
      const creditMap = JSON.parse(localStorage.getItem(`tw_credit_${companyId}`) || "{}");
      const outByPhone = new Map();
      for (const inv of invoices) {
        if (stOf(inv) === "paid" || stOf(inv) === "cancel") continue;
        const k = String(inv.clientPhone || "").replace(/[^\d]/g, "");
        outByPhone.set(k, (outByPhone.get(k) || 0) + (iT(inv) - paidOf(inv)));
      }
      for (const [ph, out] of outByPhone) {
        const lim = parseFloat(creditMap[ph] || 0);
        if (lim > 0 && out > lim) creditOver++;
      }
    } catch { /* خريطة غائبة */ }
    if (creditOver > 0) {
      list.push({ kind: "warn", id: "credit", msg: tr("{0} عملاء تجاوزوا حد الائتمان", [creditOver]), go: () => onNavigate?.("customers") });
    }

    // رؤية AI
    let ins = null;
    const topProduct = [...productItems].sort((a, b) => b.rev - a.rev)[0];
    const topRisk = outstandingRows[0];
    const overdueSum = overdueRows(outstandingRows);
    if (invoices.length) {
      ins = {
        what: growth != null && growth > 0
          ? tr("ارتفع الإيراد {0}% هذا الشهر ({1} مقابل {2}).", [growth, fmt(tmRev), fmt(pmRev)])
          : tr("الإيراد هذا الشهر {0} عبر {1} فاتورة.", [fmt(tmRev), invoices.filter(i => (i.date || "").startsWith(tm)).length]),
        why: topProduct
          ? tr("«{0}» يقود النمو بإيراد {1} — والمتأخرات {2} تضغط على التدفق النقدي.", [topProduct.name, fmt(topProduct.rev), fmt(overdueSum)])
          : tr("المتأخرات المتزايدة تضغط على التدفق النقدي."),
        action: topRisk
          ? tr("أرسل تذكير سداد اليوم لـ {0} عملاء متأخرين — أبرزهم {1} بمبلغ {2}.", [outstandingRows.filter(r => r.days > 0).length, topRisk.name, fmt(topRisk.amount)])
          : tr("لا إجراء عاجلاً — تابع التحصيل المنتظم."),
        impact: topRisk ? tr("استرداد يصل إلى {0} من المستحقات المتأخرة.", [fmt(overdueSum)]) : "",
      };
    }
    return { alerts: list, insight: ins };
  }, [invoices, productItems, outstandingRows, fmt, onNavigate, companyId]);

  const overdueSumRows = outstandingRows.filter(r => r.days > 0);
  const aiRecText = overdueSumRows.length ? tr("ارتفعت مستحقاتك المتأخرة إلى {0}. أنصح بإرسال تذكيرات سداد إلى {1} عملاء اليوم.", [fmt(overdueRows(outstandingRows)), overdueSumRows.length]) : null;

  /* ── الحالات ── */
  if (loading && invoices.length === 0) return <DashSkeleton />;
  if (error) {
    return (
      <>
        <style>{DASH_CSS}</style>
        <div className="gx-card">
          <div className="gx-err">
            <SearchX size={34} color="#DC2626" strokeWidth={1.6} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ia-text)" }}>{tr("تعذّر تحميل الفواتير")}</div>
            <div style={{ fontSize: 12.5, color: "var(--ia-muted)", fontWeight: 600 }}>{tr("بياناتك بأمان — حاول مرة أخرى.")}</div>
            <button className="gx-btn-primary" style={{ background: "#2563EB", marginTop: 6 }} onClick={onRetry}>
              <RefreshCcw size={14} /> {tr("حاول مجدداً")}
            </button>
          </div>
        </div>
      </>
    );
  }
  if (!loading && invoices.length === 0) {
    return (
      <>
        <style>{DASH_CSS}</style>
        <style>{`.gx-btn-primary{display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;padding:9px 18px;background:#2563EB;color:#fff;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:filter .15s}.gx-btn-primary:hover{filter:brightness(1.08)}
.gx-btn-ghost{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--ia-border2);border-radius:10px;padding:9px 18px;background:var(--ia-card);color:var(--ia-text2);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}.gx-btn-ghost:hover{border-color:var(--ia-muted)}`}</style>
        <div className="gx-card" style={{ marginTop: 14 }}>
          <div className="gx-empty" style={{ padding: "56px 20px" }}>
            <FileText size={40} color="var(--ia-muted)" strokeWidth={1.3} />
            <div className="gx-empty-t" style={{ fontSize: 16.5 }}>{tr("لا فواتير بعد")}</div>
            <div className="gx-empty-s">{tr("أنشئ فاتورتك الأولى وابدأ بتتبع أعمالك. أو استورد بياناتك القائمة من CSV / Excel بضغطة واحدة.")}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="gx-btn-primary" onClick={() => onAction?.("createInvoice")}>
                <FilePlus2 size={15} /> {tr("إنشاء فاتورة")}
              </button>
              <button className="gx-btn-ghost" onClick={() => onAction?.("importData")}>
                <Upload size={15} /> {tr("استيراد البيانات")}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <style>{DASH_CSS}</style>
      <style>{`.gx-btn-primary{display:inline-flex;align-items:center;gap:7px;border:none;border-radius:10px;padding:8px 15px;background:#2563EB;color:#fff;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:filter .15s,box-shadow .15s}.gx-btn-primary:hover{filter:brightness(1.08);box-shadow:0 5px 16px rgba(37,99,235,.35)}
.gx-btn-ai{display:inline-flex;align-items:center;gap:7px;border:1.5px solid rgba(124,58,237,.4);border-radius:10px;padding:8px 15px;background:rgba(124,58,237,.07);color:#7C3AED;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:background .15s}.gx-btn-ai:hover{background:rgba(124,58,237,.13)}`}</style>

      {/* ترويسة اللوحة */}
      <div className="gx-dash-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="gx-dash-hi">{greeting()}{profileName ? tr("، {0}", [profileName.split(/\s+/)[0]]) : ""} 👋</h1>
          <div className="gx-dash-hs">{tr("إليك ما يحدث في نشاطك التجاري اليوم.")}</div>
          <div className="gx-dash-date">
            <CalendarRange size={13} /> <span className="gx-num">{dateStr}</span>
          </div>
        </div>
        <div className="gx-ranges" role="tablist" aria-label={tr("المدى الزمني")}>
          {RANGE_DEFS.map(r => (
            <button key={r.id} className={`gx-range${rangeId === r.id ? " on" : ""}`} role="tab"
              aria-selected={rangeId === r.id} onClick={() => setRangeId(r.id)}>{r.label()}</button>
          ))}
          {rangeId === "custom" && (
            <div className="gx-custom">
              <input type="date" value={custom.from} aria-label={tr("من تاريخ")}
                onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
              <input type="date" value={custom.to} aria-label={tr("إلى تاريخ")}
                onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
            </div>
          )}
        </div>
      </div>

      {/* المؤشرات */}
      <div style={{ marginTop: 16 }}>
        <KpiCards kpis={kpi} />
      </div>

      {/* الإيرادات + أحدث الفواتير */}
      <div className="gx-grid-main">
        <RevenueOverview invoices={invoices} fmt={fmt}
          sparkColor={dark ? "#7cb0ff" : (company?.accent && company.accent !== "#64748b" ? company.accent : "#2563EB")} />
        <RecentInvoices
          invoices={recent} fmt={fmt} canEdit
          onView={invCallbacks.onView}
          onEdit={invCallbacks.onEdit}
          onDuplicate={invCallbacks.onDuplicate}
          onPdf={invCallbacks.onPdf}
          onSend={invCallbacks.onSend}
          onRecordPayment={invCallbacks.onRecordPayment}
          onViewAll={() => { statusFilterSetter?.("all"); onNavigate?.("list"); }}
        />
      </div>

      {/* إجراءات سريعة */}
      <QuickActions onAction={onAction} />

      {/* المستحقات + المبيعات + كبار العملاء */}
      <div className="gx-grid-23">
        <OutstandingPayments
          rows={outstandingRows.slice(0, 6)} allRows={outstandingRows} fmt={fmt}
          onSendReminder={invCallbacks.onSendReminder}
          onViewCustomer={invCallbacks.onOpenCustomer}
          onRecordPayment={invCallbacks.onRecordPayment}
          onBulkRemind={invCallbacks.onBulkRemind}
        />
        <SalesByProduct items={productItems} fmt={fmt} />
        <TopCustomers customers={topCustomers} fmt={fmt} onOpen={invCallbacks.onOpenCustomer} />
      </div>

      {/* التنبيهات + رؤى AI + الحالة العالمية */}
      <div className="gx-grid-3">
        <AlertCenter alerts={alerts} aiRec={aiRecText} onReviewWithAI={() => onAction?.("askAI")} />
        <AiInsights
          insight={insight}
          onApply={() => onNavigate?.("reminders")}
          onAskAI={() => onAction?.("askAI")}
        />
        <GlobalStatus companiesCount={companiesCount} usersCount={Math.max(usersCount, clients.length || 1)} />
      </div>
    </>
  );
}

/* مجموع المستحقات المتأخرة */
function overdueRows(rows) { return rows.filter(r => r.days > 0).reduce((s, r) => s + r.amount, 0); }

/* ── هيكل التحميل ── */
function DashSkeleton() {
  return (
    <>
      <style>{DASH_CSS}</style>
      <div aria-busy="true" aria-label={tr("جارٍ تحميل لوحة التحكم")}>
        <div className="gx-dash-head">
          <div style={{ flex: 1 }}>
            <div className="gx-sk" style={{ width: 220, height: 24, marginBottom: 8 }} />
            <div className="gx-sk gx-sk-sm" style={{ width: 280, height: 12 }} />
          </div>
          <div className="gx-sk" style={{ width: 260, height: 30, borderRadius: 9 }} />
        </div>
        <div className="gx-kpis" style={{ marginTop: 18 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="gx-card" style={{ padding: 16, borderRadius: 16 }}>
              <div style={{ display: "flex", gap: 9, marginBottom: 12 }}>
                <div className="gx-sk" style={{ width: 34, height: 34, borderRadius: 10 }} />
                <div className="gx-sk gx-sk-sm" style={{ width: "46%", marginTop: 4 }} />
              </div>
              <div className="gx-sk" style={{ width: "68%", height: 24, marginBottom: 9 }} />
              <div className="gx-sk gx-sk-sm" style={{ width: "40%" }} />
              <div className="gx-sk" style={{ width: "100%", height: 34, marginTop: 12 }} />
            </div>
          ))}
        </div>
        <div className="gx-grid-main">
          <div className="gx-card" style={{ minHeight: 280 }}><div className="gx-card-b"><div className="gx-sk" style={{ width: "36%", height: 15, marginBottom: 14 }} /><div className="gx-sk" style={{ width: "100%", height: 200 }} /></div></div>
          <div className="gx-card" style={{ minHeight: 280 }}><div className="gx-card-b"><div className="gx-sk" style={{ width: "45%", height: 15, marginBottom: 14 }} />{[0, 1, 2, 3, 4].map(i => <div key={i} className="gx-sk" style={{ width: "100%", height: 30, marginBottom: 9 }} />)}</div></div>
        </div>
        <div className="gx-grid-23" style={{ minHeight: 200 }}>
          {[0, 1, 2].map(i => <div key={i} className="gx-card" style={{ minHeight: 200 }}><div className="gx-card-b"><div className="gx-sk" style={{ width: "40%", height: 15, marginBottom: 12 }} /><div className="gx-sk" style={{ width: "100%", height: 150 }} /></div></div>)}
        </div>
      </div>
    </>
  );
}
