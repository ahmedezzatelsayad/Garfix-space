import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { num } from "@/lib/serialize";
import { cacheWrap } from "@/lib/cache";

// GET /api/dashboard/revenue-by-month?companySlug=
// Groups invoices by issueDate "YYYY-MM"; revenue = subtotal + shipping.
// Returns entries sorted ascending, limited to the last 12 months present.
// (r10: كاش Valkey 60 ثانية)
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const result = await cacheWrap(`rev:${companySlug ?? "all"}`, 60, async () => {
      const invoices = await db.invoice.findMany({
        where: companySlug ? { companySlug } : {},
        orderBy: { createdAt: "desc" },
      });

      const monthMap: Record<string, { revenue: number; count: number }> = {};
      for (const inv of invoices) {
        const date = inv.issueDate || inv.createdAt.toISOString() || "";
        const month = date.substring(0, 7);
        if (!month) continue;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, count: 0 };
        monthMap[month].revenue += num(inv.subtotal) + num(inv.shipping);
        monthMap[month].count++;
      }

      return Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          invoiceCount: data.count,
        }));
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
