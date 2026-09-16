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
  prefix?: boolean; // r25: الرمز قبل الرقم ($1,250) بدل بعده
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  KWD: { ar: "دينار كويتي", en: "Kuwaiti Dinar", short: "د.ك", shortEn: "KD", code: "KWD", flag: "🇰🇼", decimals: 3 },
  SAR: { ar: "ريال سعودي", en: "Saudi Riyal", short: "ر.س", shortEn: "SAR", code: "SAR", flag: "🇸🇦", decimals: 2 },
  AED: { ar: "درهم إماراتي", en: "UAE Dirham", short: "د.إ", shortEn: "AED", code: "AED", flag: "🇦🇪", decimals: 2 },
  QAR: { ar: "ريال قطري", en: "Qatari Riyal", short: "ر.ق", shortEn: "QAR", code: "QAR", flag: "🇶🇦", decimals: 2 },
  BHD: { ar: "دينار بحريني", en: "Bahraini Dinar", short: "د.ب", shortEn: "BHD", code: "BHD", flag: "🇧🇭", decimals: 3 },
  OMR: { ar: "ريال عماني", en: "Omani Riyal", short: "ر.ع", shortEn: "OMR", code: "OMR", flag: "🇴🇲", decimals: 3 },
  EGP: { ar: "جنيه مصري", en: "Egyptian Pound", short: "ج.م", shortEn: "EGP", code: "EGP", flag: "🇪🇬", decimals: 2 },
  JOD: { ar: "دينار أردني", short: "د.أ", shortEn: "JOD", code: "JOD", flag: "🇯🇴", decimals: 3 },
  INR: { ar: "روبية هندية", short: "₹", shortEn: "₹", code: "INR", flag: "🇮🇳", decimals: 2, prefix: true },
  JPY: { ar: "ين ياباني", short: "¥", shortEn: "¥", code: "JPY", flag: "🇯🇵", decimals: 0, prefix: true },
  CAD: { ar: "دولار كندي", short: "CA$", shortEn: "CA$", code: "CAD", flag: "🇨🇦", decimals: 2, prefix: true },
  AUD: { ar: "دولار أسترالي", short: "A$", shortEn: "A$", code: "AUD", flag: "🇦🇺", decimals: 2, prefix: true },
  USD: { ar: "دولار أمريكي", en: "US Dollar", short: "$", shortEn: "$", code: "USD", flag: "🇺🇸", decimals: 2, prefix: true },
  EUR: { ar: "يورو", en: "Euro", short: "€", shortEn: "€", code: "EUR", flag: "🇪🇺", decimals: 2, prefix: true },
  GBP: { ar: "جنيه إسترليني", en: "British Pound", short: "£", shortEn: "£", code: "GBP", flag: "🇬🇧", decimals: 2, prefix: true },
  TRY: { ar: "ليرة تركية", short: "₺", shortEn: "₺", code: "TRY", flag: "🇹🇷", decimals: 2, prefix: true },
};

const DEFAULT = CURRENCIES.KWD;

export function currencyOf(code: string | null | undefined): CurrencyInfo {
  return CURRENCIES[String(code || "").toUpperCase()] || DEFAULT;
}

/** تنسيق مبلغ بعملة محددة — "$1,250.00" للرمز-الأمامي و"1,250 ر.س" للخليجية (للخادم والواجهة النصية) */
export function fmtMoneyFor(n: number | null | undefined, code: string | null | undefined): string {
  const c = currencyOf(code);
  const v = Number(n ?? 0) || 0;
  const fixed = Math.abs(v).toFixed(c.decimals);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const num = (v < 0 ? "-" : "") + (dec ? `${grouped}.${dec}` : grouped);
  const sym = c.shortEn || c.short;
  return c.prefix ? `${sym}${num}` : `${num} ${sym}`;
}
