import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeInvoice } from "@/lib/serialize";
import { cacheWrap } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

// GET /api/dashboard/recent-invoices?companySlug= — first 10, newest first
// (r10: كاش Valkey 30 ثانية)
// r29 (S1): تتطلب جلسة؛ شركة محددة يجب أن تكون ضمن شركات الجلسة، وبلا شركة
// يرى المدير الكل ويرى المشترك/الموظف شركاتهم فقط.
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

    const invoices = await cacheWrap(`recent:v2:${scopeKey}`, 30, () =>
      db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
    );

    return NextResponse.json(invoices.map(serializeInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
