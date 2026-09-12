import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { num, parseIdParam, readBody, serializeInvoice } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/invoices/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await db.invoice.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(serializeInvoice(row));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// PUT /api/invoices/[id] — partial update semantics (only provided fields)
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await readBody(req);
    const { lineItems, subtotal, taxRate, total, shipping, paid, ...rest } = body;

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // NOTE: the original Express route had `num(subtotal) ?? num(existing.subtotal)`
    // which never fell back because num() returns 0 for undefined. Fixed here with
    // explicit presence checks so partial updates keep existing values.
    const sub = subtotal !== undefined ? num(subtotal) : num(existing.subtotal);
    const ship = shipping !== undefined ? num(shipping) : num(existing.shipping);
    const tot = total !== undefined ? num(total) : sub + ship;
    const tRate = taxRate !== undefined ? num(taxRate) : num(existing.taxRate);
    const tAmount = sub * (tRate / 100);

    const updates: Prisma.InvoiceUpdateInput = {};

    if (rest.invoiceNumber != null) updates.invoiceNumber = String(rest.invoiceNumber);
    if (rest.companySlug !== undefined) {
      updates.companySlug = rest.companySlug == null ? null : String(rest.companySlug);
    }
    if (rest.clientName != null) updates.clientName = String(rest.clientName);
    if (rest.clientEmail !== undefined) {
      updates.clientEmail = rest.clientEmail == null ? null : String(rest.clientEmail);
    }
    if (rest.clientPhone !== undefined) {
      updates.clientPhone = rest.clientPhone == null ? null : String(rest.clientPhone);
    }
    if (rest.clientAddress !== undefined) {
      updates.clientAddress = rest.clientAddress == null ? null : String(rest.clientAddress);
    }
    if (rest.issueDate != null) updates.issueDate = String(rest.issueDate);
    if (rest.dueDate != null) updates.dueDate = String(rest.dueDate);
    if (rest.status != null) updates.status = String(rest.status);
    if (rest.notes !== undefined) {
      updates.notes = rest.notes == null ? null : String(rest.notes);
    }
    if (rest.source !== undefined) {
      updates.source = rest.source == null ? null : String(rest.source);
    }
    if (lineItems !== undefined) {
      updates.lineItems = JSON.stringify(Array.isArray(lineItems) ? lineItems : []);
    }
    if (subtotal !== undefined) updates.subtotal = sub;
    if (taxRate !== undefined) {
      updates.taxRate = tRate;
      updates.taxAmount = tAmount;
    }
    if (total !== undefined) updates.total = tot;
    if (shipping !== undefined) updates.shipping = ship;
    if (paid !== undefined) updates.paid = num(paid);

    const updated = await db.invoice.update({ where: { id }, data: updates });
    return NextResponse.json(serializeInvoice(updated));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/invoices/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.invoice.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
