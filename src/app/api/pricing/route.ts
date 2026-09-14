import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listPlans, FREE_SUBSCRIBER_LIMIT } from "@/lib/plans";
import { WORLD_COUNTRIES, flagOf, resolvePricingGeo, convertAndFormat, type Region } from "@/lib/geo";

/**
 * r17+r18: صفحة الأسعار العامة — الخطط بالدولار + تحويل لعملة بلد الزائر حسب الـ IP
 * + عملات كل دول العالم (١٩٦ دولة) + الضريبة القياسية لكل بلد (اختيارية عند الفوترة).
 *
 * GET /api/pricing                  → بلد الزائر مكتشفاً تلقائياً
 * GET /api/pricing?country=SA       → تجاوز صريح من منتقي الدول (أي بلد في العالم)
 *
 * الرد: { plans: [{ …, priceLocal }], geo: {…, vat}, countries: [196], freeSeats }
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
        countryNameEn: geo.country ? geo.country.nameEn : null,
        currency: geo.currency,
        flag: geo.flag,
        rate: geo.rate,
        rateSource: geo.rateSource,
        detected: geo.detected,
        vat: geo.vat, // r18: الضريبة القياسية لبلد الزائر (اختيارية عند الفوترة)
      },
      countries: WORLD_COUNTRIES.map((c) => ({
        code: c.code,
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        currency: c.currency,
        region: c.region as Region,
        vat: c.vat,
        arabic: c.arabic,
        flag: flagOf(c.code),
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
