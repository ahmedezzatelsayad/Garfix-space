import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listPlans } from "@/lib/plans";
import { ARAB_COUNTRIES, resolvePricingGeo, convertAndFormat } from "@/lib/geo";
import { FREE_SUBSCRIBER_LIMIT } from "@/lib/plans";

/**
 * r17: صفحة الأسعار العامة — الخطط بالدولار + تحويل لعملة بلد الزائر حسب الـ IP.
 *
 * GET /api/pricing                  → بلد الزائر مكتشفاً تلقائياً
 * GET /api/pricing?country=SA       → تجاوز صريح من منتقي الدول (عربي فقط)
 *
 * الرد: { plans: [{ …, priceLocal }], geo: {…}, countries: [22], freeSeats: {…} }
 * عام بلا جلسة — يغذّي صفحة #/pricing العامة وتبويب «حسابي».
 */
export async function GET(req: NextRequest) {
  try {
    const override = req.nextUrl.searchParams.get("country");
    const [plans, geo, registered] = await Promise.all([
      listPlans(false),
      resolvePricingGeo(req, override),
      db.appUser.count().catch(() => 0),
    ]);

    const plansWithLocal = plans.map((p) => {
      const loc = convertAndFormat(p.priceUsd, geo);
      return { ...p, priceLocal: { amount: loc.amount, formatted: loc.formatted, currency: loc.currency } };
    });

    return NextResponse.json({
      plans: plansWithLocal,
      geo: {
        country: geo.country ? geo.country.code : null,
        countryNameAr: geo.country ? geo.country.nameAr : null,
        currency: geo.currency,
        currencyAr: geo.currencyAr,
        flag: geo.flag,
        rate: geo.rate,
        rateSource: geo.rateSource,
        detected: geo.detected,
      },
      countries: ARAB_COUNTRIES.map((c) => ({
        code: c.code,
        nameAr: c.nameAr,
        currency: c.currency,
        currencyAr: c.currencyAr,
        flag: c.flag,
        dial: c.dial,
      })),
      freeSeats: {
        registered,
        limit: FREE_SUBSCRIBER_LIMIT,
        remaining: Math.max(0, FREE_SUBSCRIBER_LIMIT - registered),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
