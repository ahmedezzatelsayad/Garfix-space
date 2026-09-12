import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseIdParam, readBody, serializeCatalogItem } from "@/lib/serialize";
import { invalidateCatalog } from "@/lib/cache";

type RouteContext = { params: Promise<{ id: string }> };

// PUT /api/catalog/[id] — partial update (only provided fields)
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.productCatalog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await readBody(req);
    const updates: Prisma.ProductCatalogUpdateInput = {};

    if (body.name) updates.name = String(body.name).trim();
    if (Array.isArray(body.aliases)) updates.aliases = JSON.stringify(body.aliases);
    if (body.purchasePrice != null) updates.purchasePrice = Number(body.purchasePrice);
    if (body.sellingPrice != null) updates.sellingPrice = Number(body.sellingPrice);

    const updated = await db.productCatalog.update({ where: { id }, data: updates });
    await invalidateCatalog(updated.companySlug ?? undefined);
    return NextResponse.json(serializeCatalogItem(updated));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/catalog/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await db.productCatalog.deleteMany({ where: { id } });
    await invalidateCatalog(undefined);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
