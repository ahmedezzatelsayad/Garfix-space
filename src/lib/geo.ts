import type { NextRequest } from "next/server";
import { cacheWrap } from "@/lib/cache";

/**
 * r17: التسعير العالمي بالدولار + التحويل لعملة بلد الزائر حسب الـ IP.
 *
 * - 22 دولة عربية بعملاتها وأعلامها وأرقامها الدولية.
 * - أسعار الصرف مقابل USD من open.er-api.com (مجاني بلا مفتاح، تحديث يومي)
 *   مع كاش Valkey 6 ساعات + أرقام احتياطية ثابتة عند تعطل الشبكة.
 * - تحديد البلد من الـ IP: ترويسات CDN أولاً (cf-ipcountry / x-vercel-ip-country)
 *   ثم ip-api.com للـ IP العام (كاش ساعة لكل IP) — والافتراضي الكويت.
 */

// ── جدول الدول العربية (22 دولة) ──
export interface ArabCountry {
  code: string; // ISO-3166 alpha-2
  nameAr: string;
  currency: string; // ISO-4217
  currencyAr: string;
  flag: string;
  dial: string;
  decimals: number; // منازل عرض الأسعار بعملة البلد
}

export const ARAB_COUNTRIES: ArabCountry[] = [
  { code: "KW", nameAr: "الكويت",     currency: "KWD", currencyAr: "دينار كويتي",    flag: "🇰🇼", dial: "+965",  decimals: 3 },
  { code: "SA", nameAr: "السعودية",   currency: "SAR", currencyAr: "ريال سعودي",     flag: "🇸🇦", dial: "+966",  decimals: 2 },
  { code: "AE", nameAr: "الإمارات",    currency: "AED", currencyAr: "درهم إماراتي",   flag: "🇦🇪", dial: "+971",  decimals: 2 },
  { code: "QA", nameAr: "قطر",        currency: "QAR", currencyAr: "ريال قطري",      flag: "🇶🇦", dial: "+974",  decimals: 2 },
  { code: "BH", nameAr: "البحرين",    currency: "BHD", currencyAr: "دينار بحريني",   flag: "🇧🇭", dial: "+973",  decimals: 3 },
  { code: "OM", nameAr: "عُمان",      currency: "OMR", currencyAr: "ريال عماني",     flag: "🇴🇲", dial: "+968",  decimals: 3 },
  { code: "IQ", nameAr: "العراق",     currency: "IQD", currencyAr: "دينار عراقي",    flag: "🇮🇶", dial: "+964",  decimals: 0 },
  { code: "JO", nameAr: "الأردن",     currency: "JOD", currencyAr: "دينار أردني",    flag: "🇯🇴", dial: "+962",  decimals: 2 },
  { code: "LB", nameAr: "لبنان",      currency: "LBP", currencyAr: "ليرة لبنانية",   flag: "🇱🇧", dial: "+961",  decimals: 0 },
  { code: "SY", nameAr: "سوريا",      currency: "SYP", currencyAr: "ليرة سورية",     flag: "🇸🇾", dial: "+963",  decimals: 0 },
  { code: "YE", nameAr: "اليمن",      currency: "YER", currencyAr: "ريال يمني",      flag: "🇾🇪", dial: "+967",  decimals: 0 },
  { code: "EG", nameAr: "مصر",        currency: "EGP", currencyAr: "جنيه مصري",      flag: "🇪🇬", dial: "+20",   decimals: 2 },
  { code: "LY", nameAr: "ليبيا",      currency: "LYD", currencyAr: "دينار ليبي",     flag: "🇱🇾", dial: "+218",  decimals: 2 },
  { code: "TN", nameAr: "تونس",       currency: "TND", currencyAr: "دينار تونسي",    flag: "🇹🇳", dial: "+216",  decimals: 2 },
  { code: "DZ", nameAr: "الجزائر",    currency: "DZD", currencyAr: "دينار جزائري",   flag: "🇩🇿", dial: "+213",  decimals: 0 },
  { code: "MA", nameAr: "المغرب",     currency: "MAD", currencyAr: "درهم مغربي",     flag: "🇲🇦", dial: "+212",  decimals: 2 },
  { code: "MR", nameAr: "موريتانيا",  currency: "MRU", currencyAr: "أوقية موريتانية", flag: "🇲🇷", dial: "+222",  decimals: 0 },
  { code: "SD", nameAr: "السودان",    currency: "SDG", currencyAr: "جنيه سوداني",    flag: "🇸🇩", dial: "+249",  decimals: 0 },
  { code: "SO", nameAr: "الصومال",    currency: "SOS", currencyAr: "شلن صومالي",     flag: "🇸🇴", dial: "+252",  decimals: 0 },
  { code: "DJ", nameAr: "جيبوتي",     currency: "DJF", currencyAr: "فرنك جيبوتي",    flag: "🇩🇯", dial: "+253",  decimals: 0 },
  { code: "KM", nameAr: "جزر القمر",  currency: "KMF", currencyAr: "فرنك قمري",      flag: "🇰🇲", dial: "+269",  decimals: 0 },
  { code: "PS", nameAr: "فلسطين",     currency: "ILS", currencyAr: "شيكل",           flag: "🇵🇸", dial: "+970",  decimals: 2 },
];

const BY_CODE = new Map(ARAB_COUNTRIES.map((c) => [c.code, c]));
export const DEFAULT_COUNTRY = BY_CODE.get("KW")!;

export function countryOf(code: string | null | undefined): ArabCountry {
  return BY_CODE.get(String(code || "").toUpperCase()) || DEFAULT_COUNTRY;
}

export function isArabCountry(code: string | null | undefined): boolean {
  return BY_CODE.has(String(code || "").toUpperCase());
}

// ── أسعار الصرف الاحتياطية (USD → عملة) عند تعطل المصدر الخارجي ──
// أرقام تقريبية محدّثة — تُستخدم فقط كي لا تتعطل واجهة التسعير.
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, KWD: 0.307, SAR: 3.75, AED: 3.6725, QAR: 3.64, BHD: 0.376, OMR: 0.3845,
  IQD: 1310, JOD: 0.709, LBP: 89500, SYP: 13000, YER: 830, EGP: 48.2, LYD: 5.42,
  TND: 3.12, DZD: 134, MAD: 9.9, MRU: 39.8, SDG: 601, SOS: 571, DJF: 177.7,
  KMF: 457, ILS: 3.65,
};

export interface UsdRates {
  rates: Record<string, number>;
  source: "live" | "fallback";
  fetchedAt: string;
}

const RATES_TTL_SEC = 6 * 3600; // 6 ساعات (المصدر يحدّث يومياً)
const RATES_URL = "https://open.er-api.com/v6/latest/USD";

/** أسعار USD الحية عبر Valkey-cache مع سقوط احتياطي ثابت */
export async function getUsdRates(): Promise<UsdRates> {
  try {
    return await cacheWrap<UsdRates>("rates:usd:v1", RATES_TTL_SEC, async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(RATES_URL, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`er-api ${res.status}`);
        const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
        if (data.result !== "success" || !data.rates || typeof data.rates.KWD !== "number") {
          throw new Error("bad payload");
        }
        return { rates: data.rates, source: "live", fetchedAt: new Date().toISOString() };
      } finally {
        clearTimeout(t);
      }
    });
  } catch {
    return { rates: FALLBACK_USD_RATES, source: "fallback", fetchedAt: new Date().toISOString() };
  }
}

// ── تحديد بلد الزائر من الـ IP ──
const ipCountryCache = new Map<string, { code: string; at: number }>(); // كاش ساعة
const IP_TTL_MS = 3600_000;

function isPrivateIp(ip: string): boolean {
  return (
    ip === "local" ||
    ip === "" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("::1") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80")
  );
}

async function lookupIpCountry(ip: string): Promise<string | null> {
  const cached = ipCountryCache.get(ip);
  if (cached && Date.now() - cached.at < IP_TTL_MS) return cached.code;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      const data = (await res.json()) as { status?: string; countryCode?: string };
      if (data.status === "success" && data.countryCode && isArabCountry(data.countryCode)) {
        ipCountryCache.set(ip, { code: data.countryCode, at: Date.now() });
        return data.countryCode;
      }
      if (data.status === "success" && data.countryCode) {
        // زائر من خارج الدول العربية → نعرض الدولار نفسه مع ذكر بلده
        ipCountryCache.set(ip, { code: "USD", at: Date.now() });
        return "USD";
      }
    } finally {
      clearTimeout(t);
    }
  } catch {
    /* انتهت المهلة أو تعطلت الخدمة — افتراضي */
  }
  return null;
}

export interface PricingGeo {
  country: ArabCountry | null; // null = زائر من خارج الدول العربية (عرض بالدولار)
  currency: string;
  currencyAr: string;
  flag: string;
  decimals: number;
  rate: number; // USD → currency
  rateSource: "live" | "fallback";
  detected: "header" | "ip" | "default" | "override" | "outside";
  visitorCountryName: string | null; // اسم بلد الزائر إن كان خارج الدول العربية
}

/**
 * سياق التسعير للطلب: بلد الزائر (ترويسة → IP → الكويت افتراضياً) + سعر الصرف.
 * `override` (اختياري): كود بلد عربي من منتقي الدول في الواجهة.
 */
export async function resolvePricingGeo(req: NextRequest, override?: string | null): Promise<PricingGeo> {
  let code: string | null = null;
  let detected: PricingGeo["detected"] = "default";

  // 0) تجاوز صريح من منتقي الدول (عربي فقط)
  if (override && isArabCountry(override)) {
    code = override.toUpperCase();
    detected = "override";
  }

  // 1) ترويسات CDN/بوابة (أسرع وأدق)
  if (!code) {
    const h =
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-country-code");
    if (h && isArabCountry(h)) {
      code = h.toUpperCase();
      detected = "header";
    } else if (h) {
      code = "USD";
      detected = "outside";
    }
  }

  // 2) خدمة IP عامة
  if (!code) {
    const fwd = req.headers.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "local") || "local";
    if (!isPrivateIp(ip)) {
      const looked = await lookupIpCountry(ip);
      if (looked && isArabCountry(looked)) {
        code = looked;
        detected = "ip";
      } else if (looked === "USD") {
        code = "USD";
        detected = "outside";
      }
    }
  }

  // 3) الافتراضي: الكويت (السوق الأساسي للمنتج)
  if (!code) code = "KW";

  const rates = await getUsdRates();
  if (code === "USD") {
    return {
      country: null,
      currency: "USD",
      currencyAr: "دولار أمريكي",
      flag: "🌍",
      decimals: 2,
      rate: 1,
      rateSource: rates.source,
      detected,
      visitorCountryName: null,
    };
  }
  const c = countryOf(code);
  const rate = rates.rates[c.currency] ?? FALLBACK_USD_RATES[c.currency] ?? 1;
  return {
    country: c,
    currency: c.currency,
    currencyAr: c.currencyAr,
    flag: c.flag,
    decimals: c.decimals,
    rate,
    rateSource: rates.source,
    detected,
    visitorCountryName: null,
  };
}

/** تحويل سعر دولار وتنسيقه بعملة البلد — "٥٧٫٠٠ ر.س" أو "٣٩٩٠ د.ع" */
export function convertAndFormat(usd: number, geo: PricingGeo): { amount: number; formatted: string; currency: string } {
  const amount = usd * geo.rate;
  const rounded = geo.decimals === 0 ? Math.round(amount) : Number(amount.toFixed(geo.decimals));
  const shown = geo.decimals === 0 ? String(rounded) : rounded.toFixed(geo.decimals);
  return { amount: rounded, formatted: `${shown} ${geo.currency}`, currency: geo.currency };
}
