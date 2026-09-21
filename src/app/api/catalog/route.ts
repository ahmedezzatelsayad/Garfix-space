import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody, serializeCatalogItem } from "@/lib/serialize";
import { cacheWrap, invalidateCatalog } from "@/lib/cache";
import { getSessionScope, requireCompanyAccess, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

/**
 * r29 (S1/C3): كتالوج المنتجات — تتطلب جلسة؛ الوصول محصور بشركات الجلسة
 * (المدير العام يرى الكل)، والأسعار أرقام غير سالبة والأسماء محدودة الطول.
 */

// GET /api/catalog?companySlug= — (r10: كاش Valkey 60 ثانية)
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const companySlug = req.nextUrl.searchParams.get("companySlug")?.trim() || undefined;
    if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
      return forbiddenCompanyResponse();
    }

    const where = companySlug
      ? { companySlug }
      : scope.all
        ? {}
        : { companySlug: { in: scope.slugs } };
    const scopeKey = companySlug || (scope.all ? "all" : scope.slugs.join("+"));
    const rows = await cacheWrap(`catalog:v2:${scopeKey}`, 60, () =>
      db.productCatalog.findMany({ where, orderBy: { id: "asc" } }),
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
    const companySlug =
      body.companySlug == null ? null : String(body.companySlug).trim() || null;

    // r29 (S1): إضافة صنف داخل شركة تتطلب ملكيتها
    const denied = await requireCompanyAccess(req, companySlug);
    if (denied) return denied;

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 300) : "";
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    // r29 (C3): الأسعار أرقام غير سالبة عند تقديمها
    for (const [label, v] of [
      ["سعر الشراء", body.purchasePrice],
      ["سعر البيع", body.sellingPrice],
    ] as const) {
      if (v != null) {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: `${label} يجب أن يكون رقمًا غير سالب` }, { status: 400 });
        }
      }
    }

    const aliases = Array.isArray(body.aliases)
      ? body.aliases
          .filter((a): a is string => typeof a === "string")
          .slice(0, 20)
          .map((a) => a.trim().slice(0, 200))
          .filter(Boolean)
      : [];

    const created = await db.productCatalog.create({
      data: {
        name,
        aliases: JSON.stringify(aliases),
        purchasePrice: body.purchasePrice == null ? null : Number(body.purchasePrice),
        sellingPrice: body.sellingPrice == null ? null : Number(body.sellingPrice),
        companySlug,
      },
    });

    await invalidateCatalog(created.companySlug ?? undefined);
    return NextResponse.json(serializeCatalogItem(created), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
