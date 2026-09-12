import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody, serializePurchaseInvoice, todayISODate } from "@/lib/serialize";

// GET /api/purchase-invoices?companySlug=
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const rows = await db.purchaseInvoice.findMany({
      where: companySlug ? { companySlug } : {},
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(rows.map(serializePurchaseInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/purchase-invoices
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);

    const created = await db.purchaseInvoice.create({
      data: {
        num: String(body.num || `PUR${Date.now()}`),
        date: String(body.date || todayISODate()),
        supplier: String(body.supplier || ""),
        companySlug: body.companySlug == null ? null : String(body.companySlug),
        items: JSON.stringify(Array.isArray(body.items) ? body.items : []),
        sourceInvoiceIds: JSON.stringify(
          Array.isArray(body.sourceInvoiceIds) ? body.sourceInvoiceIds : [],
        ),
        totalQty: Number(body.totalQty) || 0,
        notes: body.notes == null ? null : String(body.notes),
      },
    });

    return NextResponse.json(serializePurchaseInvoice(created), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
