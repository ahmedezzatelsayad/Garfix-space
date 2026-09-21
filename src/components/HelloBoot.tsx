"use client";

/**
 * HelloBoot — شاشة إقلاع «Hello, World» بأسلوب آيفون بكل لغات العالم 🌏
 *
 * التجربة: شاشة سوداء خالصة تُحيّ الزائر بـ«مرحباً بالعالم» لغةً لغة (٧٦ لغة)،
 * بخطّ يدوي أنيق للغات اللاتينية — مثل إقلاع أجهزة آبل الشهير — ثم تُختتم
 * بشعار Garfix الذهبي قبل كشف التطبيق.
 *
 * - تعمل مرة واحدة لكل جلسة متصفح (sessionStorage: garfix_hello_boot).
 * - أي نقرة/لمسة في أي مكان = تخطٍّ فوري.
 * - حماية «قبل أول رسم» (r29/F5): سكربت مضمّن في layout.tsx يضبط
 *   html[data-garfix-boot] فتُلوَّن الخلفية سوداء فوراً (CSS) قبل تحميل React —
 *   بلا وميض وبلا إضافة عُقد DOM قد تُربك الترطيب؛ يزيله هذا المكوّن عند بدء
 *   العرض، مع مؤقّت أمان ٦ ثوانٍ داخل السكربت نفسه.
 * - هذا المكوّن يعرض {children} دائماً (التطبيق يُحمّل خلف الشاشة) + طبقة الإقلاع فوقه.
 * - مركّب في src/app/page.tsx حول <App/> — تراكيب فقط من جهة العميل، ولا
 *   يظهر شيء لمحركات البحث (مرحلة "check" تطابق SSR تماماً).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ─── «مرحباً بالعالم» بكل لغات العالم (٧٦ لغة) ───
 * f: hand = خطّ يدوي لاتيني · serif = سيريف للغات غير اللاتينية · sans = CJK
 * rtl: اللغات المكتوبة من اليمين لليسار
 * r29 (M6): حُذف العبرية (he) — قرار r26: 27 لغة بلا إسرائيل/العبرية.
 */
const HELLOS = [
  // لغات المنصة الـ27 أولاً (بترتيب مبدّل اللغة)
  { c: "ar", t: "مرحباً بالعالم", rtl: true, f: "arab" },
  { c: "en", t: "Hello, World", rtl: false, f: "hand" },
  { c: "bn", t: "হ্যালো বিশ্ব", rtl: false, f: "serif" },
  { c: "de", t: "Hallo Welt", rtl: false, f: "hand" },
  { c: "el", t: "Γεια σου Κόσμε", rtl: false, f: "serif" },
  { c: "es", t: "Hola Mundo", rtl: false, f: "hand" },
  { c: "fa", t: "سلام دنیا", rtl: true, f: "arab" },
  { c: "fr", t: "Bonjour le Monde", rtl: false, f: "hand" },
  { c: "hi", t: "नमस्ते दुनिया", rtl: false, f: "serif" },
  { c: "id", t: "Halo Dunia", rtl: false, f: "hand" },
  { c: "it", t: "Ciao Mondo", rtl: false, f: "hand" },
  { c: "ja", t: "こんにちは、世界", rtl: false, f: "sans" },
  { c: "ko", t: "안녕, 세계", rtl: false, f: "sans" },
  { c: "ms", t: "Hai Dunia", rtl: false, f: "hand" },
  { c: "nl", t: "Hallo Wereld", rtl: false, f: "hand" },
  { c: "pa", t: "ਹੈਲੋ ਸੰਸਾਰ", rtl: false, f: "serif" },
  { c: "pl", t: "Witaj Świecie", rtl: false, f: "hand" },
  { c: "pt", t: "Olá Mundo", rtl: false, f: "hand" },
  { c: "ru", t: "Привет, мир", rtl: false, f: "serif" },
  { c: "sw", t: "Habari Dunia", rtl: false, f: "hand" },
  { c: "ta", t: "வணக்கம் உலகம்", rtl: false, f: "serif" },
  { c: "th", t: "สวัสดีโลก", rtl: false, f: "sans" },
  { c: "tr", t: "Merhaba Dünya", rtl: false, f: "hand" },
  { c: "uk", t: "Привіт, світе", rtl: false, f: "serif" },
  { c: "ur", t: "ہیلو دنیا", rtl: true, f: "arab" },
  { c: "vi", t: "Xin chào Thế giới", rtl: false, f: "hand" },
  { c: "zh", t: "你好，世界", rtl: false, f: "sans" },
  // …ثم بقية لغات العالم 🌏
  { c: "af", t: "Hello Wêreld", rtl: false, f: "hand" },
  { c: "am", t: "ሰላም ዓለም", rtl: false, f: "serif" },
  { c: "az", t: "Salam Dünya", rtl: false, f: "hand" },
  { c: "be", t: "Прывіт, Свет", rtl: false, f: "serif" },
  { c: "bg", t: "Здравей Свят", rtl: false, f: "serif" },
  { c: "ca", t: "Hola Món", rtl: false, f: "hand" },
  { c: "cs", t: "Ahoj světe", rtl: false, f: "hand" },
  { c: "cy", t: "Helo Byd", rtl: false, f: "hand" },
  { c: "da", t: "Hej Verden", rtl: false, f: "hand" },
  { c: "et", t: "Tere Maailm", rtl: false, f: "hand" },
  { c: "eu", t: "Kaixo Mundua", rtl: false, f: "hand" },
  { c: "fi", t: "Hei Maailma", rtl: false, f: "hand" },
  { c: "fil", t: "Kumusta Mundo", rtl: false, f: "hand" },
  { c: "ga", t: "Dia duit a Dhomhain", rtl: false, f: "hand" },
  { c: "gl", t: "Ola Mundo", rtl: false, f: "hand" },
  { c: "gu", t: "હેલો વર્લ્ડ", rtl: false, f: "serif" },
  { c: "ha", t: "Sannu Duniya", rtl: false, f: "hand" },
  { c: "hr", t: "Zdravo Svijete", rtl: false, f: "hand" },
  { c: "hu", t: "Helló Világ", rtl: false, f: "hand" },
  { c: "hy", t: "Բարեւ աշխարհ", rtl: false, f: "serif" },
  { c: "is", t: "Halló Heimur", rtl: false, f: "hand" },
  { c: "ka", t: "მოგესალმები მსოფლიო", rtl: false, f: "serif" },
  { c: "kk", t: "Сәлем Әлем", rtl: false, f: "serif" },
  { c: "kn", t: "ಹಲೋ ವಿಶ್ವ", rtl: false, f: "sans" },
  { c: "ky", t: "Салам Дүйнө", rtl: false, f: "serif" },
  { c: "lo", t: "ສະບາຍດີໂລກ", rtl: false, f: "sans" },
  { c: "lt", t: "Sveikas Pasauli", rtl: false, f: "hand" },
  { c: "lv", t: "Sveika Pasaule", rtl: false, f: "hand" },
  { c: "mk", t: "Здраво Свету", rtl: false, f: "serif" },
  { c: "ml", t: "ഹലോ വേൾഡ്", rtl: false, f: "sans" },
  { c: "mn", t: "Сайн байна уу, Дэлхий", rtl: false, f: "serif" },
  { c: "mr", t: "नमस्कार जग", rtl: false, f: "serif" },
  { c: "my", t: "မင်္ဂလာပါ ကမ္ဘာလောက", rtl: false, f: "serif" },
  { c: "ne", t: "नमस्कार संसार", rtl: false, f: "serif" },
  { c: "no", t: "Hallo Verden", rtl: false, f: "hand" },
  { c: "ps", t: "سلام نړی", rtl: true, f: "arab" },
  { c: "ro", t: "Salut Lume", rtl: false, f: "hand" },
  { c: "sd", t: "هيلو دنيا", rtl: true, f: "arab" },
  { c: "si", t: "හෙලෝ වියුඹ", rtl: false, f: "serif" },
  { c: "sk", t: "Ahoj Svet", rtl: false, f: "hand" },
  { c: "sl", t: "Živjo Svet", rtl: false, f: "hand" },
  { c: "sq", t: "Përshëndetje Botë", rtl: false, f: "hand" },
  { c: "sr", t: "Здраво Свете", rtl: false, f: "serif" },
  { c: "sv", t: "Hej Världen", rtl: false, f: "hand" },
  { c: "te", t: "హలో ప్రపంచం", rtl: false, f: "serif" },
  { c: "tg", t: "Салом Ҷаҳон", rtl: false, f: "serif" },
  { c: "uz", t: "Salom Dunyo", rtl: false, f: "hand" },
  { c: "yo", t: "Báyo Àwọn", rtl: false, f: "hand" },
  { c: "zu", t: "Sawubona Mhlaba", rtl: false, f: "hand" },
];

/* ─── الخطوط لكل نظام كتابة ─── */
const FONTS = {
  hand: "'Snell Roundhand','Savoye LET','Segoe Script','Brush Script MT','Lucida Handwriting',cursive",
  serif: "Georgia,'Times New Roman','Noto Serif','Noto Serif SC',serif",
  sans: "'Helvetica Neue',Arial,'Segoe UI','Noto Sans','Noto Sans SC',sans-serif",
  arab: "'Cairo','Segoe UI',Tahoma,'Noto Naskh Arabic',sans-serif",
};

/* ─── الإيقاع: اللغات الأولى أبطأ (تُرسّخ النمط) ثم شلال سريع كإعلانات آبل ─── */
const HEAD_N = 8;
const HEAD_MS = 900;
const TAIL_MS = 420;
const FINALE_MS = 2600;
const OUT_MS = 650;
const BOOT_KEY = "garfix_hello_boot";

function readLang() {
  try {
    const v = localStorage.getItem("garfix_lang");
    if (v) return v.toLowerCase();
    // نفس منطق الكشف في i18n-context: أول لغة مدعومة من المتصفح
    const nav = (navigator.languages || [navigator.language || "ar"])[0] || "ar";
    return String(nav).toLowerCase().split("-")[0] || "ar";
  } catch { return "ar"; }
}

export default function HelloBoot({ children }: { children?: React.ReactNode }) {
  // check: أول رسم (مطابق للـ SSR — الطبقة الفورية في layout تغطي الفجوة) → play → finale → out → done
  const [phase, setPhase] = useState<"check" | "play" | "finale" | "out" | "done">("check");
  const [idx, setIdx] = useState(0);
  const [lang] = useState(readLang());
  const isAr = lang === "ar";

  // هل شُغّلت الشاشة هذه الجلسة؟ (لا تعمل إلا مرة واحدة لكل جلسة متصفح)
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(BOOT_KEY) === "1"; } catch { /* sessionStorage محجوب */ }
    // setState متعمد داخل effect: مرحلة "check" الأولية تطابق SSR وتمنع اختلاف الترطيب
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase(seen ? "done" : "play");
  }, []);

  // التقديم: لغة تلو الأخرى، ثم الخاتمة
  useEffect(() => {
    if (phase !== "play") return;
    const ms = idx < HEAD_N ? HEAD_MS : TAIL_MS;
    const id = setTimeout(() => {
      if (idx + 1 >= HELLOS.length) setPhase("finale");
      else setIdx(i => i + 1);
    }, ms);
    return () => clearTimeout(id);
  }, [phase, idx]);

  // الخاتمة → الخروج المتلاشي (مع تعليم الجلسة كمُشاهَدة)
  useEffect(() => {
    if (phase === "finale") {
      const id = setTimeout(() => setPhase("out"), FINALE_MS);
      return () => clearTimeout(id);
    }
    if (phase === "out") {
      try { sessionStorage.setItem(BOOT_KEY, "1"); } catch { /* ignore */ }
      const id = setTimeout(() => setPhase("done"), OUT_MS);
      return () => clearTimeout(id);
    }
  }, [phase]);

  // بمجرد ظهور طبقتنا: أسقط خلفية ما-قبل-الرسم الفورية (بلا وميض — قبل الرسم)
  useLayoutEffect(() => {
    if (phase === "play" || phase === "finale") {
      try { document.documentElement.removeAttribute("data-garfix-boot"); } catch { /* ignore */ }
    }
  }, [phase]);

  // عند التخطي: أنهِ فوراً إلى مرحلة الخروج
  const skip = () => {
    if (phase === "play" || phase === "finale") setPhase("out");
  };

  if (phase === "check" || phase === "done") return <>{children}</>;

  const cur = HELLOS[Math.min(idx, HELLOS.length - 1)];
  const progress = ((Math.min(idx, HELLOS.length - 1) + 1) / HELLOS.length) * 100;
  const playing = phase === "play";

  return (
    <>
      {children}
      <div
        id="garfix-hello-layer"
        onClick={skip}
        role="presentation"
        aria-label={isAr ? "شاشة الإقلاع — اضغط للتخطي" : "Boot screen — tap to skip"}
        style={{
          position: "fixed", inset: 0, zIndex: 999999, background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", overflow: "hidden", touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          ...(phase === "out" ? { animation: "garfixBootOut .65s ease forwards" } : {}),
        }}
      >
        {/* هالة خافتة في المنتصف — عمق سينمائي */}
        <div aria-hidden style={{ position: "absolute", width: "80vmin", height: "80vmin", borderRadius: "50%", background: "radial-gradient(circle, rgba(201,162,39,.10) 0%, transparent 62%)", filter: "blur(6px)" }} />

        {phase === "finale" ? (
          /* ── الخاتمة: شعار Garfix ── */
          <div style={{ textAlign: "center", animation: "garfixBrandIn 1.1s cubic-bezier(.2,.8,.2,1) both", padding: "0 20px" }}>
            <div style={{ fontSize: "clamp(48px, 12vw, 84px)", marginBottom: 10, filter: "drop-shadow(0 6px 24px rgba(201,162,39,.45))" }}>🏛️</div>
            <div style={{
              fontSize: "clamp(34px, 9vw, 64px)", fontWeight: 900, letterSpacing: ".3em", lineHeight: 1.1,
              background: "linear-gradient(135deg,#f5d97a 0%,#c9a227 45%,#e9d98a 70%,#a07c1a 100%)",
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              filter: "drop-shadow(0 2px 18px rgba(201,162,39,.35))", marginInlineStart: ".3em",
            }}>GARFIX</div>
            <div style={{ color: "rgba(255,255,255,.55)", fontSize: "clamp(12px, 2.6vw, 15px)", marginTop: 14, fontWeight: 600, letterSpacing: ".08em" }}>
              {isAr ? "نظام إدارة الحسابات الذكي" : "Smart Accounting, Invoicing & AI"}
            </div>
          </div>
        ) : (
          /* ── التحية: لغة تلو لغة ── */
          <div
            key={`${cur.c}-${idx}`}
            dir={cur.rtl ? "rtl" : "ltr"}
            style={{
              fontFamily: FONTS[cur.f as keyof typeof FONTS],
              fontSize: "clamp(30px, 8.4vw, 78px)",
              color: "#fff", textAlign: "center", padding: "0 22px", maxWidth: "94vw",
              textShadow: "0 0 34px rgba(255,255,255,.28), 0 2px 12px rgba(0,0,0,.6)",
              animation: "garfixHelloIn .5s cubic-bezier(.2,.7,.3,1) both",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              lineHeight: 1.25,
            }}
          >
            {cur.t}
          </div>
        )}

        {/* شريط التقدم الذهبي */}
        <div aria-hidden style={{ position: "absolute", bottom: 0, insetInline: 0, height: 3, background: "rgba(255,255,255,.07)" }}>
          <div style={{ height: "100%", width: `${phase === "finale" ? 100 : progress}%`, background: "linear-gradient(90deg,#a07c1a,#e5c558,#f5d97a)", boxShadow: "0 0 12px rgba(229,197,88,.55)", transition: "width .38s ease" }} />
        </div>

        {/* العدّاد + تلميح التخطي */}
        <div style={{ position: "absolute", bottom: 26, insetInline: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, pointerEvents: "none" }}>
          {playing && (
            <div style={{ color: "rgba(255,255,255,.28)", fontSize: 11, fontWeight: 700, letterSpacing: ".22em", fontVariantNumeric: "tabular-nums" }}>
              {idx + 1} / {HELLOS.length}
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 700, letterSpacing: ".06em" }}>
            👆 {isAr ? "اضغط في أي مكان للتخطي" : "Tap anywhere to skip"}
          </div>
        </div>

        <style>{`
          @keyframes garfixHelloIn {
            0%   { opacity: 0; filter: blur(16px); transform: scale(.9); letter-spacing: .14em; }
            60%  { opacity: 1; }
            100% { opacity: 1; filter: blur(0); transform: scale(1); letter-spacing: normal; }
          }
          @keyframes garfixBrandIn {
            0%   { opacity: 0; filter: blur(14px); transform: scale(.88); }
            100% { opacity: 1; filter: blur(0); transform: scale(1); }
          }
          @keyframes garfixBootOut {
            to { opacity: 0; visibility: hidden; }
          }
          @media (prefers-reduced-motion: reduce) {
            #garfix-hello-layer * { animation-duration: .01s !important; }
          }
        `}</style>
      </div>
    </>
  );
}
