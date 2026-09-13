/**
 * r15: جدول العملات المشترك (آمن للخادم — بلا React/تأثيرات جانبية).
 * نسخة موحدة المصدر لميزات الخادم (سياق المساعد الذكي، إجراءات AI).
 * جدول الواجهة الكامل (مع المستمعين والرندر الحي) في
 * components/invoice-app/currency.js — القيم هنا مطابقة له حرفياً.
 */
export interface CurrencyInfo {
  ar: string;
  short: string;
  code: string;
  flag: string;
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  KWD: { ar: "دينار كويتي", short: "د.ك", code: "KWD", flag: "🇰🇼", decimals: 3 },
  SAR: { ar: "ريال سعودي", short: "ر.س", code: "SAR", flag: "🇸🇦", decimals: 2 },
  AED: { ar: "درهم إماراتي", short: "د.إ", code: "AED", flag: "🇦🇪", decimals: 2 },
  QAR: { ar: "ريال قطري", short: "ر.ق", code: "QAR", flag: "🇶🇦", decimals: 2 },
  BHD: { ar: "دينار بحريني", short: "د.ب", code: "BHD", flag: "🇧🇭", decimals: 3 },
  OMR: { ar: "ريال عماني", short: "ر.ع", code: "OMR", flag: "🇴🇲", decimals: 3 },
  EGP: { ar: "جنيه مصري", short: "ج.م", code: "EGP", flag: "🇪🇬", decimals: 2 },
  USD: { ar: "دولار أمريكي", short: "$", code: "USD", flag: "🇺🇸", decimals: 2 },
  EUR: { ar: "يورو", short: "€", code: "EUR", flag: "🇪🇺", decimals: 2 },
  GBP: { ar: "جنيه إسترليني", short: "£", code: "GBP", flag: "🇬🇧", decimals: 2 },
  TRY: { ar: "ليرة تركية", short: "₺", code: "TRY", flag: "🇹🇷", decimals: 2 },
  JOD: { ar: "دينار أردني", short: "د.أ", code: "JOD", flag: "🇯🇴", decimals: 3 },
};

const DEFAULT = CURRENCIES.KWD;

export function currencyOf(code: string | null | undefined): CurrencyInfo {
  return CURRENCIES[String(code || "").toUpperCase()] || DEFAULT;
}

/** تنسيق مبلغ بعملة محددة — "92.900 د.ك" / "250.00 $" (للخادم والواجهة النصية) */
export function fmtMoneyFor(n: number | null | undefined, code: string | null | undefined): string {
  const c = currencyOf(code);
  const v = Number(n ?? 0) || 0;
  return v.toFixed(c.decimals) + " " + c.short;
}
