"use client";
/**
 * r12: نظام العملات — العملة صارت إعداداً لكل شركة (Company.currency في DB)
 * بدل "د.ك/KD" الثابتة في كل مكان. واجهة برمجية صغيرة:
 *   - CURRENCIES: جدول العملات المدعومة (رمز عربي + symbol + منازل عشرية)
 *   - setCurrency(code): تضبط عملة الجلسة (تُستدعى عند تبديل الشركة)
 *   - fmtMoney(n): تنسيق بالمoney الحالية "92.900 د.ك"
 *   - fmtMoneyC(n, code): تنسيق بعملة محددة
 *   - useCurrency(): hook يعيد رندر عند تغيّر العملة (للعرض الحي في الواجهة)
 *   - currencyOf(code): بيانات عملة (رموز/أعلام/منازل)
 *
 * ملاحظة تصميم: مخزن مستوى الوحدة + مستمعو رندر بدل Context — حتى تظل دوال
 * التنسيق قابلة للاستدعاء من خارج React (statement.js / قوالب الطباعة HTML).
 */
import { useEffect, useState } from "react";
import { appLang } from "@/lib/i18n-app";

export const CURRENCIES = {
  KWD: { ar: "دينار كويتي",     en: "Kuwaiti Dinar",  short: "د.ك", shortEn: "KD",  code: "KWD", flag: "🇰🇼", decimals: 3 },
  SAR: { ar: "ريال سعودي",      en: "Saudi Riyal",     short: "ر.س", shortEn: "SAR", code: "SAR", flag: "🇸🇦", decimals: 2 },
  AED: { ar: "درهم إماراتي",    en: "UAE Dirham",      short: "د.إ", shortEn: "AED", code: "AED", flag: "🇦🇪", decimals: 2 },
  QAR: { ar: "ريال قطري",       en: "Qatari Riyal",    short: "ر.ق", shortEn: "QAR", code: "QAR", flag: "🇶🇦", decimals: 2 },
  BHD: { ar: "دينار بحريني",    en: "Bahraini Dinar",  short: "د.ب", shortEn: "BHD", code: "BHD", flag: "🇧🇭", decimals: 3 },
  OMR: { ar: "ريال عماني",      en: "Omani Riyal",     short: "ر.ع", shortEn: "OMR", code: "OMR", flag: "🇴🇲", decimals: 3 },
  EGP: { ar: "جنيه مصري",       en: "Egyptian Pound",  short: "ج.م", shortEn: "EGP", code: "EGP", flag: "🇪🇬", decimals: 2 },
  USD: { ar: "دولار أمريكي",    en: "US Dollar",       short: "$",   shortEn: "$",   code: "USD", flag: "🇺🇸", decimals: 2 },
  EUR: { ar: "يورو",            en: "Euro",            short: "€",   shortEn: "€",   code: "EUR", flag: "🇪🇺", decimals: 2 },
  GBP: { ar: "جنيه إسترليني",   en: "British Pound",   short: "£",   shortEn: "£",   code: "GBP", flag: "🇬🇧", decimals: 2 },
  TRY: { ar: "ليرة تركية",      en: "Turkish Lira",    short: "₺",   shortEn: "₺",   code: "TRY", flag: "🇹🇷", decimals: 2 },
  JOD: { ar: "دينار أردني",     en: "Jordanian Dinar", short: "د.أ", shortEn: "JOD", code: "JOD", flag: "🇯🇴", decimals: 3 },
};

const DEFAULT = CURRENCIES.KWD;
let current = DEFAULT;
const listeners = new Set();

/** بيانات عملة بالكود — غير المعروف يسقط إلى KWD */
export function currencyOf(code) {
  return CURRENCIES[String(code || "").toUpperCase()] || DEFAULT;
}

/** ضبط عملة الجلسة (يُستدعى عند تغيير الشركة/تحريرها) */
export function setCurrency(code) {
  const next = currencyOf(code);
  if (next.code === current.code) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/** العملة الحالية للجلسة */
export function getCurrency() {
  return current;
}

/** تنسيق مبلغ بعملة محددة (أو الحالية إن غاب الكود) — "92.900 د.ك" */
export function fmtMoney(n, code) {
  const c = code ? currencyOf(code) : current;
  const v = Number(String(n ?? 0).replace(/[^\d.-]/g, "")) || 0;
  return v.toFixed(c.decimals) + " " + (appLang() === "ar" ? c.short : (c.shortEn || c.short));
}

/** رمز العملة الحالية (للـ placeholders مثل «السعر د.ك») */
export function currencySymbol() {
  return appLang() === "ar" ? current.short : (current.shortEn || current.short);
}

/** hook: يعيد رندر المكوّن عند تغيّر عملة الجلسة + يعطيك بياناتها */
export function useCurrency() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return { ...current, fmt: (n) => fmtMoney(n) };
}
