import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIdParam } from "@/lib/serialize";
import { cacheDelPattern } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/purchase-invoices/[id]
// r29 (S1/M9): تتطلب جلسة + ملكية شركة فاتورة المشتريات، وتُبطل كاش القائمة
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.purchaseInvoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!scope.all && (!existing.companySlug || !scope.slugs.includes(existing.companySlug))) {
      return forbiddenCompanyResponse();
    }

    await db.purchaseInvoice.delete({ where: { id } });
    await cacheDelPattern("purchases:*"); // r29 (M9): كان يتخطى الإبطال
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
