"use client";
/**
 * QuickActions — شبكة الإجراءات السريعة الستة (r25).
 *
 * إنشاء فاتورة (أساسي) · إضافة عميل · تسجيل دفعة · استيراد بيانات ·
 * عرض التقارير · اسأل GarfiX AI (لمسة ذهبية فاخرة). كل بطاقة تفتح
 * مسار العمل المناسب فوراً.
 */
import { FilePlus2, UserPlus, Wallet, Upload, BarChart3, Sparkles } from "lucide-react";
import { tr } from "@/lib/i18n-app";

export default function QuickActions({ onAction }) {
  const actions = [
    { key: "createInvoice", icon: FilePlus2, t: () => tr("إنشاء فاتورة"), s: () => tr("فاتورة جديدة في خطوات"), cls: "gx-primary", bg: "rgba(37,99,235,.12)", color: "#2563EB" },
    { key: "addCustomer", icon: UserPlus, t: () => tr("إضافة عميل"), s: () => tr("أضفه لدليل العملاء"), bg: "rgba(124,58,237,.1)", color: "#7C3AED" },
    { key: "recordPayment", icon: Wallet, t: () => tr("تسجيل دفعة"), s: () => tr("حصّل وحدّث الفواتير"), bg: "rgba(16,185,129,.12)", color: "#059669" },
    { key: "importData", icon: Upload, t: () => tr("استيراد البيانات"), s: () => tr("CSV / Excel ذكي"), bg: "rgba(13,148,136,.1)", color: "#0D9488" },
    { key: "viewReports", icon: BarChart3, t: () => tr("عرض التقارير"), s: () => tr("تحليلات شاملة"), bg: "rgba(37,99,235,.1)", color: "#1D4ED8" },
    { key: "askAI", icon: Sparkles, t: () => tr("اسأل GarfiX AI"), s: () => tr("ذكاء متصل ببياناتك"), cls: "gx-ai", bg: "rgba(212,175,55,.15)", color: "#B8860B" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "18px 2px 0", flexWrap: "wrap" }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--ia-text)" }}>{tr("إجراءات سريعة")}</div>
        <div style={{ fontSize: 11.5, color: "var(--ia-muted)", fontWeight: 600 }}>{tr("أنجز أكثر وأسرع مع GarfiX")}</div>
      </div>
      <div className="gx-qas">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <button key={a.key} className={`gx-qa${a.cls ? " " + a.cls : ""}`} onClick={() => onAction(a.key)} type="button">
              <span className="gx-qa-ico" style={{ background: a.bg, color: a.color }}><Icon size={18} /></span>
              <span className="gx-qa-t">{a.t()}</span>
              <span className="gx-qa-s">{a.s()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
