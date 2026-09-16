"use client";
/**
 * Onboarding — تجربة التهيئة الأولية لـ GarfiX Business OS (r25).
 *
 * الهدف: إنشاء شركة في أقل من دقيقتين — بلا إحساس «نموذج محاسبة طويل».
 *
 * البنية: شريط جانبي كحلي (الشعار + متدرّج الخطوات + مبدّل اللغة أسفلاً)
 * ومساحة عمل بيضاء يميناً. ٦ خطوات بالإفصاح التدريجي:
 *   1. أساسيات الشركة (اسم/نوع/دولة/هاتف بمفتاح دولي ذكي)
 *   2. إعدادات الأعمال (عملة/لغة/صيغة تاريخ/منطقة زمنية — مستنبطة من الدولة)
 *   3. العملة والضريبة (نظام الضريبة والنسبة + معاينة فاتورة)
 *   4. تجهيز الشركة (شعار/لون/بريد — كلها اختيارية «أكملها لاحقاً»)
 *   5. الاكتمال (نجاح + ملخص — بلا دفع إطلاقاً قبل رؤية المنتج)
 *   6. البدء السريع الذكي (إنشاء فاتورة/عملاء/استيراد/اسأل AI)
 *
 * الافتراضيات الذكية: من الدولة + لغة المتصفح + اللغة المختارة + نوع العمل.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Building2, Globe2, Coins, Rocket, Check, ChevronLeft, ChevronRight,
  FilePlus2, Users, Upload, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Briefcase, Languages, Clock3, Percent, Palette, Mail, MapPin, PartyPopper,
} from "lucide-react";
import { appDir, tr } from "@/lib/i18n-app";
import { LanguageSwitcher } from "@/lib/i18n-context";
import { useI18n } from "@/lib/i18n-context";
import { WORLD_COUNTRIES, WORLD_BY_CODE } from "@/lib/countries-world";
import { CURRENCIES } from "../currency";
import { api } from "../api";
import { GX_NAVY, GX_NAVY2, GX_ROYAL, GX_GOLD } from "../shell/shell-css";

/* ── مفاتيح الهاتف الدولية (الدول الشائعة) ── */
const DIAL = {
  KW: "965", SA: "966", AE: "971", QA: "973", BH: "973", OM: "968", JO: "962", EG: "20",
  PS: "970", IQ: "964", LB: "961", SY: "963", YE: "967", MA: "212", DZ: "213", TN: "216",
  LY: "218", SD: "249", MR: "222", SO: "252", DJ: "253", KM: "269",
  US: "1", CA: "1", GB: "44", IE: "353", DE: "49", FR: "33", IT: "39", ES: "34",
  NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358",
  PL: "48", PT: "351", GR: "30", CZ: "420", RO: "40", HU: "36", UA: "380", RU: "7",
  TR: "90", CN: "86", JP: "81", KR: "82", IN: "91", PK: "92", BD: "880", LK: "94",
  ID: "62", MY: "60", SG: "65", TH: "66", VN: "84", PH: "63", HK: "852", TW: "886",
  AU: "61", NZ: "64", BR: "55", MX: "52", AR: "54", CL: "56", CO: "57", PE: "51",
  NG: "234", KE: "254", GH: "233", ZA: "27", TZ: "255", ET: "251", SN: "221", CI: "225",
};

/* ── أنواع الأعمال (اقتراحات ذكية) ── */
const BIZ_TYPES = [
  { id: "trading", t: () => tr("شركة تجارية"), emoji: "🏬" },
  { id: "retail", t: () => tr("متجر تجزئة"), emoji: "🏪" },
  { id: "online", t: () => tr("متجر إلكتروني"), emoji: "🛒" },
  { id: "services", t: () => tr("خدمات واستشارات"), emoji: "🏢" },
  { id: "tech", t: () => tr("تقنية وبرمجيات"), emoji: "💻" },
  { id: "food", t: () => tr("مطعم وأغذية"), emoji: "🍽️" },
  { id: "contracting", t: () => tr("مقاولات وإنشاءات"), emoji: "🏗️" },
  { id: "health", t: () => tr("صحة وعناية"), emoji: "🩺" },
  { id: "education", t: () => tr("تعليم وتدريب"), emoji: "🎓" },
  { id: "other", t: () => tr("أخرى"), emoji: "✨" },
];

const BRAND_COLORS = ["#2563EB", "#0B1E3A", "#D4AF37", "#059669", "#7C3AED", "#0D9488", "#DC2626", "#B45309"];

const TIMEZONES = () => {
  const base = ["UTC", "Asia/Kuwait", "Asia/Riyadh", "Asia/Dubai", "Asia/Qatar", "Africa/Cairo",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Istanbul", "Europe/Moscow",
    "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Sao_Paulo",
    "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Jakarta", "Asia/Singapore",
    "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Africa/Nairobi", "Africa/Lagos"];
  let browser = "";
  try { browser = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  return browser && !base.includes(browser) ? [browser, ...base] : base;
};

const flagOf = code => {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

/* ── استنباط الدولة الأولى ── */
function guessCountry() {
  try {
    const stored = localStorage.getItem("garfix_country");
    if (stored && WORLD_BY_CODE[stored]) return stored;
    const m = (navigator.language || "").match(/[-_]([A-Z]{2})\b/);
    if (m && WORLD_BY_CODE[m[1].toUpperCase()]) return m[1].toUpperCase();
  } catch {}
  return "KW";
}

const STEPS = [
  { id: "basics", t: () => tr("أساسيات الشركة"), icon: Building2 },
  { id: "config", t: () => tr("إعدادات الأعمال"), icon: Globe2 },
  { id: "tax", t: () => tr("العملة والضريبة"), icon: Coins },
  { id: "setup", t: () => tr("تجهيز الشركة"), icon: Rocket },
  { id: "done", t: () => tr("الاكتمال"), icon: CheckCircle2 },
  { id: "quick", t: () => tr("البدء السريع الذكي"), icon: Sparkles },
];

export default function Onboarding({ onDone, onCancel }) {
  const { lang } = useI18n();
  const dir = appDir();
  const [step, setStep] = useState(0); // 0..5
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);
  const NextIcon = dir === "rtl" ? ChevronLeft : ChevronRight;
  const BackIcon = dir === "rtl" ? ChevronRight : ChevronLeft;
  const GoIcon = dir === "rtl" ? ArrowLeft : ArrowRight;

  const country0 = guessCountry();
  const [f, setF] = useState(() => ({
    // الخطوة 1
    name: "", nameAr: "", bizType: "trading", country: country0,
    phone: "",
    // الخطوة 2 (مستنبطة)
    currency: (WORLD_BY_CODE[country0]?.currency && CURRENCIES[WORLD_BY_CODE[country0].currency]) ? WORLD_BY_CODE[country0].currency : "USD",
    lang: WORLD_BY_CODE[country0]?.arabic ? "ar" : "en",
    dateFormat: "DD/MM/YYYY",
    timezone: "",
    // الخطوة 3
    taxKind: WORLD_BY_CODE[country0]?.vat > 0 ? "VAT" : "none",
    taxRate: String(WORLD_BY_CODE[country0]?.vat || 0),
    // الخطوة 4 (اختيارية)
    emoji: BIZ_TYPES[0].emoji, color: BRAND_COLORS[0], email: "", address: "",
  }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => { if (!f.timezone) set("timezone", TIMEZONES()[0] || "UTC"); }, []);

  const country = WORLD_BY_CODE[f.country];
  const dial = DIAL[f.country] ? `+${DIAL[f.country]}` : "";
  const cur = CURRENCIES[f.currency] || CURRENCIES.USD;
  const bizType = BIZ_TYPES.find(b => b.id === f.bizType) || BIZ_TYPES[0];

  /* عند تغيير الدولة: تحديث العملة/اللغة/الضريبة تلقائياً (ما لم يعدّلها المستخدم يدوياً) */
  const onCountry = code => {
    const c = WORLD_BY_CODE[code];
    setF(p => ({
      ...p,
      country: code,
      currency: c && CURRENCIES[c.currency] ? c.currency : "USD",
      lang: c?.arabic ? "ar" : p.lang,
      taxKind: (c?.vat || 0) > 0 ? "VAT" : "none",
      taxRate: String(c?.vat || 0),
      phone: "", // رقم جديد لكل دولة
    }));
  };

  const stepValid = s => {
    if (s === 0) return f.name.trim().length >= 2 && f.phone.replace(/\D/g, "").length >= 5;
    if (s === 2) return f.taxKind === "none" || (parseFloat(f.taxRate) >= 0 && parseFloat(f.taxRate) <= 100);
    return true;
  };

  /* إنشاء الشركة (الخطوة 4 ← 5) */
  const createCompany = async () => {
    setErr("");
    setBusy(true);
    try {
      const payload = {
        name: f.name.trim(),
        nameAr: (f.nameAr || f.name).trim(),
        phone: `${dial}${f.phone.replace(/[^\d]/g, "")}`.replace(/^\+/, "+"),
        email: f.email.trim(),
        address: f.address.trim(),
        city: country ? (lang === "ar" ? country.nameAr : country.nameEn) : "",
        sellerRef: "",
        manager: "",
        managerPhone: `${dial}${f.phone.replace(/[^\d]/g, "")}`,
        color: f.color,
        accent: f.color,
        cardBg: "#f1f5f9",
        emoji: f.emoji,
        currency: f.currency,
        taxEnabled: f.taxKind !== "none",
        defaultTaxRate: f.taxKind === "none" ? 0 : Math.max(0, Math.min(100, parseFloat(f.taxRate) || 0)),
      };
      const row = await api.createCompany(payload);
      setCreated(row);
      setStep(4);
    } catch (e) {
      setErr(e?.message || tr("تعذّر إنشاء الشركة — حاول مجدداً"));
    } finally {
      setBusy(false);
    }
  };

  const quickStart = [
    { key: "createInvoice", icon: FilePlus2, t: () => tr("أنشئ فاتورتك الأولى"), s: () => tr("دقيقة واحدة — عميل ومنتج وسعر") },
    { key: "addCustomer", icon: Users, t: () => tr("أضف عملاءك"), s: () => tr("دليل عملاء عالمي بمحافظات 195 دولة") },
    { key: "importData", icon: Upload, t: () => tr("استورد بياناتك"), s: () => tr("CSV / Excel — فواتير وعملاء") },
    { key: "askAI", icon: Sparkles, t: () => tr("اسأل GarfiX AI"), s: () => tr("مساعد متصل ببيانات شركتك") },
  ];

  const taxPreview = useMemo(() => {
    const sub = 100, rate = f.taxKind === "none" ? 0 : (parseFloat(f.taxRate) || 0);
    const tax = +(sub * rate / 100).toFixed(2);
    return { sub, tax, total: sub + tax, rate };
  }, [f.taxKind, f.taxRate]);

  return (
    <div dir={dir} style={{ minHeight: "100vh", display: "flex", background: "#F8FAFC", fontFamily: "'Inter','Cairo','Tajawal',sans-serif" }}>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Cairo:wght@400;600;700;900&display=swap');
.ob-inp{width:100%;border:1.5px solid #dbe2ea;border-radius:11px;padding:10px 13px;font-family:inherit;font-size:13.5px;
  background:#fff;color:#0F172A;outline:none;transition:border-color .15s,box-shadow .15s}
.ob-inp:focus{border-color:${GX_ROYAL};box-shadow:0 0 0 3px rgba(37,99,235,.14)}
.ob-lbl{display:block;font-size:11.5px;font-weight:800;color:#475569;margin-bottom:5px}
.ob-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:11px;
  padding:11px 22px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:all .15s}
.ob-btn:disabled{opacity:.45;cursor:not-allowed}
.ob-next{background:${GX_ROYAL};color:#fff}
.ob-next:not(:disabled):hover{filter:brightness(1.07);box-shadow:0 6px 18px rgba(37,99,235,.35)}
.ob-back{background:#fff;border:1.5px solid #dbe2ea;color:#475569}
.ob-back:hover{border-color:#94a3b8}
.ob-sel{cursor:pointer;-webkit-appearance:none;appearance:none;
  background-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;padding-inline-end:30px}
[dir="rtl"] .ob-sel{background-position:left 12px center;padding-inline-end:13px;padding-inline-start:30px}
.ob-card{background:#fff;border:1px solid #e6ecf3;border-radius:18px;padding:22px;box-shadow:0 1px 3px rgba(15,23,42,.05)}
.ob-chip{display:inline-flex;align-items:center;gap:7px;background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);
  color:${GX_ROYAL};border-radius:99px;padding:5px 13px;font-size:11.5px;font-weight:800}
.ob-opt{border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;cursor:pointer;font-family:inherit;
  display:flex;align-items:center;gap:9px;font-size:12.5px;font-weight:700;color:#334155;transition:all .14s;text-align:start}
.ob-opt:hover{border-color:#94a3b8}
.ob-opt.on{border-color:${GX_ROYAL};background:rgba(37,99,235,.06);color:#1e40af;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.ob-emoji{font-size:20px;width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;transition:all .14s}
.ob-emoji.on{border-color:${GX_GOLD};background:rgba(212,175,55,.1);box-shadow:0 0 0 3px rgba(212,175,55,.15)}
@media(max-width:900px){.ob-side{display:none}.ob-steps-m{display:flex!important}}
`}</style>

      {/* الشريط الجانبي الكحلي */}
      <aside className="ob-side" style={{ width: 288, flexShrink: 0, background: `linear-gradient(180deg,${GX_NAVY},${GX_NAVY2})`, display: "flex", flexDirection: "column", padding: "22px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg,#f0d98c,${GX_GOLD} 55%,#a8842a)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1200", fontWeight: 900, fontSize: 20, boxShadow: "0 4px 14px rgba(212,175,55,.35)" }}>G</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Garfi<b style={{ color: GX_GOLD }}>X</b></div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>{tr("نظام تشغيل الأعمال")}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "8px 13px", marginBottom: 20 }}>
          <Clock3 size={13} color={GX_GOLD} />
          <span style={{ color: "rgba(255,255,255,.85)", fontSize: 11.5, fontWeight: 700 }}>{tr("إعداد سريع — أقل من دقيقتين")}</span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {STEPS.map((s, i) => {
            const done = i < step, active = i === step;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 11, background: active ? "rgba(37,99,235,.18)" : "transparent", boxShadow: active ? "inset 0 0 0 1px rgba(37,99,235,.35)" : undefined }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, background: done ? "rgba(212,175,55,.2)" : active ? GX_ROYAL : "rgba(255,255,255,.08)", color: done ? GX_GOLD : active ? "#fff" : "rgba(255,255,255,.5)" }}>
                  {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                <span style={{ color: active ? "#fff" : done ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.4)", fontSize: 13, fontWeight: active ? 800 : 600 }}>{s.t()}</span>
              </div>
            );
          })}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
          <LanguageSwitcher />
          <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10.5, fontWeight: 600, textAlign: "center" }}>
            {tr("196 دولة · 28 لغة · أي عملة")}
          </div>
        </div>
      </aside>

      {/* منطقة المحتوى */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 20px", overflowY: "auto" }}>
        {/* متدرج أفقي للجوال */}
        <div className="ob-steps-m" style={{ display: "none", gap: 6, width: "100%", maxWidth: 620, marginBottom: 18, alignItems: "center" }}>
          {STEPS.slice(0, 4).map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= Math.min(step, 3) ? GX_ROYAL : "#e2e8f0", transition: "background .2s" }} />
          ))}
          <span style={{ fontSize: 11, fontWeight: 800, color: "#64748B", whiteSpace: "nowrap" }}>{Math.min(step + 1, 5)}/6</span>
        </div>

        <div style={{ width: "100%", maxWidth: 620 }}>
          {/* ═══ 1: أساسيات الشركة ═══ */}
          {step === 0 && (
            <div style={{ animation: "obIn .25s ease" }}>
              <style>{`@keyframes obIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
              <div className="ob-chip" style={{ marginBottom: 12 }}><Rocket size={12} /> {tr("إعداد سريع")}</div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: -.3 }}>{tr("أنشئ شركتك")}</h1>
              <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 500, margin: "7px 0 4px", lineHeight: 1.7 }}>
                {tr("خطوتان قصيرتان ويكون كل شيء جاهزاً — يمكنك تخطي الباقي وإكماله لاحقاً من الإعدادات.")}
              </p>

              <div className="ob-card" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", gap: 15, marginBottom: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
                  {[["🌍", tr("جاهز عالمياً")], ["💱", tr("عملات متعددة")], ["✨", tr("مدعوم بالذكاء")], ["🔒", tr("آمن ومحمي")]].map(([e, t], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                      <span style={{ fontSize: 15 }}>{e}</span> {t}
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-name">{tr("اسم الشركة (إنجليزي)")} *</label>
                    <input id="ob-name" className="ob-inp" placeholder="Tech Solutions Co." value={f.name}
                      onChange={e => set("name", e.target.value)} dir="ltr" style={{ textAlign: "start" }} />
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-namear">{lang === "ar" ? tr("الاسم (عربي)") : tr("الاسم العربي (اختياري)")}</label>
                    <input id="ob-namear" className="ob-inp" placeholder={lang === "ar" ? "شركة تكنولوجيا الحلول" : "Tech Solutions Co."} value={f.nameAr}
                      onChange={e => set("nameAr", e.target.value)} />
                  </div>
                </div>
                <div style={{ marginTop: 13 }}>
                  <label className="ob-lbl" htmlFor="ob-type">{tr("نوع النشاط")}</label>
                  <select id="ob-type" className="ob-inp ob-sel" value={f.bizType} onChange={e => { set("bizType", e.target.value); const b = BIZ_TYPES.find(x => x.id === e.target.value); if (b) set("emoji", b.emoji); }}>
                    {BIZ_TYPES.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.t()}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 13, marginTop: 13 }}>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-country">{tr("الدولة")} *</label>
                    <select id="ob-country" className="ob-inp ob-sel" value={f.country} onChange={e => onCountry(e.target.value)}>
                      {WORLD_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{flagOf(c.code)} {lang === "ar" ? c.nameAr : c.nameEn}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-phone">{tr("رقم الهاتف")} *</label>
                    <div style={{ display: "flex", gap: 7 }}>
                      <span style={{ display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 11, border: "1.5px solid #dbe2ea", background: "#f8fafc", color: "#334155", fontSize: 13, fontWeight: 800, direction: "ltr", whiteSpace: "nowrap" }}>
                        {flagOf(f.country)} {dial || "+"}
                      </span>
                      <input id="ob-phone" className="ob-inp" placeholder="91234567" inputMode="tel" dir="ltr" style={{ textAlign: "start" }}
                        value={f.phone} onChange={e => set("phone", e.target.value.replace(/[^\d]/g, ""))} />
                    </div>
                  </div>
                </div>
              </div>

              {onCancel && (
                <div style={{ marginTop: 12, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#64748B" }}>
                  {tr("لديك حساب بالفعل؟")}{" "}
                  <button onClick={onCancel} style={{ border: "none", background: "transparent", color: GX_ROYAL, cursor: "pointer", fontWeight: 800, fontFamily: "inherit", fontSize: 12.5 }}>{tr("اختر شركة موجودة")}</button>
                </div>
              )}
            </div>
          )}

          {/* ═══ 2: إعدادات الأعمال ═══ */}
          {step === 1 && (
            <div style={{ animation: "obIn .25s ease" }}>
              <h1 style={{ fontSize: 23, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: -.3 }}>{tr("إعدادات الأعمال")}</h1>
              <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 500, margin: "7px 0 16px", lineHeight: 1.7 }}>
                {tr("استُنبطت هذه الإعدادات ذكياً من دولتك — يمكنك تعديل أي منها الآن أو لاحقاً.")}
              </p>
              <div className="ob-card">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-cur"><Coins size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("العملة المحاسبية")}</label>
                    <select id="ob-cur" className="ob-inp ob-sel" value={f.currency} onChange={e => set("currency", e.target.value)}>
                      {Object.values(CURRENCIES).map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code} — {lang === "ar" ? c.ar : (c.en || c.ar)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-lang"><Languages size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("لغة الفواتير الافتراضية")}</label>
                    <select id="ob-lang" className="ob-inp ob-sel" value={f.lang} onChange={e => set("lang", e.target.value)}>
                      <option value="ar">العربية (RTL)</option>
                      <option value="en">English (LTR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-df">{tr("صيغة التاريخ")}</label>
                    <select id="ob-df" className="ob-inp ob-sel" value={f.dateFormat} onChange={e => set("dateFormat", e.target.value)}>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-tz">{tr("المنطقة الزمنية")}</label>
                    <select id="ob-tz" className="ob-inp ob-sel" value={f.timezone} onChange={e => set("timezone", e.target.value)}>
                      {TIMEZONES().map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 11, padding: "9px 13px", fontSize: 12, fontWeight: 700, color: "#047857" }}>
                  <CheckCircle2 size={14} />
                  {tr("عملة المحاسبة مستقلة عن عملة العرض — كلاهما قابل للتغيير لاحقاً.")}
                </div>
              </div>
            </div>
          )}

          {/* ═══ 3: العملية والضريبة ═══ */}
          {step === 2 && (
            <div style={{ animation: "obIn .25s ease" }}>
              <h1 style={{ fontSize: 23, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: -.3 }}>{tr("العملة والضريبة")}</h1>
              <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 500, margin: "7px 0 16px", lineHeight: 1.7 }}>
                {tr("اختر نظام الضريبة المناسب لدولتك — استُنبط الاقتراح من {0}.", [country ? (lang === "ar" ? country.nameAr : country.nameEn) : ""])}
              </p>
              <div className="ob-card">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 9 }}>
                  {[
                    { id: "none", t: () => tr("بلا ضريبة"), s: () => tr("لا تُضاف ضريبة") },
                    { id: "VAT", t: () => tr("ضريبة قيمة مضافة"), s: () => "VAT" },
                    { id: "GST", t: () => tr("ضريبة سلع وخدمات"), s: () => "GST" },
                    { id: "SALES", t: () => tr("ضريبة مبيعات"), s: () => "Sales Tax" },
                  ].map(o => (
                    <button key={o.id} className={`ob-opt${f.taxKind === o.id ? " on" : ""}`} style={{ flexDirection: "column", alignItems: "flex-start", gap: 3 }}
                      onClick={() => set("taxKind", o.id)}>
                      <span style={{ fontWeight: 800, fontSize: 12.5 }}>{o.t()}</span>
                      <span style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, direction: "ltr" }}>{o.s()}</span>
                    </button>
                  ))}
                </div>
                {f.taxKind !== "none" && (
                  <div style={{ marginTop: 14 }}>
                    <label className="ob-lbl" htmlFor="ob-rate"><Percent size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("النسبة الافتراضية (٪)")}</label>
                    <input id="ob-rate" className="ob-inp" type="number" min="0" max="100" step="0.5" inputMode="decimal" dir="ltr" style={{ textAlign: "start", maxWidth: 180 }}
                      value={f.taxRate} onChange={e => set("taxRate", e.target.value)} />
                  </div>
                )}
                {/* معاينة الفاتورة */}
                <div style={{ marginTop: 16, border: "1px dashed #cbd5e1", borderRadius: 13, padding: "13px 16px", background: "#f8fafc" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>{tr("معاينة فاتورة")}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#334155" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>{tr("المجموع الفرعي")}</span><b className="gx-num">{cur.prefix ? cur.shortEn || cur.short : cur.short}100.00</b></div>
                    {taxPreview.tax > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{f.taxKind === "VAT" ? tr("ضريبة قيمة مضافة") : f.taxKind === "GST" ? tr("ضريبة سلع وخدمات") : tr("ضريبة مبيعات")} ({taxPreview.rate}%)</span>
                        <b className="gx-num">{cur.prefix ? cur.shortEn || cur.short : cur.short}{taxPreview.tax.toFixed(2)}</b>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 7 }}>
                      <span style={{ fontWeight: 800 }}>{tr("الإجمالي")}</span>
                      <b className="gx-num" style={{ color: GX_ROYAL, fontSize: 15 }}>
                        {cur.prefix ? cur.shortEn || cur.short : cur.short}{taxPreview.total.toFixed(2)}
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 4: تجهيز الشركة ═══ */}
          {step === 3 && (
            <div style={{ animation: "obIn .25s ease" }}>
              <h1 style={{ fontSize: 23, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: -.3 }}>{tr("تجهيز الشركة")}</h1>
              <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 500, margin: "7px 0 16px", lineHeight: 1.7 }}>
                {tr("كل هذا اختياري — أكمله الآن أو لاحقاً من إعدادات الشركة.")}
              </p>
              <div className="ob-card">
                <label className="ob-lbl"><Palette size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("شعار الشركة")}</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 15 }}>
                  {[bizType.emoji, "🏢", "🏬", "🛒", "🏪", "💻", "🍽️", "🏗️", "💎", "🌿", "✨"].filter((v, i, a) => a.indexOf(v) === i).map(e => (
                    <button key={e} className={`ob-emoji${f.emoji === e ? " on" : ""}`} onClick={() => set("emoji", e)} aria-label={e}>{e}</button>
                  ))}
                </div>
                <label className="ob-lbl">{tr("لون العلامة")}</label>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 15 }}>
                  {BRAND_COLORS.map(c => (
                    <button key={c} onClick={() => set("color", c)} aria-label={c}
                      style={{ width: 34, height: 34, borderRadius: 10, background: c, border: f.color === c ? "3px solid #0F172A" : "1.5px solid #e2e8f0", cursor: "pointer", transition: "transform .13s", transform: f.color === c ? "scale(1.08)" : undefined }} />
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-email"><Mail size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("البريد الإلكتروني (اختياري)")}</label>
                    <input id="ob-email" className="ob-inp" placeholder="info@company.com" dir="ltr" style={{ textAlign: "start" }} value={f.email} onChange={e => set("email", e.target.value)} />
                  </div>
                  <div>
                    <label className="ob-lbl" htmlFor="ob-addr"><MapPin size={12} style={{ display: "inline", marginInlineEnd: 4 }} />{tr("العنوان (اختياري)")}</label>
                    <input id="ob-addr" className="ob-inp" placeholder={tr("المدينة — الحي")} value={f.address} onChange={e => set("address", e.target.value)} />
                  </div>
                </div>
                {err && (
                  <div style={{ marginTop: 13, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 11, padding: "10px 13px", color: "#B91C1C", fontSize: 12.5, fontWeight: 700 }}>{err}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="ob-btn ob-back" onClick={() => setStep(2)}><BackIcon size={15} /> {tr("رجوع")}</button>
                <button className="ob-btn ob-next" style={{ flex: 1 }} disabled={busy} onClick={createCompany}>
                  {busy ? <><Loader2 size={15} className="ob-spin" /> {tr("جارٍ إنشاء الشركة…")}</> : <><Rocket size={15} /> {tr("أنشئ شركتي الآن")}</>}
                </button>
              </div>
              <style>{`@keyframes obr{to{transform:rotate(360deg)}}.ob-spin{animation:obr 1s linear infinite}`}</style>
            </div>
          )}

          {/* ═══ 5: الاكتمال ═══ */}
          {step === 4 && (
            <div style={{ textAlign: "center", animation: "obIn .25s ease", padding: "12px 0" }}>
              <div style={{ width: 76, height: 76, borderRadius: 24, background: `linear-gradient(135deg,rgba(16,185,129,.15),rgba(37,99,235,.1))`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <PartyPopper size={34} color="#059669" />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", margin: 0 }}>{tr("أنت جاهز!")}</h1>
              <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 600, margin: "7px auto 18px", maxWidth: 380, lineHeight: 1.7 }}>
                {tr("أُنشئت شركتك بنجاح — أول 100 شركة مجاناً بالكامل. لا حاجة لأي دفع الآن.")}
              </p>
              <div className="ob-card" style={{ textAlign: "start", maxWidth: 430, margin: "0 auto" }}>
                {[
                  [tr("الاسم"), f.nameAr || f.name],
                  [tr("النشاط"), bizType.t()],
                  [tr("الدولة"), `${flagOf(f.country)} ${country ? (lang === "ar" ? country.nameAr : country.nameEn) : ""}`],
                  [tr("العملة"), `${cur.flag} ${cur.code} — ${lang === "ar" ? cur.ar : (cur.en || cur.ar)}`],
                  [tr("الضريبة"), f.taxKind === "none" ? tr("بلا ضريبة") : `${f.taxRate}%`],
                  [tr("اللغة"), f.lang === "ar" ? tr("العربية (RTL)") : "English (LTR)"],
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: i < 5 ? "1px dashed #e2e8f0" : undefined, fontSize: 13 }}>
                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>{k}</span>
                    <b style={{ color: "#334155", textAlign: "end" }}>{v}</b>
                  </div>
                ))}
              </div>
              <button className="ob-btn ob-next" style={{ marginTop: 18, width: "100%", maxWidth: 430, padding: "13px 22px", fontSize: 14 }} onClick={() => setStep(5)}>
                {tr("متابعة إلى البدء السريع")} <NextIcon size={16} />
              </button>
            </div>
          )}

          {/* ═══ 6: البدء السريع الذكي ═══ */}
          {step === 5 && (
            <div style={{ animation: "obIn .25s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <h1 style={{ fontSize: 23, fontWeight: 800, color: "#0F172A", margin: 0 }}>{tr("البدء السريع الذكي")}</h1>
                <p style={{ color: "#64748B", fontSize: 13.5, fontWeight: 600, margin: "7px 0 0" }}>{tr("اختر نقطة البداية — كلها اختيارية.")}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {quickStart.map(q => {
                  const Icon = q.icon;
                  return (
                    <button key={q.key} className="ob-card" style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12, textAlign: "start", fontFamily: "inherit", transition: "transform .15s,box-shadow .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 26px rgba(15,23,42,.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                      onClick={() => onDone?.(created, q.key)}>
                      <span style={{ width: 40, height: 40, borderRadius: 12, background: q.key === "askAI" ? "rgba(212,175,55,.14)" : "rgba(37,99,235,.09)", color: q.key === "askAI" ? "#B8860B" : GX_ROYAL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={19} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{q.t()}</span>
                        <span style={{ display: "block", fontSize: 11.5, color: "#64748B", fontWeight: 600, marginTop: 3, lineHeight: 1.6 }}>{q.s()}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button className="ob-btn ob-back" style={{ marginTop: 16, width: "100%", padding: "12px 22px" }} onClick={() => onDone?.(created)}>
                {tr("تخطي والدخول إلى لوحة التحكم")} <GoIcon size={15} />
              </button>
            </div>
          )}

          {/* أزرار التنقل للخطوات 1-3 */}
          {step > 0 && step < 4 && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="ob-btn ob-back" onClick={() => setStep(s => s - 1)}><BackIcon size={15} /> {tr("رجوع")}</button>
              <button className="ob-btn ob-next" style={{ flex: 1 }} disabled={!stepValid(step)} onClick={() => setStep(s => s + 1)}>
                {tr("التالي")} <NextIcon size={15} />
              </button>
            </div>
          )}
          {step === 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="ob-btn ob-next" style={{ flex: 1, padding: "12px 22px" }} disabled={!stepValid(0)} onClick={() => setStep(1)}>
                {tr("التالي")} <NextIcon size={15} />
              </button>
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
            {tr("باقة الأعمال")} · <span className="gx-num">$10</span> {tr("/ شركة / شهرياً")} · {tr("مجاني لأول 100 شركة")}
          </div>
        </div>
      </div>
    </div>
  );
}
