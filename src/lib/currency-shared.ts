/**
 * r15: جدول العملات المشترك (آمن للخادم — بلا React/تأثيرات جانبية).
 * نسخة موحدة المصدر لميزات الخادم (سياق المساعد الذكي، إجراءات AI).
 * جدول الواجهة الكامل (مع المستمعين والرندر الحي) في
 * components/invoice-app/currency.js — القيم هنا مطابقة له حرفياً.
 */
export interface CurrencyInfo {
  ar: string;
  en?: string;
  short: string;
  shortEn?: string;
  code: string;
  flag: string;
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  KWD: { ar: "دينار كويتي", en: "Kuwaiti Dinar", short: "د.ك", shortEn: "KD", code: "KWD", flag: "🇰🇼", decimals: 3 },
  SAR: { ar: "ريال سعودي", en: "Saudi Riyal", short: "ر.س", shortEn: "SAR", code: "SAR", flag: "🇸🇦", decimals: 2 },
  AED: { ar: "درهم إماراتي", en: "UAE Dirham", short: "د.إ", shortEn: "AED", code: "AED", flag: "🇦🇪", decimals: 2 },
  QAR: { ar: "ريال قطري", en: "Qatari Riyal", short: "ر.ق", shortEn: "QAR", code: "QAR", flag: "🇶🇦", decimals: 2 },
  BHD: { ar: "دينار بحريني", en: "Bahraini Dinar", short: "د.ب", shortEn: "BHD", code: "BHD", flag: "🇧🇭", decimals: 3 },
  OMR: { ar: "ريال عماني", en: "Omani Riyal", short: "ر.ع", shortEn: "OMR", code: "OMR", flag: "🇴🇲", decimals: 3 },
  EGP: { ar: "جنيه مصري", en: "Egyptian Pound", short: "ج.م", shortEn: "EGP", code: "EGP", flag: "🇪🇬", decimals: 2 },
  USD: { ar: "دولار أمريكي", en: "US Dollar", short: "$", shortEn: "$", code: "USD", flag: "🇺🇸", decimals: 2 },
  EUR: { ar: "يورو", en: "Euro", short: "€", shortEn: "€", code: "EUR", flag: "🇪🇺", decimals: 2 },
  GBP: { ar: "جنيه إسترليني", en: "British Pound", short: "£", shortEn: "£", code: "GBP", flag: "🇬🇧", decimals: 2 },
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
