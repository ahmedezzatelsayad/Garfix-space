import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { num, readBody, serializeInvoice, todayISODate } from "@/lib/serialize";
import { cacheWrap, invalidateInvoices } from "@/lib/cache";

// GET /api/invoices?companySlug=&status=&search= — (r10: كاش Valkey 15 ثانية)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const companySlug = searchParams.get("companySlug") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const rows = await cacheWrap(`invoices:${companySlug ?? "all"}:${status ?? ""}:${search ?? ""}`, 15, () =>
      db.invoice.findMany({
        where: {
          ...(companySlug ? { companySlug } : {}),
          ...(status ? { status } : {}),
          ...(search ? { clientName: { contains: search } } : {}),
        } as Prisma.InvoiceWhereInput,
        orderBy: { createdAt: "desc" },
      }),
    );

    return NextResponse.json(rows.map(serializeInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/invoices
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const { lineItems, subtotal, taxRate, total, shipping, paid, ...rest } = body;

    const items: Record<string, unknown>[] = Array.isArray(lineItems)
      ? (lineItems as Record<string, unknown>[])
      : [];

    const sub =
      num(subtotal) ||
      items.reduce((s, it) => s + num(it?.qty) * num(it?.price), 0) ||
      0;
    const ship = num(shipping);
    const tot = num(total) || sub + ship;
    const tRate = num(taxRate);
    const tAmount = sub * (tRate / 100);

    const created = await db.invoice.create({
      data: {
        invoiceNumber: String(rest.invoiceNumber || `INV${Date.now()}`),
        companySlug: rest.companySlug == null ? null : String(rest.companySlug),
        clientName: String(rest.clientName || "عميل"),
        clientEmail: rest.clientEmail == null ? null : String(rest.clientEmail),
        clientPhone: rest.clientPhone == null ? null : String(rest.clientPhone),
        clientAddress: rest.clientAddress == null ? null : String(rest.clientAddress),
        issueDate: String(rest.issueDate || todayISODate()),
        dueDate: String(rest.dueDate || todayISODate()),
        status: String(rest.status || "draft"),
        lineItems: JSON.stringify(items),
        subtotal: sub,
        taxRate: tRate,
        taxAmount: tAmount,
        total: tot,
        shipping: ship,
        paid: num(paid),
        notes: rest.notes == null ? null : String(rest.notes),
        source: rest.source == null ? null : String(rest.source),
      },
    });

    await invalidateInvoices(created.companySlug ?? undefined);
    return NextResponse.json(serializeInvoice(created), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
