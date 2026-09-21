import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseIdParam, readBody, serializeCatalogItem } from "@/lib/serialize";
import { invalidateCatalog } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * r29 (S1): صنف كتالوج بمفرده — تتطلب جلسة؛ الصنف يجب أن يتبع إحدى شركات
 * الجلسة (المدير العام يجتاز دائماً).
 */
function itemInScope(item: { companySlug: string | null }, scope: { all: boolean; slugs: string[] }): boolean {
  if (scope.all) return true;
  return !!item.companySlug && scope.slugs.includes(item.companySlug);
}

// PUT /api/catalog/[id] — partial update (only provided fields)
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.productCatalog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!itemInScope(existing, scope)) return forbiddenCompanyResponse();

    const body = await readBody(req);
    const updates: Prisma.ProductCatalogUpdateInput = {};

    if (body.name != null) {
      const name = String(body.name).trim().slice(0, 300);
      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
      updates.name = name;
    }
    if (Array.isArray(body.aliases)) {
      updates.aliases = JSON.stringify(
        body.aliases
          .filter((a): a is string => typeof a === "string")
          .slice(0, 20)
          .map((a) => a.trim().slice(0, 200))
          .filter(Boolean),
      );
    }
    for (const [label, key] of [
      ["سعر الشراء", "purchasePrice"],
      ["سعر البيع", "sellingPrice"],
    ] as const) {
      if (body[key] != null) {
        const n = Number(body[key]);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${label} يجب أن يكون رقمًا غير سالب` }, { status: 400 });
        }
        updates[key] = n;
      }
    }

    const updated = await db.productCatalog.update({ where: { id }, data: updates });
    await invalidateCatalog(updated.companySlug ?? undefined);
    return NextResponse.json(serializeCatalogItem(updated));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/catalog/[id]
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.productCatalog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!itemInScope(existing, scope)) return forbiddenCompanyResponse();

    await db.productCatalog.delete({ where: { id } });
    await invalidateCatalog(existing.companySlug ?? undefined);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
