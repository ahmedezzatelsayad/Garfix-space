"use client";
/**
 * AiPanel — لوحة GarfiX AI الجانبية (يمين المحتوى، r25).
 *
 * لوحة سياقية فاخرة: ترويسة كحلية بشارة AI ذهبية + المساعد الذكي الكامل داخلها.
 * تظهر عند الطلب فقط (زر Sparkles في الشريط العلوي) وعلى الشاشات العريضة.
 */
import { Sparkles, X, MessageSquare } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { GX_GOLD } from "./shell-css";
import SmartChat from "../components/SmartChat";

export default function AiPanel({ open, onClose, company, onDataChanged }) {
  if (!open) return null;
  return (
    <aside className="gx-ai-wrap" aria-label={tr("لوحة المساعد الذكي")}>
      <div className="gx-ai-head">
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(212,175,55,.15)",
          border: "1px solid rgba(212,175,55,.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={16} color={GX_GOLD} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>GarfiX AI</span>
            <span className="gx-ai-badge">AI</span>
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>
            {tr("اسألني أي شيء أو أعطني مهمة")}
          </div>
        </div>
        <button onClick={onClose} aria-label={tr("إغلاق لوحة الذكاء الاصطناعي")}
          style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer",
            borderRadius: 9, padding: 6, display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div className="gx-ai-body">
        {/* المساعد الذكي الكامل — بيانات الشركة الحية + إجراءات بمراجعة بشرية */}
        <SmartChat company={company} onDataChanged={onDataChanged} compact />
        <div style={{ display: "none" }} aria-hidden="true"><MessageSquare size={1} /></div>
      </div>
    </aside>
  );
}
