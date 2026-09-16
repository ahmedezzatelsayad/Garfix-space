"use client";

/**
 * r24: FeatureModuleCard — كارت وحدة منتج بهوية عالمية (أيقونة lucide بدل الإيموجي).
 * تُصدر MODULES: وحدات GarfiX الست (كلها قدرات قائمة فعلاً في المنتج).
 */
import { BarChart3, Building2, Bot, FileText, Users, Wallet } from "lucide-react";
import { tr } from "@/lib/i18n-app";

export const MODULES = [
  {
    key: "invoices",
    icon: FileText,
    title: "الفواتير",
    desc: "إنشاء وتعديل، PDF عربي كامل، حالات دفع، واستيراد Excel/CSV.",
  },
  {
    key: "payments",
    icon: Wallet,
    title: "المدفوعات والتحصيل",
    desc: "دفعات جزئية، روابط دفع، وتذكيرات واتساب للحوال المتأخرة.",
  },
  {
    key: "customers",
    icon: Users,
    title: "العملاء 360°",
    desc: "سجل موحّد للعميل، حد ائتمان، دمج المكررات، وكشف حساب تفصيلي.",
  },
  {
    key: "reports",
    icon: BarChart3,
    title: "التقارير",
    desc: "مؤشرات لحظية، أعمار الديون، أفضل العملاء، وأفضل المنتجات.",
  },
  {
    key: "ai",
    icon: Bot,
    title: "المساعد الذكي",
    desc: "أنشئ فاتورة أو عميلاً أو دفعة من الشات — مع مراجعتك قبل التنفيذ.",
    blue: true,
  },
  {
    key: "multi",
    icon: Building2,
    title: "تعدد الشركات",
    desc: "لكل شركة عملتها ولونها وشعارها ومستخدموها وصلاحياتهم.",
  },
];

export default function FeatureModuleCard({ icon: Icon, title, desc, blue = false }) {
  const accent = blue ? "rgba(37,99,235,.16)" : "rgba(201,162,39,.12)";
  const accentBorder = blue ? "rgba(37,99,235,.4)" : "rgba(201,162,39,.35)";
  const accentColor = blue ? "#93c5fd" : "#e5c558";
  return (
    <div className="s-card s-card-hover" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        aria-hidden="true"
        style={{
          width: 46, height: 46, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: accent, border: `1px solid ${accentBorder}`, color: accentColor, flexShrink: 0,
        }}
      >
        <Icon size={22} strokeWidth={2} />
      </span>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
        {tr(title)}
        {blue && (
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "#93c5fd", background: "rgba(37,99,235,.14)", border: "1px solid rgba(37,99,235,.35)", borderRadius: 6, padding: "2px 6px", fontFamily: "'Inter',sans-serif" }}>
            AI
          </span>
        )}
      </h3>
      <p style={{ margin: 0, color: "rgba(255,255,255,.58)", fontSize: 13.5, lineHeight: 1.9 }}>{tr(desc)}</p>
    </div>
  );
}
