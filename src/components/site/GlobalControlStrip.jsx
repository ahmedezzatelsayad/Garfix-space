"use client";

/**
 * r24: GlobalControlStrip — شريط التحكم العالمي التفاعلي تحت البطل.
 * يجعل الزائر «يلمس» عالمية المنتج فوراً:
 *  - اللغة: تبديل حقيقي لواجهة الموقع (5 اختيارات سريعة — الكامل 28 في النافبار).
 *  - الاتجاه: مؤشر حي (RTL/LTR) يتبع اللغة المختارة.
 *  - العملة: تبدّل أرقام الموكاب والتسعير (حالة مرفوعة من HomePage).
 *  - الضريبة: تشغيل/إيقاع VAT يظهر أثره في عرض الـAI والتسعير.
 *  - الدولة: اختيار العرض (مع فلسطين) — يجسّد التغطية العالمية.
 */
import { ArrowLeftRight, Coins, Languages, MapPin, Percent } from "lucide-react";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";
import { CURRENCIES } from "@/lib/currency-shared";
import { CONTROL_CURRENCIES } from "./site-shared";

const QUICK_LANGS = [
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
];

const COUNTRIES = [
  { code: "KW", ar: "الكويت", en: "Kuwait", flag: "🇰🇼" },
  { code: "SA", ar: "السعودية", en: "Saudi", flag: "🇸🇦" },
  { code: "AE", ar: "الإمارات", en: "UAE", flag: "🇦🇪" },
  { code: "EG", ar: "مصر", en: "Egypt", flag: "🇪🇬" },
  { code: "PS", ar: "فلسطين", en: "Palestine", flag: "🇵🇸" },
  { code: "US", ar: "الولايات المتحدة", en: "USA", flag: "🇺🇸" },
];

function Group({ icon: Ic, label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "rgba(229,197,88,.8)", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
        <Ic size={14} aria-hidden="true" /> {label}
      </span>
      <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{children}</span>
    </div>
  );
}

function Pill({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        border: `1px solid ${active ? "rgba(201,162,39,.55)" : "rgba(255,255,255,.14)"}`,
        background: active ? "rgba(201,162,39,.18)" : "rgba(255,255,255,.04)",
        color: active ? "#e5c558" : "rgba(255,255,255,.65)",
        borderRadius: 9, padding: "4px 10px", fontSize: 11, fontWeight: 800,
        fontFamily: "inherit", cursor: "pointer", transition: "all .18s", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function GlobalControlStrip({ currency, setCurrency, taxOn, setTaxOn, country, setCountry }) {
  const { lang, setLang, dir } = useI18n();
  const isAr = lang === "ar";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px", width: "100%" }}>
      <div
        className="s-fade s-fade-4"
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center",
          gap: "2px 18px", padding: "10px 18px", borderRadius: 20,
          background: "rgba(255,255,255,.04)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(201,162,39,.2)", boxShadow: "0 16px 44px rgba(0,0,0,.35)",
        }}
      >
        <Group icon={Languages} label={tr("اللغة")}>
          {QUICK_LANGS.map((l) => (
            <Pill key={l.code} active={lang === l.code} onClick={() => setLang(l.code)} title={l.label}>
              <span style={{ fontSize: 13 }}>{l.flag}</span> {l.label}
            </Pill>
          ))}
        </Group>

        <Group icon={ArrowLeftRight} label={tr("الاتجاه")}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "1px solid rgba(37,99,235,.4)", background: "rgba(37,99,235,.12)", color: "#93c5fd",
            borderRadius: 9, padding: "4px 10px", fontSize: 11, fontWeight: 800, fontFamily: "'Inter',sans-serif",
          }}>
            {dir === "rtl" ? "RTL ←" : "→ LTR"}
          </span>
        </Group>

        <Group icon={Coins} label={tr("العملة")}>
          {CONTROL_CURRENCIES.map((c) => {
            const info = CURRENCIES[c];
            return (
              <Pill key={c} active={currency === c} onClick={() => setCurrency(c)} title={isAr ? info.ar : (info.en || c)}>
                <span style={{ fontSize: 13 }}>{info.flag}</span> {isAr ? info.short : (info.shortEn || c)}
              </Pill>
            );
          })}
        </Group>

        <Group icon={Percent} label={tr("الضريبة")}>
          <Pill active={taxOn} onClick={() => setTaxOn(true)}>{tr("VAT مفعّل")}</Pill>
          <Pill active={!taxOn} onClick={() => setTaxOn(false)}>{tr("بدون ضريبة")}</Pill>
        </Group>

        <Group icon={MapPin} label={tr("الدولة")}>
          {COUNTRIES.map((c) => (
            <Pill key={c.code} active={country === c.code} onClick={() => setCountry(c.code)} title={isAr ? c.ar : c.en}>
              <span style={{ fontSize: 13 }}>{c.flag}</span> <span style={{ display: "inline" }}>{isAr ? c.ar : c.en}</span>
            </Pill>
          ))}
        </Group>
      </div>
    </div>
  );
}
