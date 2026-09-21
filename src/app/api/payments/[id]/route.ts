import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { num, parseIdParam } from "@/lib/serialize";
import { invalidateInvoices } from "@/lib/cache";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

type RouteContext = { params: Promise<{ id: string }> };

/** Error thrown inside a transaction that maps to a specific HTTP status. */
class PaymentRouteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// DELETE /api/payments/[id] — remove a payment and roll the parent invoice's
// `paid` back by the payment amount (clamped at >= 0) in one transaction.
// The invoice `status` field is left untouched.
// r29 (S1): تتطلب جلسة + ملكية شركة الفاتورة الأم.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    // r29 (S1): تحقق الملكية قبل المعاملة (الفاتورة الأم تُقرأ داخلها مجدداً)
    const existing = await db.payment.findUnique({
      where: { id },
      include: { invoice: { select: { companySlug: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      !scope.all &&
      (!existing.invoice?.companySlug || !scope.slugs.includes(existing.invoice.companySlug))
    ) {
      return forbiddenCompanyResponse();
    }

    await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) {
        throw new PaymentRouteError(404, "Not found");
      }

      // The FK cascade removes payments when their invoice is deleted, so the
      // parent normally exists; guard anyway to keep the operation safe.
      const invoice = await tx.invoice.findUnique({
        where: { id: payment.invoiceId },
      });
      if (invoice) {
        const newPaid = Math.max(0, num(invoice.paid) - num(payment.amount));
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paid: newPaid },
        });
      }

      await tx.payment.delete({ where: { id } });
    });

    await invalidateInvoices(undefined);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof PaymentRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
