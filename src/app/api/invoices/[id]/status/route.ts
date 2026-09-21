import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIdParam, readBody, serializeInvoice, INVOICE_STATUSES } from "@/lib/serialize";
import { invalidateInvoices } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/invoices/[id]/status — body: { status }
// r29 (S1/M13): جلسة + ملكية شركة الفاتورة + حالة من enum معروف فقط
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await readBody(req);
    const { status } = body;
    if (status == null) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    const st = String(status);
    if (!(INVOICE_STATUSES as readonly string[]).includes(st)) {
      return NextResponse.json(
        { error: "حالة الفاتورة غير صالحة", code: "INVALID_STATUS" },
        { status: 400 },
      );
    }

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!scope.all && (!existing.companySlug || !scope.slugs.includes(existing.companySlug))) {
      return forbiddenCompanyResponse();
    }

    const updated = await db.invoice.update({
      where: { id },
      data: { status: st },
    });

    await invalidateInvoices(updated.companySlug ?? undefined);
    return NextResponse.json(serializeInvoice(updated));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
