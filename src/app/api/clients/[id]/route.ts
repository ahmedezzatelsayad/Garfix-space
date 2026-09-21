import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { num, parseIdParam, serializeInvoice } from "@/lib/serialize";
import { invalidateClients } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";
import { companyMatchKeys } from "@/lib/company-access";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * r29 (S1): عميل بمفرده — تتطلب جلسة؛ العميل يجب أن يتبع إحدى شركات الجلسة
 * (مطابقة company بكل صيغها: slug/code/name/nameAr). المدير العام يجتاز دائماً.
 */
async function clientInScope(
  client: { company: string | null },
  scope: { all: boolean; slugs: string[] },
): Promise<boolean> {
  if (scope.all) return true;
  const v = String(client.company ?? "").trim().toLowerCase();
  if (!v) return false;
  const keys = await companyMatchKeys(scope.slugs);
  return keys.has(v);
}

// GET /api/clients/[id] — client + invoice summary
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const client = await db.client.findUnique({ where: { id } });
    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await clientInScope(client, scope))) return forbiddenCompanyResponse();

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
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await clientInScope(existing, scope))) return forbiddenCompanyResponse();

    const body = await readBodySafe(req);
    const updates: Prisma.ClientUpdateInput = {};

    const str = (v: unknown, max: number): string | null =>
      v == null ? null : String(v).trim().slice(0, max) || null;

    if (body.name != null) {
      const name = str(body.name, 500);
      if (!name) return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
      updates.name = name;
    }
    if (body.email !== undefined) updates.email = body.email == null ? null : str(body.email, 320);
    if (body.phone !== undefined) updates.phone = body.phone == null ? null : str(body.phone, 40);
    if (body.address !== undefined) {
      updates.address = body.address == null ? null : str(body.address, 500);
    }
    if (body.country !== undefined) {
      updates.country = body.country == null ? null : str(body.country, 2)?.toUpperCase() || null;
    }
    if (body.governorate !== undefined) {
      updates.governorate = body.governorate == null ? null : str(body.governorate, 200);
    }
    if (body.company !== undefined) {
      const company = body.company == null ? null : str(body.company, 200);
      // r29 (S1): نقل العميل لشركة أخرى يتطلب ملكيتها
      if (!scope.all && company != null) {
        const keys = await companyMatchKeys(scope.slugs);
        if (!keys.has(String(company).toLowerCase())) return forbiddenCompanyResponse();
      }
      updates.company = company;
    }

    const updated = await db.client.update({ where: { id }, data: updates });
    await invalidateClients();
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/clients/[id]
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!(await clientInScope(existing, scope))) return forbiddenCompanyResponse();

    await db.client.delete({ where: { id } });
    await invalidateClients();
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

/** قراءة جسم JSON بأمان ({} عند الفشل) */
async function readBodySafe(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
