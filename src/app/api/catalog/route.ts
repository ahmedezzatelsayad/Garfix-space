import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody, serializeCatalogItem } from "@/lib/serialize";
import { cacheWrap, invalidateCatalog } from "@/lib/cache";

// GET /api/catalog?companySlug= — (r10: كاش Valkey 60 ثانية)
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const rows = await cacheWrap(`catalog:${companySlug ?? "all"}`, 60, () =>
      db.productCatalog.findMany({
        where: companySlug ? { companySlug } : {},
        orderBy: { id: "asc" },
      }),
    );

    return NextResponse.json(rows.map(serializeCatalogItem));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/catalog — body: { name, aliases?, purchasePrice?, sellingPrice?, companySlug? }
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    if (!body.name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const created = await db.productCatalog.create({
      data: {
        name: String(body.name).trim(),
        aliases: JSON.stringify(Array.isArray(body.aliases) ? body.aliases : []),
        purchasePrice: body.purchasePrice == null ? null : Number(body.purchasePrice),
        sellingPrice: body.sellingPrice == null ? null : Number(body.sellingPrice),
        companySlug: body.companySlug == null ? null : String(body.companySlug),
      },
    });

    await invalidateCatalog(created.companySlug ?? undefined);
    return NextResponse.json(serializeCatalogItem(created), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
