import type { NextRequest } from "next/server";
import { cacheWrap } from "@/lib/cache";
import { WORLD_BY_CODE, WORLD_COUNTRIES, worldCountryOf, type WorldCountry } from "@/lib/countries-world";

/**
 * r17+r18: التسعير العالمي بالدولار + التحويل لعملة بلد الزائر حسب الـ IP + الضرائب لكل دولة.
 *
 * - ١٩٥ دولة بعملاتها (countries-world.ts) — أسعار الصرف من open.er-api.com
 *   (مجاني بلا مفتاح، ~١٦٠ عملة، تحديث يومي) مع كاش Valkey ٦ ساعات + أرقام احتياطية.
 * - تحديد البلد من الـ IP: ترويسات CDN أولاً ثم ip-api.com (كاش ساعة لكل IP) — افتراضي الكويت.
 * - ضريبة القيمة المضافة القياسية لكل دولة (vat) — اختيارية تماماً عند الفوترة
 *   (تفعيل ونسبة افتراضية من إعدادات الشركة، وتعديل لكل فاتورة).
 */

export { worldCountryOf, WORLD_BY_CODE, WORLD_COUNTRIES };
export type { WorldCountry };

// ── علم الدولة من رمزها (رموز المؤشرات الإقليمية) ──
export function flagOf(code: string | null | undefined): string {
  const c = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌍";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// ── منازل العرض لكل عملة (0 / 2 / 3) ──
const ZERO_DECIMALS = new Set([
  "JPY", "KRW", "VND", "CLP", "DJF", "KMF", "XOF", "XAF", "XPF", "GNF", "RWF", "UGX", "VUV",
]);
const THREE_DECIMALS = new Set(["KWD", "BHD", "OMR", "JOD", "IQD", "TND", "LYD"]);

function decimalsOf(currency: string): number {
  const c = currency.toUpperCase();
  if (c === "MRU" || c === "MGA") return 1; // الأوقية والأرياري بأنصف وحدات
  if (ZERO_DECIMALS.has(c)) return 0;
  if (THREE_DECIMALS.has(c)) return 3;
  return 2;
}

// ── أسعار الصرف الاحتياطية (USD → عملة) عند تعطل المصدر الخارجي ──
// أرقام تقريبية — تُستخدم فقط كي لا تتعطل واجهة التسعير.
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 152, CNY: 7.24, CHF: 0.88, CAD: 1.37, AUD: 1.52,
  INR: 84, TRY: 34.5, BRL: 5.5, RUB: 92, KRW: 1380, IDR: 15800, MXN: 18.5, ZAR: 17.8,
  SGD: 1.34, NZD: 1.66, HKD: 7.79, SEK: 10.7, NOK: 10.9, DKK: 6.9, PLN: 4.05, CZK: 23.2,
  HUF: 365, ILS: 3.72, PHP: 58.5, MYR: 4.7, THB: 34.5, VND: 25400, AED: 3.6725, SAR: 3.75,
  QAR: 3.64, KWD: 0.307, BHD: 0.376, OMR: 0.3845, EGP: 48.2, JOD: 0.709, IQD: 1310,
  MAD: 9.9, TND: 3.12, DZD: 134, LYD: 5.42, SDG: 601, YER: 830, SYP: 13000, LBP: 89500,
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
    ip.startsWith("172.") && (() => { const n = parseInt(ip.split(".")[1] || "0", 10); return n >= 16 && n <= 31; })() ||
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
      if (data.status === "success" && data.countryCode) {
        const code = data.countryCode.toUpperCase();
        ipCountryCache.set(ip, { code, at: Date.now() });
        return code; // قد يكون أي دولة في العالم (أو غير معروفة لدينا → null عند الاستخدام)
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
  country: WorldCountry | null; // null = غير معروف (عرض بالدولار)
  countryCode: string | null;
  currency: string;
  currencyAr: string | null;
  flag: string;
  decimals: number;
  rate: number; // USD → currency
  rateSource: "live" | "fallback";
  detected: "header" | "ip" | "default" | "override" | "unknown";
  vat: number; // نسبة الضريبة القياسية للبلد (%)
}

/** كشف بلد الطلب (ترويسة → IP) دون أسعار — يستعمله التسجيل لحفظ بلد المشترك */
export async function detectCountry(req: NextRequest): Promise<{ code: string; how: "header" | "ip" | "default" }> {
  const h =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code");
  if (h && WORLD_BY_CODE[h.toUpperCase()]) return { code: h.toUpperCase(), how: "header" };
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "local") || "local";
  if (!isPrivateIp(ip)) {
    const looked = await lookupIpCountry(ip);
    if (looked && WORLD_BY_CODE[looked]) return { code: looked, how: "ip" };
    if (looked) return { code: looked, how: "ip" }; // بلد معروف للشبكة لكن ليس في جدولنا
  }
  return { code: "KW", how: "default" };
}

/**
 * سياق التسعير للطلب: بلد الزائر (ترويسة → IP → الكويت افتراضياً) + سعر الصرف + الضريبة.
 * `override` (اختياري): كود بلد من منتقي الدول في الواجهة (أي بلد في العالم).
 */
export async function resolvePricingGeo(req: NextRequest, override?: string | null): Promise<PricingGeo> {
  let code: string | null = null;
  let detected: PricingGeo["detected"] = "default";

  // 0) تجاوز صريح من منتقي الدول
  if (override && WORLD_BY_CODE[override.toUpperCase()]) {
    code = override.toUpperCase();
    detected = "override";
  }

  // 1) ترويسات CDN/بوابة (أسرع وأدق)
  if (!code) {
    const h =
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("x-country-code");
    if (h) {
      const up = h.toUpperCase();
      if (WORLD_BY_CODE[up]) {
        code = up;
        detected = "header";
      } else {
        code = "USD";
        detected = "unknown";
      }
    }
  }

  // 2) خدمة IP عامة
  if (!code) {
    const fwd = req.headers.get("x-forwarded-for");
    const ip = (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "local") || "local";
    if (!isPrivateIp(ip)) {
      const looked = await lookupIpCountry(ip);
      if (looked) {
        if (WORLD_BY_CODE[looked]) {
          code = looked;
          detected = "ip";
        } else {
          code = "USD";
          detected = "unknown";
        }
      }
    }
  }

  const rates = await getUsdRates();
  if (code === "USD") {
    return {
      country: null, countryCode: null, currency: "USD", currencyAr: "دولار أمريكي",
      flag: "🌍", decimals: 2, rate: 1, rateSource: rates.source, detected, vat: 0,
    };
  }

  // 3) الافتراضي: الكويت (السوق الأساسي للمنتج)
  const country = code ? worldCountryOf(code) : null;
  const c = country ?? worldCountryOf("KW")!;
  const rate = rates.rates[c.currency] ?? FALLBACK_USD_RATES[c.currency] ?? 1;
  return {
    country: c,
    countryCode: c.code,
    currency: c.currency,
    currencyAr: null,
    flag: flagOf(c.code),
    decimals: decimalsOf(c.currency),
    rate,
    rateSource: rates.source,
    detected,
    vat: c.vat,
  };
}

/** تحويل سعر دولار وتنسيقه بعملة البلد — "٥٧٫٠٠ SAR" أو "٣٩٩٠ IQD" */
export function convertAndFormat(usd: number, geo: PricingGeo): { amount: number; formatted: string; currency: string } {
  const amount = usd * geo.rate;
  const rounded = geo.decimals === 0 ? Math.round(amount) : Number(amount.toFixed(geo.decimals));
  const shown = geo.decimals === 0 ? String(rounded) : rounded.toFixed(geo.decimals);
  return { amount: rounded, formatted: `${shown} ${geo.currency}`, currency: geo.currency };
}

/** الضريبة القياسية لبلد ما (0 إذا غير معروفة) — للاقتراح في إعدادات الشركة */
export function vatOf(code: string | null | undefined): number {
  return worldCountryOf(code)?.vat ?? 0;
}
