"use client";

/**
 * i18n-app: طبقة ترجمة التطبيق التشغيلي (الداشبورد) — r20.
 *
 * المشكلة: الواجهة العامة متعددة اللغات (i18n.ts بـ 28 لغة) لكن التطبيق
 * نفسه كان عربياً صرفاً — فيبقى عربياً حتى لو غيّر المستخدم اللغة.
 *
 * الحل: دالة tr() عالمية مفتاحها النص العربي المصدر نفسه:
 *   - lang=ar → يعيد النص كما هو (سلوك اليوم، بلا أي انكسار)
 *   - أي لغة أخرى → يبحث في قاموس APP_EN ويسقط إلى النص العربي إن غاب
 *   - قوالب {0}/{1} تُستبدل بالوسائط (تعمل بالعربية والإنجليزية معاً)
 *
 * التفاعلية: useAppI18n() يُستدعى مرة في App — يزامن المتغير العالمي مع
 * LangProvider (سياق الواجهة) ويعيد رندر الشجرة كلها عند تبديل اللغة،
 * فتُعاد قراءة كل tr() باللغة الجديدة فوراً.
 *
 * الاتجاه: appDir() يعيد rtl/ltr حسب اللغة الحالية (العربية والفارسية
 * والعبرية والأردية والبنجابية rtl، والبقية ltr) — تستعمله الجذور والطباعة.
 */

import { useEffect } from "react";
import { useI18n } from "./i18n-context";
import { APP_EN } from "./app-dict-en";

// ── اللغة العالمية للوحدة (تُحدَّث من LangProvider عبر useAppI18n والحدث العام) ──
let currentLang = "ar";

const RTL_LANGS = new Set(["ar", "fa", "he", "ur", "pa"]);
const norm = (l: string | null | undefined) =>
  String(l ?? "").trim().toLowerCase().split(/[-_]/)[0] || "ar";

export function setAppLang(lang: string | null | undefined) {
  currentLang = norm(lang);
}

export function appLang(): string {
  return currentLang;
}

export function appDir(): "rtl" | "ltr" {
  return RTL_LANGS.has(currentLang) ? "rtl" : "ltr";
}

/** هل اللغة الحالية عربية؟ (تُستخدم لاختيارات لا تخص القاموس) */
export function isArabic(): boolean {
  return currentLang === "ar";
}

/**
 * ترجمة نص عربي مصدر. args تُستبدل بـ {0},{1}… في القالب.
 * - العربية: النص كما هو مع الاستبدال.
 * - غيرها: قاموس APP_EN (سقوط إلى العربية عند الغياب) مع الحفاظ
 *   على فراغات البداية/النهاية عند مطابقة النص المُقلَّم.
 */
export function tr(src: string, args?: unknown[]): string {
  let out: string;
  if (currentLang === "ar") {
    out = src;
  } else {
    const exact = APP_EN[src];
    if (exact != null) {
      out = exact;
    } else {
      const trimmed = src.trim();
      const hit = APP_EN[trimmed];
      if (hit != null) {
        out = (src.startsWith(" ") ? " " : "") + hit + (src.endsWith(" ") ? " " : "");
      } else {
        out = src; // لا توجد ترجمة — يبقى العربي (سقوط آمن)
      }
    }
  }
  if (args && args.length) {
    out = out.replace(/\{(\d+)\}/g, (_m, i) => {
      const v = args[Number(i)];
      return v == null ? "" : String(v);
    });
  }
  return out;
}

/**
 * Hook الجسري: يُستدعى في App (مرة واحدة أعلى الشجرة):
 *  - يزامن اللغة العالمية مع سياق LangProvider أثناء الرندر (أول رسم صحيح)
 *  - يعيد رندر الشجرة عند تبديل اللغة (state الخاص بالمزوّد)
 *  - يستمع لحدث تبديل اللغة من مزوّدين متداخلين (r19) ويزامن المتغير العالمي
 */
export function useAppI18n() {
  const ctx = useI18n();
  // مزامنة أثناء الرندر: أول استخدام للنصوص يقرأ اللغة الصحيحة مباشرة
  setAppLang(ctx.lang);
  // وبعد الالتزام أيضاً (تحصين لحساب StrictMode/Concurrent)
  useEffect(() => {
    setAppLang(ctx.lang);
  }, [ctx.lang]);
  return ctx;
}

// ── تهيئة جانبية: حدث تبديل اللغة العام (r19) + تخزين عبر التبويبات ──
// يُحدِّث المتغير العالمي حتى خارج شجرة الرندر (مثلاً قبل الدخول أو في الطباعة)
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("garfix_lang");
    if (stored) setAppLang(stored);
  } catch { /* localStorage محجوب */ }
  try {
    window.addEventListener("garfix-lang-change", ((e: CustomEvent<string>) => {
      if (e && typeof e.detail === "string") setAppLang(e.detail);
    }) as EventListener);
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === "garfix_lang" && e.newValue) setAppLang(e.newValue);
    });
  } catch { /* SSR */ }
}

/** اسم الشركة باللغة الحالية: عربي→nameAr، غيره→name (مع سقوط للأخر) */
export function companyName(co: { name?: string; nameAr?: string } | null | undefined): string {
  if (!co) return "";
  if (currentLang === "ar") return co.nameAr || co.name || "";
  return co.name || co.nameAr || "";
}

/** إعداد عرض التواريخ حسب اللغة: العربية ar-KW، غيرها en-GB */
export function dateLocale(): string {
  return currentLang === "ar" ? "ar-KW" : "en-GB";
}
