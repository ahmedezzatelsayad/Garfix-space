import { NextRequest, NextResponse } from "next/server";
import type { Payment } from "@prisma/client";
import { db } from "@/lib/db";
import { num, parseIdParam, readBody, todayISODate } from "@/lib/serialize";

type RouteContext = { params: Promise<{ id: string }> };

/** Error thrown inside a transaction that maps to a specific HTTP status. */
class PaymentRouteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function serializePayment(p: Payment) {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: num(p.amount),
    method: p.method,
    date: p.date,
    note: p.note,
    createdAt: p.createdAt,
  };
}

// GET /api/invoices/[id]/payments — list payments for an invoice, date desc
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db.payment.findMany({
      where: { invoiceId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(rows.map(serializePayment));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// POST /api/invoices/[id]/payments — record a payment and bump invoice.paid
// atomically. The paid amount may never exceed the invoice total
// (subtotal + taxAmount + shipping); the invoice `status` field is left
// untouched (the frontend derives display status from paid vs total).
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await readBody(req);
    const amount = num(body.amount);
    const method = String(body.method || "knet"); // cash | knet | online | card
    const date = String(body.date || todayISODate());
    const note = body.note == null ? null : String(body.note);

    if (!(amount > 0)) {
      return NextResponse.json(
        { error: "المبلغ يجب أن يكون أكبر من صفر" },
        { status: 400 },
      );
    }

    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) {
        throw new PaymentRouteError(404, "Not found");
      }

      const invoiceTotal =
        num(invoice.subtotal) + num(invoice.taxAmount) + num(invoice.shipping);
      const currentPaid = num(invoice.paid);
      if (currentPaid + amount > invoiceTotal) {
        throw new PaymentRouteError(400, "المبلغ يتجاوز المتبقي على الفاتورة");
      }

      const payment = await tx.payment.create({
        data: { invoiceId: id, amount, method, date, note },
      });

      await tx.invoice.update({
        where: { id },
        data: { paid: currentPaid + amount },
      });

      return payment;
    });

    return NextResponse.json(serializePayment(created), { status: 201 });
  } catch (err) {
    if (err instanceof PaymentRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
