import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIdParam, readBody, serializeInvoice } from "@/lib/serialize";
import { invalidateInvoices } from "@/lib/cache";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/invoices/[id]/status — body: { status }
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
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

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.invoice.update({
      where: { id },
      data: { status: String(status) },
    });

    await invalidateInvoices(updated.companySlug ?? undefined);
    return NextResponse.json(serializeInvoice(updated));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
