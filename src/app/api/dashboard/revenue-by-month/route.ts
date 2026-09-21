import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoiceTotal } from "@/lib/serialize";
import { cacheWrap } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

// GET /api/dashboard/revenue-by-month?companySlug=
// Groups invoices by issueDate "YYYY-MM"; revenue = subtotal + taxAmount + shipping
// (r29/C1: كانت الضريبة مُغفّلة هنا بينما مسار المدفوعات يحسبها).
// Returns entries sorted ascending, limited to the last 12 months present.
// (r10: كاش Valkey 60 ثانية · r29/S1: جلسة + عزل شركات الجلسة)
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const companySlug = req.nextUrl.searchParams.get("companySlug")?.trim() || undefined;
    if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
      return forbiddenCompanyResponse();
    }

    const where = companySlug
      ? { companySlug }
      : scope.all
        ? {}
        : { companySlug: { in: scope.slugs } };
    const scopeKey = companySlug || (scope.all ? "all" : scope.slugs.join("+"));

    const result = await cacheWrap(`rev:v2:${scopeKey}`, 60, async () => {
      const invoices = await db.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      const monthMap: Record<string, { revenue: number; count: number }> = {};
      for (const inv of invoices) {
        const date = inv.issueDate || inv.createdAt.toISOString() || "";
        const month = date.substring(0, 7);
        if (!month) continue;
        if (!monthMap[month]) monthMap[month] = { revenue: 0, count: 0 };
        monthMap[month].revenue += invoiceTotal(inv);
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
