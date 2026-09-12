import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeInvoice } from "@/lib/serialize";
import { cacheWrap } from "@/lib/cache";

// GET /api/dashboard/recent-invoices?companySlug= — first 10, newest first
// (r10: كاش Valkey 30 ثانية)
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const invoices = await cacheWrap(`recent:${companySlug ?? "all"}`, 30, () =>
      db.invoice.findMany({
        where: companySlug ? { companySlug } : {},
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    );

    return NextResponse.json(invoices.map(serializeInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
