"use client";

/**
 * HelloSlider — «مرحباً بالعالم» بكل لغات العالم 🌏 داخل قسم البطل بالصفحة الرئيسية.
 *
 * بأسلوب إعلانات آبل الشهيرة: التحية تتوالى لغةً لغة بخطّ أنيق لكل نظام كتابة،
 * بلا نهاية (سلايدر لا نهائي) — مع اسم اللغة وعدّاد تحت التحية.
 *
 * - تبدأ دائماً بلغة واجهة الزائر الحالية (من garfix_lang أو لغة المتصفح).
 * - تتوقف مؤقتاً عند مرور المؤشر/اللمس أو عند إخفاء التبويب (توفير للمعالج).
 * - تراعي prefers-reduced-motion (تُعرض التحية بلا حركة، تتبدّل ببطء).
 * - نص التحية زخرفي (aria-hidden) — العنوان الحقيقي h1 يبقى تحته للـ SEO.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { tr } from "@/lib/i18n-app";
import { useI18n } from "@/lib/i18n-context";

/* ─── «مرحباً بالعالم» بكل لغات العالم (٧٧ لغة) ───
 * f: hand = خطّ يدوي لاتيني · serif = سيريف للغات غير اللاتينية · sans = CJK · arab = عربية/فارسية/أردية
 * rtl: مكتوبة من اليمين لليسار · ln: اسم اللغة بالعربية · le: اسمها بالإنجليزية (تسمية أسفل التحية بلغة الواجهة)
 */
const HELLOS = [
  // لغات المنصة الـ28 أولاً (بترتيب مبدّل اللغة)
  { c: "ar", t: "مرحباً بالعالم", rtl: true, f: "arab", ln: "العربية", le: "Arabic" },
  { c: "en", t: "Hello, World", rtl: false, f: "hand", ln: "الإنجليزية", le: "English" },
  { c: "bn", t: "হ্যালো বিশ্ব", rtl: false, f: "serif", ln: "البنغالية", le: "Bengali" },
  { c: "de", t: "Hallo Welt", rtl: false, f: "hand", ln: "الألمانية", le: "German" },
  { c: "el", t: "Γεια σου Κόσμε", rtl: false, f: "serif", ln: "اليونانية", le: "Greek" },
  { c: "es", t: "Hola Mundo", rtl: false, f: "hand", ln: "الإسبانية", le: "Spanish" },
  { c: "fa", t: "سلام دنیا", rtl: true, f: "arab", ln: "الفارسية", le: "Persian" },
  { c: "fr", t: "Bonjour le Monde", rtl: false, f: "hand", ln: "الفرنسية", le: "French" },
  { c: "he", t: "שלום עולם", rtl: true, f: "serif", ln: "العبرية", le: "Hebrew" },
  { c: "hi", t: "नमस्ते दुनिया", rtl: false, f: "serif", ln: "الهندية", le: "Hindi" },
  { c: "id", t: "Halo Dunia", rtl: false, f: "hand", ln: "الإندونيسية", le: "Indonesian" },
  { c: "it", t: "Ciao Mondo", rtl: false, f: "hand", ln: "الإيطالية", le: "Italian" },
  { c: "ja", t: "こんにちは、世界", rtl: false, f: "sans", ln: "اليابانية", le: "Japanese" },
  { c: "ko", t: "안녕, 세계", rtl: false, f: "sans", ln: "الكورية", le: "Korean" },
  { c: "ms", t: "Hai Dunia", rtl: false, f: "hand", ln: "الماليزية", le: "Malay" },
  { c: "nl", t: "Hallo Wereld", rtl: false, f: "hand", ln: "الهولندية", le: "Dutch" },
  { c: "pa", t: "ਹੈਲੋ ਸੰਸਾਰ", rtl: false, f: "serif", ln: "البنجابية", le: "Punjabi" },
  { c: "pl", t: "Witaj Świecie", rtl: false, f: "hand", ln: "البولندية", le: "Polish" },
  { c: "pt", t: "Olá Mundo", rtl: false, f: "hand", ln: "البرتغالية", le: "Portuguese" },
  { c: "ru", t: "Привет, мир", rtl: false, f: "serif", ln: "الروسية", le: "Russian" },
  { c: "sw", t: "Habari Dunia", rtl: false, f: "hand", ln: "السواحيلية", le: "Swahili" },
  { c: "ta", t: "வணக்கம் உலகம்", rtl: false, f: "serif", ln: "التاميلية", le: "Tamil" },
  { c: "th", t: "สวัสดีโลก", rtl: false, f: "sans", ln: "التايلاندية", le: "Thai" },
  { c: "tr", t: "Merhaba Dünya", rtl: false, f: "hand", ln: "التركية", le: "Turkish" },
  { c: "uk", t: "Привіт, світе", rtl: false, f: "serif", ln: "الأوكرانية", le: "Ukrainian" },
  { c: "ur", t: "ہیلو دنیا", rtl: true, f: "arab", ln: "الأردية", le: "Urdu" },
  { c: "vi", t: "Xin chào Thế giới", rtl: false, f: "hand", ln: "الفيتنامية", le: "Vietnamese" },
  { c: "zh", t: "你好，世界", rtl: false, f: "sans", ln: "الصينية", le: "Chinese" },
  // …ثم بقية لغات العالم 🌏
  { c: "af", t: "Hello Wêreld", rtl: false, f: "hand", ln: "الأفريقانية", le: "Afrikaans" },
  { c: "am", t: "ሰላም ዓለም", rtl: false, f: "serif", ln: "الأمهرية", le: "Amharic" },
  { c: "az", t: "Salam Dünya", rtl: false, f: "hand", ln: "الأذرية", le: "Azerbaijani" },
  { c: "be", t: "Прывіт, Свет", rtl: false, f: "serif", ln: "البيلاروسية", le: "Belarusian" },
  { c: "bg", t: "Здравей Свят", rtl: false, f: "serif", ln: "البلغارية", le: "Bulgarian" },
  { c: "ca", t: "Hola Món", rtl: false, f: "hand", ln: "الكتالونية", le: "Catalan" },
  { c: "cs", t: "Ahoj světe", rtl: false, f: "hand", ln: "التشيكية", le: "Czech" },
  { c: "cy", t: "Helo Byd", rtl: false, f: "hand", ln: "الويلزية", le: "Welsh" },
  { c: "da", t: "Hej Verden", rtl: false, f: "hand", ln: "الدنماركية", le: "Danish" },
  { c: "et", t: "Tere Maailm", rtl: false, f: "hand", ln: "الإستونية", le: "Estonian" },
  { c: "eu", t: "Kaixo Mundua", rtl: false, f: "hand", ln: "الباسكية", le: "Basque" },
  { c: "fi", t: "Hei Maailma", rtl: false, f: "hand", ln: "الفنلندية", le: "Finnish" },
  { c: "fil", t: "Kumusta Mundo", rtl: false, f: "hand", ln: "الفلبينية", le: "Filipino" },
  { c: "ga", t: "Dia duit a Dhomhain", rtl: false, f: "hand", ln: "الأيرلندية", le: "Irish" },
  { c: "gl", t: "Ola Mundo", rtl: false, f: "hand", ln: "الغاليسية", le: "Galician" },
  { c: "gu", t: "હેલો વર્લ્ડ", rtl: false, f: "serif", ln: "الغوجاراتية", le: "Gujarati" },
  { c: "ha", t: "Sannu Duniya", rtl: false, f: "hand", ln: "الهوسا", le: "Hausa" },
  { c: "hr", t: "Zdravo Svijete", rtl: false, f: "hand", ln: "الكرواتية", le: "Croatian" },
  { c: "hu", t: "Helló Világ", rtl: false, f: "hand", ln: "الهنغارية", le: "Hungarian" },
  { c: "hy", t: "Բարեւ աշխարհ", rtl: false, f: "serif", ln: "الأرمينية", le: "Armenian" },
  { c: "is", t: "Halló Heimur", rtl: false, f: "hand", ln: "الآيسلندية", le: "Icelandic" },
  { c: "ka", t: "მოგესალმები მსოფლიო", rtl: false, f: "serif", ln: "الجورجية", le: "Georgian" },
  { c: "kk", t: "Сәлем Әлем", rtl: false, f: "serif", ln: "الكازاخية", le: "Kazakh" },
  { c: "kn", t: "ಹಲೋ ವಿಶ್ವ", rtl: false, f: "sans", ln: "الكنادية", le: "Kannada" },
  { c: "ky", t: "Салам Дүйнө", rtl: false, f: "serif", ln: "القرغيزية", le: "Kyrgyz" },
  { c: "lo", t: "ສະບາຍດີໂລກ", rtl: false, f: "sans", ln: "اللاوية", le: "Lao" },
  { c: "lt", t: "Sveikas Pasauli", rtl: false, f: "hand", ln: "الليتوانية", le: "Lithuanian" },
  { c: "lv", t: "Sveika Pasaule", rtl: false, f: "hand", ln: "اللاتفية", le: "Latvian" },
  { c: "mk", t: "Здраво Свету", rtl: false, f: "serif", ln: "المقدونية", le: "Macedonian" },
  { c: "ml", t: "ഹലോ വേൾഡ്", rtl: false, f: "sans", ln: "المالايالامية", le: "Malayalam" },
  { c: "mn", t: "Сайн байна уу, Дэлхий", rtl: false, f: "serif", ln: "المنغولية", le: "Mongolian" },
  { c: "mr", t: "नमस्कार जग", rtl: false, f: "serif", ln: "الماراثية", le: "Marathi" },
  { c: "my", t: "မင်္ဂလာပါ ကမ္ဘာလောက", rtl: false, f: "serif", ln: "البورمية", le: "Burmese" },
  { c: "ne", t: "नमस्कार संसार", rtl: false, f: "serif", ln: "النيبالية", le: "Nepali" },
  { c: "no", t: "Hallo Verden", rtl: false, f: "hand", ln: "النرويجية", le: "Norwegian" },
  { c: "ps", t: "سلام نړی", rtl: true, f: "arab", ln: "البشتونية", le: "Pashto" },
  { c: "ro", t: "Salut Lume", rtl: false, f: "hand", ln: "الرومانية", le: "Romanian" },
  { c: "sd", t: "هيلو دنيا", rtl: true, f: "arab", ln: "السندية", le: "Sindhi" },
  { c: "si", t: "හෙලෝ වියුඹ", rtl: false, f: "serif", ln: "السنهالية", le: "Sinhala" },
  { c: "sk", t: "Ahoj Svet", rtl: false, f: "hand", ln: "السلوفاكية", le: "Slovak" },
  { c: "sl", t: "Živjo Svet", rtl: false, f: "hand", ln: "السلوفينية", le: "Slovenian" },
  { c: "sq", t: "Përshëndetje Botë", rtl: false, f: "hand", ln: "الألبانية", le: "Albanian" },
  { c: "sr", t: "Здраво Свете", rtl: false, f: "serif", ln: "الصربية", le: "Serbian" },
  { c: "sv", t: "Hej Världen", rtl: false, f: "hand", ln: "السويدية", le: "Swedish" },
  { c: "te", t: "హలో ప్రపంచం", rtl: false, f: "serif", ln: "التيلوغوية", le: "Telugu" },
  { c: "tg", t: "Салом Ҷаҳон", rtl: false, f: "serif", ln: "الطاجيكية", le: "Tajik" },
  { c: "uz", t: "Salom Dunyo", rtl: false, f: "hand", ln: "الأوزبكية", le: "Uzbek" },
  { c: "yo", t: "Báyo Àwọn", rtl: false, f: "hand", ln: "اليوروبا", le: "Yoruba" },
  { c: "zu", t: "Sawubona Mhlaba", rtl: false, f: "hand", ln: "الزولوية", le: "Zulu" },
];

/* ─── الخطوط لكل نظام كتابة ─── */
const FONTS = {
  hand: "'Snell Roundhand','Savoye LET','Segoe Script','Brush Script MT','Lucida Handwriting',cursive",
  serif: "Georgia,'Times New Roman','Noto Serif','Noto Serif SC',serif",
  sans: "'Helvetica Neue',Arial,'Segoe UI','Noto Sans','Noto Sans SC',sans-serif",
  arab: "'Cairo','Segoe UI',Tahoma,'Noto Naskh Arabic',sans-serif",
};

const STEP_MS = 1500; // إيقاع السلايدر: لغة كل ١٫٥ ثانية

function readLang() {
  try {
    const v = localStorage.getItem("garfix_lang");
    if (v) return v.toLowerCase();
    const nav = (navigator.languages || [navigator.language || "ar"])[0] || "ar";
    return String(nav).toLowerCase().split("-")[0] || "ar";
  } catch { return "ar"; }
}

export default function HelloSlider({ compact = false }) {
  const { lang } = useI18n(); // لغة واجهة الموقع (28 لغة) — للتسمية وترتيب البداية
  // ندوّر القائمة بحيث تبدأ السلسلة بلغة واجهة الزائر (ثم بقية المنصة الـ28 فالعالم)
  const order = useMemo(() => {
    const start = (lang || readLang() || "ar").toLowerCase();
    const i = HELLOS.findIndex((h) => h.c === start);
    return i > 0 ? [...HELLOS.slice(i), ...HELLOS.slice(0, i)] : HELLOS;
  }, [lang]);

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // المتقدّم اللانهائي — يتوقف عند التحويم/اللمس أو إخفاء التبويب
  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current && !document.hidden) {
        setIdx((i) => (i + 1) % order.length);
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [order.length]);

  const cur = order[idx];

  return (
    <div
      className="s-hello-slider s-fade s-fade-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setTimeout(() => setPaused(false), 2600)}
      style={{
        position: "relative",
        margin: compact ? "6px 0 2px" : "10px auto 4px",
        maxWidth: compact ? "100%" : 820,
        minHeight: compact ? "clamp(60px, 9vw, 92px)" : "clamp(96px, 15vw, 148px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "default",
      }}
      aria-label={tr("تحياتنا بكل لغات العالم")}
    >
      {/* التحية — زخرفية (العنوان الحقيقي للصفحة يبقى h1 تحتها) */}
      <div
        key={`${cur.c}-${idx}`}
        dir={cur.rtl ? "rtl" : "ltr"}
        aria-hidden="true"
        style={{
          fontFamily: FONTS[cur.f],
          fontSize: compact ? "clamp(25px, 4.6vw, 48px)" : "clamp(34px, 8vw, 76px)",
          lineHeight: 1.2,
          color: "#fff",
          textAlign: "center",
          padding: "0 18px",
          maxWidth: "100%",
          textShadow: "0 0 42px rgba(229,197,88,.35), 0 3px 16px rgba(0,0,0,.55)",
          animation: "sHelloIn .55s cubic-bezier(.2,.7,.3,1) both",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {cur.t}
      </div>

      {/* اسم اللغة + العدّاد */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "rgba(255,255,255,.45)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: ".05em",
          flexWrap: "wrap",
          justifyContent: "center",
          minHeight: 22,
        }}
      >
        <span style={{ color: "#e5c558" }}>{lang === "ar" ? cur.ln : (cur.le || cur.ln)}</span>
        <span aria-hidden="true" style={{ opacity: .4 }}>·</span>
        <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
          {idx + 1}/{order.length}
        </span>
        <span aria-hidden="true" style={{ opacity: .4 }}>·</span>
        <span style={{ opacity: .8, fontSize: 11 }}>{paused ? tr("⏸ متوقّف — حرّك المؤشر للمتابعة") : tr("🌏 بكل لغات العالم")}</span>
      </div>

      <style>{`
        @keyframes sHelloIn {
          0%   { opacity: 0; filter: blur(14px); transform: scale(.92); }
          60%  { opacity: 1; }
          100% { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .s-hello-slider > div:first-child { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
