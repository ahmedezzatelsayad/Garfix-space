import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseIdParam } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

// DELETE /api/purchase-invoices/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await db.purchaseInvoice.deleteMany({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
