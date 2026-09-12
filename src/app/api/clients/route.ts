import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readBody } from "@/lib/serialize";
import { cacheWrap, invalidateClients } from "@/lib/cache";

// GET /api/clients?search=&company= — (r10: كاش Valkey 30 ثانية)
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search");
    const company = req.nextUrl.searchParams.get("company");

    let rows = await cacheWrap(`clients:${company ?? "all"}:${search ?? ""}`, 30, () =>
      db.client.findMany({
        orderBy: { createdAt: "desc" },
      }),
    );
    if (company) {
      rows = rows.filter((r) => (r.company || "") === company);
    }
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.email || "").toLowerCase().includes(s) ||
          (r.phone || "").includes(s),
      );
    }

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/clients — body: { name, email?, phone?, company?, address?, companyId? }
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    if (body.name == null) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await db.client.create({
      data: {
        name: String(body.name),
        email: body.email == null ? null : String(body.email),
        phone: body.phone == null ? null : String(body.phone),
        company: body.company == null ? null : String(body.company),
        address: body.address == null ? null : String(body.address),
        companyId: body.companyId == null ? null : Number(body.companyId),
      },
    });

    await invalidateClients();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
