import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

/**
 * GET /api/site/stats — إحصاءات عامة لصفحة الموقع الرئيسية (أرقام مجمّعة فقط،
 * لا بيانات عملاء ولا مبالغ — آمنة للعرض العام).
 */
export async function GET() {
  try {
    const stats = await cacheWrap("site:stats", 30, async () => {
      const [companies, invoices, clients, currencies] = await Promise.all([
        db.company.count(),
        db.invoice.count(),
        db.client.count(),
        db.company.findMany({ select: { currency: true } }),
      ]);
      return {
        companies,
        invoices,
        clients,
        currencies: new Set(currencies.map((c) => c.currency || "KWD")).size,
      };
    });
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
