#!/usr/bin/env python3
"""
patch-manual.py — r20 manual i18n patches after the codemod:
  App.jsx: imports (useAppI18n/appDir/companyName/dateLocale/LanguageSwitcher),
           root dir, navbar language switcher, document.title, company names,
           stLabel/payMethodLabel usage wraps, CSV header keys, dates, aliphia badge.
  statement.js: dir/lang + date locale + ST/PAY_LABEL tr wraps + buckets labels.
  currency.js: English names + symbols for non-Arabic display.
  RemindersPanel/ReportsTab/SubscriptionsPanel/PurchasesTab: date locale.
  AuthContext: date locale (if any).
"""
import re, sys

ROOT = "/home/z/my-project"
changed = {}

def patch(path, pairs, count_expected=None):
    full = f"{ROOT}/{path}"
    src = open(full, encoding="utf-8").read()
    n = 0
    for old, new in pairs:
        if old in src:
            c = src.count(old)
            src = src.replace(old, new)
            n += c
        else:
            print(f"  !! NOT FOUND in {path}: {old[:70]!r}")
    open(full, "w", encoding="utf-8").write(src)
    changed[path] = n
    print(f"{path}: {n} replacements")

# ═══════════ App.jsx ═══════════
app_pairs = [
    # 1. imports
    ('import { tr } from "@/lib/i18n-app";',
     'import { tr, useAppI18n, appDir, appLang, companyName, dateLocale } from "@/lib/i18n-app";\nimport { LanguageSwitcher } from "@/lib/i18n-context";'),
    # 2. App component: consume i18n (re-render whole tree on language change)
    ('export default function App(){\nconst { user, profile, loading: authLoading, isAdmin, canEdit, allowedCompanies, perms } = useAuth();',
     'export default function App(){\nconst { user, profile, loading: authLoading, isAdmin, canEdit, allowedCompanies, perms } = useAuth();\n// r20: i18n التطبيق — مزامنة اللغة العالمية + إعادة رندر الشجرة عند التبديل\nconst { dir } = useAppI18n();'),
    # 3. root div direction
    ('<div dir="rtl" style={{minHeight:"100vh",background:"var(--ia-bg)"',
     '<div dir={dir} style={{minHeight:"100vh",background:"var(--ia-bg)"'),
    # 4. navbar: language switcher next to theme toggle (before logout button)
    ('<button onClick={logout} style={{background:"rgba(0,0,0,.2)"',
     '<LanguageSwitcher compact />\n      <button onClick={logout} style={{background:"rgba(0,0,0,.2)"'),
    # 5. document.title company name
    ('?`${tabLabel?tabLabel+" | ":""}${company.nameAr} — نظام إدارة الحسابات`',
     '?`${tabLabel?tabLabel+" | ":""}${companyName(company)} — ${tr("نظام إدارة الحسابات")}`'),
    # 6. company display names (JSX)
    ('<span className="co-name" style={{maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company.nameAr}</span>',
     '<span className="co-name" style={{maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{companyName(company)}</span>'),
    ('<div style={{fontSize:"16px",fontWeight:900,color:"#fff",marginBottom:"6px"}}>{co.nameAr}</div>',
     '<div style={{fontSize:"16px",fontWeight:900,color:"#fff",marginBottom:"6px"}}>{companyName(co)}</div>'),
    ('<div style={{fontSize:"11.5px",opacity:.75}}>{tr("سيتم حفظه في دليل")} {company.nameAr}</div>',
     '<div style={{fontSize:"11.5px",opacity:.75}}>{tr("سيتم حفظه في دليل")} {companyName(company)}</div>'),
    # 7. WhatsApp templates / statement: company signature names
    ('tr("تذكير ودّي من {0} 🙏",[company.nameAr]),', 'tr("تذكير ودّي من {0} 🙏",[companyName(company)]),'),
    ('tr("طلب دفع من {0} 💳",[company.nameAr]),', 'tr("طلب دفع من {0} 💳",[companyName(company)]),'),
    # 8. print doc titles + print header arg
    ('tr("فاتورة {0} — {1}",[invList[0].invNum||invList[0].invoiceNumber||invList[0].id,c.nameAr])',
     'tr("فاتورة {0} — {1}",[invList[0].invNum||invList[0].invoiceNumber||invList[0].id,companyName(c)])'),
    ('tr("فواتير ({0}) — {1}",[invList.length,c.nameAr])', 'tr("فواتير ({0}) — {1}",[invList.length,companyName(c)])'),
    ('titleColor,c.name,c.nameAr,c.address,c.city,c.phone,c.email,S.titleWeight',
     'titleColor,c.name,companyName(c),c.address,c.city,c.phone,c.email,S.titleWeight'),
    # 9. print document root lang/dir (doPrint wrapper)
    ('return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${printDocTitle}</title>',
     'return `<!DOCTYPE html><html lang="${appLang()}" dir="${appDir()}"><head><meta charset="utf-8"><title>${printDocTitle}</title>'),
    # 10. stLabel / payMethodLabel usage wraps
    ('const stT=stLabel[getStatus(inv)];', 'const stT=tr(stLabel[getStatus(inv)]);'),
    ('<span className={`b-${st}`}>{stLabel[st]}</span>', '<span className={`b-${st}`}>{tr(stLabel[st])}</span>'),
    ('${payMethodLabel[p.method]||p.method||"—"}', '${tr(payMethodLabel[p.method]||p.method||"—")}'),
    ('"الحالة":stLabel[st]||st,', 'tr("الحالة"):tr(stLabel[st]||st),'),
    # 11. aliphia badge removal (r20: generic import only)
    ('{(inv.source==="import"||inv.source==="aliphia")&&',
     '{(inv.source==="import")&&'),
    # 12. date locales
    ('d.toLocaleDateString("ar",{month:"short"}));', 'd.toLocaleDateString(dateLocale(),{month:"short"}));'),
    ('new Date().toLocaleDateString("ar-KW")]),', 'new Date().toLocaleDateString(dateLocale())]),'),
    # 13. statement WhatsApp signature
    ('`${company.nameAr} — ${company.phone}`', '`${companyName(company)} — ${company.phone}`'),
    # 14. CSV export column keys (function-level object → tr works reactively at call time)
    ('"رقم الفاتورة":', 'tr("رقم الفاتورة"):'),
    ('"التاريخ":inv.date', 'tr("التاريخ"):inv.date'),
    ('"اسم العميل":', 'tr("اسم العميل"):'),
    ('"المنتجات":items.map', 'tr("المنتجات"):items.map'),
    ('"عدد المنتجات":items.length', 'tr("عدد المنتجات"):items.length'),
    ('"التوصيل":Number', 'tr("التوصيل"):Number'),
    ('"الإجمالي":Number', 'tr("الإجمالي"):Number'),
    ('"المدفوع":Number', 'tr("المدفوع"):Number'),
    ('"المتبقي":Number', 'tr("المتبقي"):Number'),
    ('"ملاحظات":inv.notes||""', 'tr("ملاحظات"):inv.notes||""'),
]
patch("src/components/invoice-app/App.jsx", app_pairs)

# ═══════════ statement.js ═══════════
stmt_pairs = [
    ('import { tr } from "@/lib/i18n-app";',
     'import { tr, appDir, appLang, companyName, dateLocale } from "@/lib/i18n-app";'),
    ('const fDate = d => { if (!d) return "—"; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString("ar-KW"); };',
     'const fDate = d => { if (!d) return "—"; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString(dateLocale()); };'),
    ('const today = new Date().toLocaleDateString("ar-KW");',
     'const today = new Date().toLocaleDateString(dateLocale());'),
    # ST/PAY labels: keep Arabic map, wrap at usage
    ('${st.t}${od > 0 ? ` ⏰${od}` : ""}', '${tr(st.t)}${od > 0 ? ` ⏰${od}` : ""}'),
    ('${PAY_LABEL[p.method] || p.method || "—"}', '${tr(PAY_LABEL[p.method] || p.method || "—")}'),
    ('${b.count + tr(" فاتورة")}', '${b.count + tr(" فاتورة")}'),
    # document root lang/dir
    ('return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب ${client?.name || ""} — ${c.name}</title>',
     'return `<!DOCTYPE html><html lang="${appLang()}" dir="${appDir()}"><head><meta charset="utf-8"><title>${tr("كشف حساب {0} — {1}",[client?.name || "", c.name])}</title>'),
    # body direction css
    ("body{font-family:'Tajawal','Cairo',Arial,sans-serif;direction:rtl;color:#1a1a2e;font-size:13px}",
     "body{font-family:'Tajawal','Cairo',Arial,sans-serif;direction:${appDir()};color:#1a1a2e;font-size:13px}"),
    # header company names
    ('${c.nameAr} — ${c.address}, ${c.city}', '${companyName(c)} — ${c.address}, ${c.city}'),
    ('${c.nameAr} | ${c.phone}', '${companyName(c)} | ${c.phone}'),
]
patch("src/components/invoice-app/statement.js", stmt_pairs)

# ═══════════ currency.js ═══════════
patch("src/components/invoice-app/currency.js", [
    ('import { useEffect, useState } from "react";',
     'import { useEffect, useState } from "react";\nimport { appLang } from "@/lib/i18n-app";'),
    ('KWD: { ar: "دينار كويتي",     short: "د.ك",  code: "KWD", flag: "🇰🇼", decimals: 3 },',
     'KWD: { ar: "دينار كويتي",     en: "Kuwaiti Dinar",  short: "د.ك", shortEn: "KD",  code: "KWD", flag: "🇰🇼", decimals: 3 },'),
    ('SAR: { ar: "ريال سعودي",      short: "ر.س",  code: "SAR", flag: "🇸🇦", decimals: 2 },',
     'SAR: { ar: "ريال سعودي",      en: "Saudi Riyal",     short: "ر.س", shortEn: "SAR", code: "SAR", flag: "🇸🇦", decimals: 2 },'),
    ('AED: { ar: "درهم إماراتي",    short: "د.إ",  code: "AED", flag: "🇦🇪", decimals: 2 },',
     'AED: { ar: "درهم إماراتي",    en: "UAE Dirham",      short: "د.إ", shortEn: "AED", code: "AED", flag: "🇦🇪", decimals: 2 },'),
    ('QAR: { ar: "ريال قطري",       short: "ر.ق",  code: "QAR", flag: "🇶🇦", decimals: 2 },',
     'QAR: { ar: "ريال قطري",       en: "Qatari Riyal",    short: "ر.ق", shortEn: "QAR", code: "QAR", flag: "🇶🇦", decimals: 2 },'),
    ('BHD: { ar: "دينار بحريني",    short: "د.ب",  code: "BHD", flag: "🇧🇭", decimals: 3 },',
     'BHD: { ar: "دينار بحريني",    en: "Bahraini Dinar",  short: "د.ب", shortEn: "BHD", code: "BHD", flag: "🇧🇭", decimals: 3 },'),
    ('OMR: { ar: "ريال عماني",      short: "ر.ع",  code: "OMR", flag: "🇴🇲", decimals: 3 },',
     'OMR: { ar: "ريال عماني",      en: "Omani Riyal",     short: "ر.ع", shortEn: "OMR", code: "OMR", flag: "🇴🇲", decimals: 3 },'),
    ('EGP: { ar: "جنيه مصري",       short: "ج.م",  code: "EGP", flag: "🇪🇬", decimals: 2 },',
     'EGP: { ar: "جنيه مصري",       en: "Egyptian Pound",  short: "ج.م", shortEn: "EGP", code: "EGP", flag: "🇪🇬", decimals: 2 },'),
    ('USD: { ar: "دولار أمريكي",    short: "$",    code: "USD", flag: "🇺🇸", decimals: 2 },',
     'USD: { ar: "دولار أمريكي",    en: "US Dollar",       short: "$",   shortEn: "$",   code: "USD", flag: "🇺🇸", decimals: 2 },'),
    ('EUR: { ar: "يورو",            short: "€",    code: "EUR", flag: "🇪🇺", decimals: 2 },',
     'EUR: { ar: "يورو",            en: "Euro",            short: "€",   shortEn: "€",   code: "EUR", flag: "🇪🇺", decimals: 2 },'),
    ('GBP: { ar: "جنيه إسترليني",   short: "£",    code: "GBP", flag: "🇬🇧", decimals: 2 },',
     'GBP: { ar: "جنيه إسترليني",   en: "British Pound",   short: "£",   shortEn: "£",   code: "GBP", flag: "🇬🇧", decimals: 2 },'),
    ('TRY: { ar: "ليرة تركية",      short: "₺",    code: "TRY", flag: "🇹🇷", decimals: 2 },',
     'TRY: { ar: "ليرة تركية",      en: "Turkish Lira",    short: "₺",   shortEn: "₺",   code: "TRY", flag: "🇹🇷", decimals: 2 },'),
    ('JOD: { ar: "دينار أردني",     short: "د.أ",  code: "JOD", flag: "🇯🇴", decimals: 3 },',
     'JOD: { ar: "دينار أردني",     en: "Jordanian Dinar", short: "د.أ", shortEn: "JOD", code: "JOD", flag: "🇯🇴", decimals: 3 },'),
    ('return v.toFixed(c.decimals) + " " + c.short;',
     'return v.toFixed(c.decimals) + " " + (appLang() === "ar" ? c.short : (c.shortEn || c.short));'),
    ('export function currencySymbol() {\n  return current.short;\n}',
     'export function currencySymbol() {\n  return appLang() === "ar" ? current.short : (current.shortEn || current.short);\n}'),
])

# ═══════════ date locales in components ═══════════
patch("src/components/invoice-app/components/RemindersPanel.jsx", [
    ('import { tr } from "@/lib/i18n-app";', 'import { tr, dateLocale } from "@/lib/i18n-app";'),
    ('return d.toLocaleDateString("ar-KW");', 'return d.toLocaleDateString(dateLocale());'),
])
patch("src/components/invoice-app/components/ReportsTab.jsx", [
    ('import { tr } from "@/lib/i18n-app";', 'import { tr, dateLocale } from "@/lib/i18n-app";'),
    ('d.toLocaleDateString("ar", { month: "short" });', 'd.toLocaleDateString(dateLocale(), { month: "short" });'),
    ('lastD.toLocaleDateString("ar-KW");', 'lastD.toLocaleDateString(dateLocale());'),
])
patch("src/components/invoice-app/components/SubscriptionsPanel.jsx", [
    ('import { tr } from "@/lib/i18n-app";', 'import { tr, dateLocale } from "@/lib/i18n-app";'),
    ('new Date(iso).toLocaleDateString("ar");', 'new Date(iso).toLocaleDateString(dateLocale());'),
])
patch("src/components/invoice-app/components/PurchasesTab.jsx", [
    ('import { tr } from "@/lib/i18n-app";', 'import { tr, dateLocale } from "@/lib/i18n-app";'),
    ('new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" })',
     'new Date().toLocaleDateString(dateLocale(), { year: "numeric", month: "long", day: "numeric" })'),
])

print("\nDONE:", changed)
