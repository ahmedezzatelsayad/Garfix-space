import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoicePaymentStatus, invoiceTotal, num } from "@/lib/serialize";

// GET /api/dashboard/stats?companySlug=
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const invoices = await db.invoice.findMany({
      where: companySlug ? { companySlug } : {},
      orderBy: { createdAt: "desc" },
    });
    const totalClients = await db.client.count();

    let totalRevenue = 0;
    let outstanding = 0;
    let overdue = 0;
    let paidCount = 0;
    let sentCount = 0;
    let overdueCount = 0;
    let draftCount = 0;

    for (const inv of invoices) {
      const tot = invoiceTotal(inv);
      const paid = num(inv.paid);
      const st = invoicePaymentStatus(inv);
      if (st === "paid") {
        totalRevenue += tot;
        paidCount++;
      } else if (st === "part") {
        totalRevenue += paid;
        outstanding += tot - paid;
        sentCount++;
      } else if (st === "unp") {
        outstanding += tot;
        draftCount++;
      }
      if (inv.status === "overdue") overdueCount++;
    }

    return NextResponse.json({
      totalRevenue,
      outstanding,
      overdue,
      draftCount,
      paidCount,
      sentCount,
      overdueCount,
      totalInvoices: invoices.length,
      totalClients,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
