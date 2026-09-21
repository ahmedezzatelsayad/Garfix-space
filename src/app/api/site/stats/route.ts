import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

/**
 * GET /api/site/stats — إحصاءات عامة لصفحة الموقع الرئيسية (أرقام مجمّعة فقط،
 * لا بيانات عملاء ولا مبالغ — آمنة للعرض العام).
 * r29 (S2): أُضيف publicCompanies (slug/الاسم/الاسم العربي/العملة/الشعار فقط —
 * بلا هاتف/بريد/عنوان/مدير) لعرض شريط «شركات تعمل على GarfiX» في الموقع العام
 * بعد أن صار /api/companies يتطلب جلسة.
 */
export async function GET() {
  try {
    const stats = await cacheWrap("site:stats", 30, async () => {
      const [companies, invoices, clients, currencies, companyRows] = await Promise.all([
        db.company.count(),
        db.invoice.count(),
        db.client.count(),
        db.company.findMany({ select: { currency: true } }),
        db.company.findMany({ orderBy: { id: "asc" } }),
      ]);
      return {
        companies,
        invoices,
        clients,
        currencies: new Set(currencies.map((c) => c.currency || "KWD")).size,
        publicCompanies: companyRows.map((c) => ({
          slug: c.slug,
          name: c.name,
          nameAr: c.nameAr,
          currency: c.currency || "KWD",
          emoji: c.emoji || "🏢",
        })),
      };
    });
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
