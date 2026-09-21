import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody, serializePurchaseInvoice, todayISODate, ISO_DATE_RE } from "@/lib/serialize";
import { cacheWrap, cacheDelPattern } from "@/lib/cache";
import { getSessionScope, requireCompanyAccess, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

/**
 * r29 (S1/C3): فواتير المشتريات — تتطلب جلسة؛ الوصول محصور بشركات الجلسة
 * (المدير العام يرى الكل)، والنصوص محدودة الطول والتاريخ بصيغة ISO.
 */

// GET /api/purchase-invoices?companySlug= — (r10: كاش Valkey 30 ثانية)
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
    const rows = await cacheWrap(`purchases:v2:${scopeKey}`, 30, () =>
      db.purchaseInvoice.findMany({ where, orderBy: { createdAt: "desc" } }),
    );

    return NextResponse.json(rows.map(serializePurchaseInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/purchase-invoices
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const companySlug =
      body.companySlug == null ? null : String(body.companySlug).trim() || null;

    // r29 (S1): إنشاء فاتورة مشتريات داخل شركة تتطلب ملكيتها
    const denied = await requireCompanyAccess(req, companySlug);
    if (denied) return denied;

    const str = (v: unknown, max: number): string | null =>
      v == null ? null : String(v).trim().slice(0, max) || null;

    const dateRaw = str(body.date, 10) || todayISODate();
    if (!ISO_DATE_RE.test(dateRaw)) {
      return NextResponse.json({ error: "التاريخ يجب أن يكون بصيغة YYYY-MM-DD" }, { status: 400 });
    }
    const totalQty = Number(body.totalQty);
    if (!Number.isFinite(totalQty) || totalQty < 0) {
      return NextResponse.json({ error: "الكمية يجب أن تكون رقمًا غير سالب" }, { status: 400 });
    }
    if (Array.isArray(body.items) && body.items.length > 500) {
      return NextResponse.json({ error: "قائمة البنود كبيرة جداً (الحد 500)" }, { status: 400 });
    }

    const created = await db.purchaseInvoice.create({
      data: {
        num: str(body.num, 60) || `PUR${Date.now()}`,
        date: dateRaw,
        supplier: str(body.supplier, 200) || "",
        companySlug,
        items: JSON.stringify(Array.isArray(body.items) ? body.items.slice(0, 500) : []),
        sourceInvoiceIds: JSON.stringify(
          Array.isArray(body.sourceInvoiceIds) ? body.sourceInvoiceIds.slice(0, 500) : [],
        ),
        totalQty: Math.round(totalQty),
        notes: str(body.notes, 5000),
      },
    });

    await cacheDelPattern("purchases:*");
    return NextResponse.json(serializePurchaseInvoice(created), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
