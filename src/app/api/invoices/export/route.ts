import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  num,
  parseJsonArray,
  invoiceTotal,
  invoicePaymentStatus,
} from "@/lib/serialize";

/**
 * GET /api/invoices/export?companySlug=X
 * Downloads the invoice list as a CSV file (UTF-8 with BOM so Excel
 * renders the Arabic columns correctly).
 */
export async function GET(req: NextRequest) {
  try {
    const companySlug = req.nextUrl.searchParams.get("companySlug") ?? undefined;

    const invoices = await db.invoice.findMany({
      where: {
        ...(companySlug ? { companySlug } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Payment status labels (Arabic) — mirrors the frontend stLabel map
    const stLabel: Record<string, string> = {
      paid: "مدفوعة",
      part: "جزئي",
      unp: "غير مدفوعة",
      cancel: "ملغية",
    };

    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "رقم الفاتورة",
      "العميل",
      "الهاتف",
      "العنوان",
      "التاريخ",
      "تاريخ الاستحقاق",
      "المنتجات",
      "عدد المنتجات",
      "التوصيل",
      "الإجمالي",
      "المدفوع",
      "المتبقي",
      "الحالة",
      "ملاحظات",
      "المصدر",
    ];

    const rows = invoices.map((inv) => {
      const items = parseJsonArray<Record<string, unknown>>(inv.lineItems);
      const products = items
        .map((it) => `${String(it.name ?? "")} × ${num(it.qty) || 1}`)
        .join(" ، ");
      const tot = invoiceTotal(inv);
      const paid = num(inv.paid);
      const due = Math.max(0, tot - paid);
      const st = invoicePaymentStatus(inv);
      return {
        "رقم الفاتورة": inv.invoiceNumber,
        العميل: inv.clientName,
        الهاتف: inv.clientPhone ?? "",
        العنوان: inv.clientAddress ?? "",
        التاريخ: inv.issueDate,
        "تاريخ الاستحقاق": inv.dueDate,
        المنتجات: products,
        "عدد المنتجات": items.length,
        التوصيل: num(inv.shipping).toFixed(3),
        الإجمالي: tot.toFixed(3),
        المدفوع: paid.toFixed(3),
        المتبقي: due.toFixed(3),
        الحالة: stLabel[st] ?? st,
        ملاحظات: inv.notes ?? "",
        المصدر: inv.source ?? "",
      };
    });

    const csv = [
      headers.map(esc).join(","),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
    ].join("\r\n");

    const filename = companySlug
      ? `Invoices_${companySlug}_${new Date().toISOString().split("T")[0]}.csv`
      : `Invoices_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse("\uFEFF" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
