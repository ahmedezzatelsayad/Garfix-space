"use client";

/**
 * r24: نظام التصميم العالمي «GarfiX — AI Business OS»
 * ترقية الموقع العام من «نظام فواتير كويتي» إلى هوية SaaS عالمية فاخرة:
 *  - خط Inter للاتينية (Cairo/Tajawal للعربية) وأرقام جدولية للماليات.
 *  - بطاقات بحواف 20px وظلال ناعمة، وزجاج خفيف في البطل فقط.
 *  - أيقونات lucide بدل الإيموجي في الواجهة العامة.
 * لوحة الألوان: كحلي عميق + ذهبي (هوية أصيلة) + أزرق ملكي لمسات AI.
 */

import { CURRENCIES } from "@/lib/currency-shared";

export const GOLD = "#c9a227";
export const GOLD_DARK = "#9a7318";
export const GOLD_LIGHT = "#e5c558";
/* r24: رموز نظام التصميم العالمي (لمسات فقط — الهوية كحلي/ذهبي) */
export const ROYAL = "#2563EB";
export const ROYAL_SOFT = "rgba(37,99,235,.14)";
export const EMERALD = "#10B981";
export const DANGER = "#EF4444";
export const NAVY = "#07111F";
export const DEEP = "#0B1E3A";

export const SITE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Tajawal:wght@300;400;500;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box}
.site-root{font-family:'Inter','Cairo','Tajawal',sans-serif;direction:rtl;color:#fff;min-height:100vh;display:flex;flex-direction:column;background:linear-gradient(150deg,#07111f 0%,#0b1e3a 45%,#070e1c 100%);position:relative}
.site-bg{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0;contain:paint}
.site-bg .orb1{position:absolute;top:-15%;right:-8%;width:560px;height:560px;background:radial-gradient(circle,rgba(201,162,39,.09) 0%,transparent 70%);border-radius:50%}
.site-bg .orb2{position:absolute;bottom:-20%;left:-8%;width:440px;height:440px;background:radial-gradient(circle,rgba(37,99,235,.07) 0%,transparent 70%);border-radius:50%}
.site-bg .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.012) 1px,transparent 1px);background-size:56px 56px}
.s-z{position:relative;z-index:1}
.s-num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:embed}
.s-btn{border:none;border-radius:12px;padding:12px 22px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;text-decoration:none}
.s-btn:hover{filter:brightness(1.07);transform:translateY(-1px);box-shadow:0 6px 22px rgba(0,0,0,.3)}
.s-btn:active{transform:scale(.97)}
.s-btn-gold{background:linear-gradient(135deg,#d4af37,#a07c1a);color:#fff;box-shadow:0 6px 22px rgba(201,162,39,.4)}
.s-btn-ghost{background:rgba(255,255,255,.06);color:#fff;border:1px solid rgba(255,255,255,.18)}
.s-btn-outline{background:transparent;color:#e5c558;border:1.5px solid rgba(201,162,39,.45)}
.s-btn-outline:hover{background:rgba(201,162,39,.08)}
.s-btn:focus-visible{outline:2.5px solid #c9a227;outline-offset:2px}
.s-card{background:rgba(255,255,255,.035);backdrop-filter:blur(14px);border:1px solid rgba(201,162,39,.14);border-radius:20px;padding:22px;transition:all .25s}
.s-card-hover:hover{transform:translateY(-4px);border-color:rgba(201,162,39,.4);box-shadow:0 18px 48px rgba(0,0,0,.42)}
.s-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.25);color:#e5c558;border-radius:30px;padding:5px 14px;font-size:12px;font-weight:700}
.s-chip-blue{background:rgba(37,99,235,.12);border-color:rgba(37,99,235,.35);color:#93c5fd}
.s-label{color:rgba(201,162,39,.65);font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase}
.s-nav{display:flex;gap:4px}
.s-navrow{display:flex;align-items:center;gap:14px;max-width:1180px;margin:0 auto;padding:10px 20px}
@media(max-width:720px){.s-navrow{gap:8px;padding:8px 12px}.s-navrow .s-btn{padding:8px 12px;font-size:11.5px}.s-brand-sub{display:none}.s-brand-name{max-width:108px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.s-cta-long{display:none}.s-cta-short{display:inline}}
.s-cta-short{display:none}
@media(max-width:400px){.s-navrow .s-btn{padding:7px 10px;font-size:11px}}
.s-footer-cols{display:grid;grid-template-columns:2fr 1fr 1fr;gap:28px}
@media(max-width:720px){.s-footer-cols{grid-template-columns:1fr;gap:20px}}
.s-nav-link{color:rgba(255,255,255,.72);text-decoration:none;font-size:13.5px;font-weight:700;padding:8px 14px;border-radius:10px;transition:all .18s;border:1px solid transparent;display:inline-flex;align-items:center;gap:7px}
.s-nav-link:hover{color:#fff;background:rgba(255,255,255,.07)}
.s-nav-link.active{color:#e5c558;background:rgba(201,162,39,.12);border-color:rgba(201,162,39,.3)}
.s-stat{flex:1;min-width:130px;text-align:center;padding:18px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(201,162,39,.16);border-radius:16px;transition:all .25s}
.s-stat:hover{border-color:rgba(201,162,39,.45);transform:translateY(-2px)}
.s-stat b{display:block;font-size:30px;font-weight:900;color:#fff;line-height:1.15;font-variant-numeric:tabular-nums}
.s-stat span{font-size:12px;color:rgba(255,255,255,.55);font-weight:600}
.s-avatar{border-radius:50%;object-fit:cover;background:linear-gradient(135deg,#c9a227,#a07c1a);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;flex-shrink:0;box-shadow:0 6px 20px rgba(201,162,39,.35)}
.s-social{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.75);text-decoration:none;font-size:15px;transition:all .2s}
.s-social:hover{background:rgba(201,162,39,.15);border-color:rgba(201,162,39,.45);color:#e5c558;transform:translateY(-2px)}
.s-fade{animation:sFadeUp .5s ease both}
.s-fade-1{animation-delay:.06s}.s-fade-2{animation-delay:.14s}.s-fade-3{animation-delay:.22s}.s-fade-4{animation-delay:.3s}
@keyframes sFadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes sFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes sPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.9;transform:scale(1.03)}}
.s-hero-title{font-size:clamp(26px,5vw,44px);font-weight:900;line-height:1.3;margin:14px 0 16px;text-shadow:0 2px 30px rgba(201,162,39,.2)}
.s-hero-sub{color:rgba(255,255,255,.6);font-size:clamp(14px,2vw,16.5px);line-height:1.9;max-width:640px;margin:0 auto 28px;font-weight:400}
.s-section{max-width:1180px;margin:0 auto;padding:64px 20px;width:100%}
.s-section-title{text-align:center;font-size:clamp(22px,3.5vw,30px);font-weight:900;margin-bottom:10px}
.s-section-sub{text-align:center;color:rgba(255,255,255,.55);font-size:14px;margin-bottom:40px;line-height:1.8}
.s-features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.s-team-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.s-companies{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.s-footer{margin-top:auto;border-top:1px solid rgba(201,162,39,.15);background:rgba(4,10,20,.6);padding-bottom:calc(18px + env(safe-area-inset-bottom))}
.s-quote-mark{font-size:110px;line-height:.6;color:rgba(201,162,39,.3);font-family:Georgia,serif}
.s-burger{display:none;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;padding:8px 12px;cursor:pointer}
@media(max-width:900px){.s-features{grid-template-columns:repeat(2,1fr)}.s-team-grid{grid-template-columns:repeat(2,1fr)}.s-companies{grid-template-columns:repeat(2,1fr)}}
@media(max-width:720px){.s-nav{display:none}.s-burger{display:inline-flex}.site-bg .orb1{right:0;width:300px;height:300px;top:-10%}.site-bg .orb2{left:0;width:260px;height:260px;bottom:-12%}}
/* r24: في الشاشات الضيقة يختفي زر الدخول الشبحي (يبقى الذهبي + القائمة) حتى لا يفيض الصف */
@media(max-width:600px){.s-navrow .s-btn-ghost{display:none!important}}
@media(max-width:560px){.s-features{grid-template-columns:1fr}.s-team-grid{grid-template-columns:1fr}.s-companies{grid-template-columns:1fr}.s-section{padding:44px 16px}.s-hero-cta{flex-direction:column;width:100%}.s-hero-cta .s-btn{width:100%;justify-content:center}}
`;

/** القيم الافتراضية — تعمل حتى لو فشل الـ API (و يتفوق عليها المحتوى المحفوظ في قاعدة البيانات) */
export const DEFAULT_CONTENT = {
  site_name: "الشركة القابضة المتحدة",
  site_name_en: "United Holding Group",
  hero_badge: "نظام إدارة الحسابات المتكامل",
  hero_title: "إدارة مالية ذكية لكل شركاتك، في مكان واحد",
  hero_sub:
    "من الفاتورة الأولى حتى آخر دينار محصَّل: فواتير فورية، مدفوعات جزئية، تذكيرات واتساب، تقارير لحظية، ومساعد ذكي يقرأ بياناتك ويجيبك — بعملة كل شركة وبالعربية الكاملة.",
  founder_name: "أحمد عزت السيد",
  founder_title: "المؤسس والرئيس التنفيذي",
  founder_emoji: "👨‍💼",
  founder_photo: "",
  founder_message:
    "بدأنا من سؤال واحد بسيط سأله لي صاحب متجر في الكويت: «ليش كل شهر بقضي ساعتين أطابق الفواتير باليد؟» — من ذلك السؤال وُلد هذا النظام.\n\nأؤمن أن إدارة المال ليست جداول وأرقاماً، بل ثقة: ثقة العميل بأن فاتورته واضحة، وثقة التاجر بأن رصيده محسوب بدقة إلى آخر قرش، وثقة الفريق بأن كل عملية مكتوبة ومسؤولة.\n\nهذا المشروع بالنسبة لي ليس منتجاً نقطة وننتهي، بل رحلة نشارككم فيها: نظام ينمو مع كل شركة تنضم إلينا، ويتعلم من كل فاتورة تُصدر.\n\nشكراً لثقتكم — وكل عام والتجارة الكويتية بخير وازدهار.",
  founder_signature: "أحمد عزت السيد",
  contact_phone: "+96598737207",
  contact_email: "ahmedezzatelsayad@gmail.com",
  contact_address: "الكويت — حولي",
};

/**
 * r24: شعار GarfiX — «G» ذهبية بتدرج فاخر (بديل احترافي للإيموجي 🏛️).
 * size: ضلع المربع · sub: نص فرعي اختياري تحت الشعار (غير مستعمل افتراضياً)
 */
export function LogoMark({ size = 38, radius = 11, fontSize, glow = true }) {
  const fs = fontSize ?? Math.round(size * 0.52);
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg,#e5c558 0%,#c9a227 55%,#9a7318 100%)",
        boxShadow: glow ? "0 4px 16px rgba(201,162,39,.45), inset 0 1px 0 rgba(255,255,255,.35)" : "none",
        fontFamily: "'Inter','Cairo',sans-serif", fontWeight: 900, color: "#07111f",
        fontSize: fs, letterSpacing: "-.03em", userSelect: "none",
      }}
    >
      G
    </span>
  );
}

/**
 * r24: عملات شريط التحكم العالمي — رموز قصيرة بالعربية والإنجليزية + تقريب سعر الصرف
 * (تقريبات ثابتة للعرض التسويقي فقط؛ التسعير الحقيقي داخل النظام بعملة الشركة).
 */
export const CONTROL_CURRENCIES = ["KWD", "USD", "SAR", "AED", "EGP", "EUR"];

export const FX_USD = {
  USD: 1, KWD: 0.31, SAR: 3.75, AED: 3.67, EGP: 48.5, EUR: 0.92,
};

/** تحويل مبلغ من الدولار إلى عملة العرض + تنسيق برمز العملة القصير حسب اللغة */
export function fxFromUsd(usd, code, lang = "ar") {
  const c = CURRENCIES[code] || CURRENCIES.USD;
  const rate = FX_USD[code] ?? 1;
  const v = (Number(usd) || 0) * rate;
  const sym = lang === "ar" ? c.short : (c.shortEn || c.code);
  return `${v.toLocaleString("en-US", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })} ${sym}`;
}

export function memberAvatar(m, size = 72) {
  if (m.photoUrl) {
    return (
      <img
        src={m.photoUrl}
        alt={m.name}
        className="s-avatar"
        style={{ width: size, height: size }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  const inner = m.emoji || (m.name || "؟").trim().charAt(0);
  return (
    <div className="s-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {inner}
    </div>
  );
}
