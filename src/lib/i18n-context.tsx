"use client";

/**
 * r18: سياق اللغات العالمية للواجهة — ٢٨ لغة من src/lib/i18n.ts
 *
 * - LangProvider يغلّف الموقع العام وشاشة الدخول وصفحة الأسعار وتبويب «حسابي».
 * - اللغة تُحفظ في localStorage (garfix_lang) وتُطبق على اتجاه الصفحة (rtl/ltr)
 *   وعلى <html lang> — والسقوط دائماً إلى الإنجليزية ثم العربية.
 * - الداشبورد التشغيلي (الفواتير) يبقى عربياً أولاً؛ الأسطح العامة multilingual.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { LANGUAGES, langOf, tFor, DEFAULT_LANG, type LanguageDef } from "./i18n";

const STORAGE_KEY = "garfix_lang";

interface I18nValue {
  lang: string;
  setLang: (code: string) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
  language: LanguageDef;
  languages: LanguageDef[];
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * r19 (E2E fix): حدث مزامنة بين نسخ LangProvider المتداخلة.
 * الموقع العام يغلّف PricingPage/AccountPanel وكلٌّ منها يغلّف نفسه بمزوّده الخاص —
 * كانت الحالات لا تتزامن: تبديل اللغة من النافبار يحدّث المزوّد الخارجي فقط
 * وتبقى الصفحة الداخلية بلغتها القديمة حتى إعادة التحميل.
 * الحل: setLang يبثّ الحدث وكل مزوّد يستمع له ويحدّث حالته فوراً.
 */
const LANG_CHANGE_EVENT = "garfix-lang-change";

function readStored(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && LANGUAGES.some((l) => l.code === v)) return v;
  } catch {
    /* localStorage محجوب */
  }
  // كشف من متصفح الزائر (أول لغة مدعومة من قائمة المتصفح)
  try {
    const nav = navigator.languages || [navigator.language || "ar"];
    for (const raw of nav) {
      const base = String(raw || "").toLowerCase().split("-")[0];
      if (base && LANGUAGES.some((l) => l.code === base)) return base;
    }
  } catch {
    /* SSR أو متصفح غريب */
  }
  return DEFAULT_LANG;
}

export function LangProvider({ children, initialLang }: { children: React.ReactNode; initialLang?: string | null }) {
  const [lang, setLangState] = useState<string>(initialLang && LANGUAGES.some((l) => l.code === initialLang) ? initialLang : DEFAULT_LANG);

  // أول رسم: اقرأ المخزن/المتصفح (يسبق initialLang من الخادم إن غاب)
  // (قراءة خارجية لنظام المتصفح — داخل requestAnimationFrame لتفادي setState المتزامن)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!initialLang) setLangState(readStored());
      else {
        try { localStorage.setItem(STORAGE_KEY, initialLang); } catch { /* ignore */ }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [initialLang]);

  const setLang = useCallback((code: string) => {
    const c = String(code || "").toLowerCase();
    if (LANGUAGES.some((l) => l.code === c)) {
      setLangState(c);
      try { localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
      // r19: بثّ لكل نسخ LangProvider الأخرى (نفس التبويب) لتتزامن فوراً
      try { window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: c })); } catch { /* SSR */ }
    }
  }, []);

  // r19: الاستماع لتبديل اللغة من أي مزوّد آخر (متداخل أو خارجي)
  useEffect(() => {
    const onLangChange = (e: Event) => {
      const c = (e as CustomEvent<string>).detail;
      if (typeof c === "string" && LANGUAGES.some((l) => l.code === c)) setLangState(c);
    };
    window.addEventListener(LANG_CHANGE_EVENT, onLangChange as EventListener);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, onLangChange as EventListener);
  }, []);

  const language = useMemo(() => langOf(lang), [lang]);
  const t = useMemo(() => tFor(lang), [lang]);

  // اتجاه المستند ولغته تتبعان اللغة المختارة
  useEffect(() => {
    try {
      document.documentElement.lang = language.code;
      document.documentElement.dir = language.dir;
    } catch {
      /* SSR */
    }
  }, [language]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, dir: language.dir, language, languages: LANGUAGES }),
    [lang, setLang, t, language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // خارج المزوّد: قيم افتراضية (عربي RTL) — لا يكسر المكونات المنسية
  const t = tFor(DEFAULT_LANG);
  return { lang: DEFAULT_LANG, setLang: () => {}, t, dir: "rtl", language: langOf(DEFAULT_LANG), languages: LANGUAGES };
}

/** منتقي اللغة الجاهز (زر بأعلام + قائمة) — يستعمله الموقع العام والدخول */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, language, languages, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("common.language")}
        title={t("common.language")}
        style={{
          background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 8,
          color: "#fff", padding: compact ? "6px 9px" : "7px 12px", fontFamily: "inherit",
          fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
        }}
      >
        <Languages size={14} aria-hidden="true" /> <span style={{ maxWidth: compact ? 0 : 86, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{compact ? "" : language.nativeName}</span> <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "110%", insetInlineEnd: 0, zIndex: 300,
            background: "#0d1e35", border: "1px solid rgba(201,162,39,.3)", borderRadius: 12,
            boxShadow: "0 18px 50px rgba(0,0,0,.55)", padding: 8,
            maxHeight: 320, overflowY: "auto", minWidth: 210, maxWidth: "min(92vw, 240px)",
          }}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              role="menuitem"
              onClick={() => { setLang(l.code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: l.code === lang ? "rgba(201,162,39,.15)" : "transparent",
                color: l.code === lang ? "#e5c558" : "rgba(255,255,255,.85)",
                border: "none", borderRadius: 8, padding: "7px 10px", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "start",
              }}
            >
              <span style={{ fontSize: 15 }}>{l.flag}</span>
              <span style={{ flex: 1 }}>{l.nativeName}</span>
              {l.code === lang && <span style={{ fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
