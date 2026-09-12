import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { num, parseIdParam, readBody, serializeInvoice } from "@/lib/serialize";
import { invalidateClients } from "@/lib/cache";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/clients/[id] — client + invoice summary
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const clientInvoices = await db.invoice.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    });

    const totalRevenue = clientInvoices.reduce((s, inv) => s + num(inv.total), 0);

    return NextResponse.json({
      ...client,
      totalInvoices: clientInvoices.length,
      totalRevenue,
      invoices: clientInvoices.map(serializeInvoice),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// PUT /api/clients/[id] — partial update
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await readBody(req);
    const updates: Prisma.ClientUpdateInput = {};

    if (body.name != null) updates.name = String(body.name);
    if (body.email !== undefined) {
      updates.email = body.email == null ? null : String(body.email);
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone == null ? null : String(body.phone);
    }
    if (body.company !== undefined) {
      updates.company = body.company == null ? null : String(body.company);
    }
    if (body.address !== undefined) {
      updates.address = body.address == null ? null : String(body.address);
    }

    const updated = await db.client.update({ where: { id }, data: updates });
    await invalidateClients();
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.client.delete({ where: { id } });
    await invalidateClients();
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
