import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionScope, unauthorizedResponse, forbiddenCompanyResponse } from "@/lib/auth-server";

/**
 * GET /api/reminders?companySlug=…&invoiceId=…
 *   → list reminder logs (newest first), filterable by company and invoice
 * POST /api/reminders
 *   { invoiceId?, clientPhone?, clientName?, channel?, message?, amount? }
 *   → 201 created reminder log (audit trail for WhatsApp payment reminders)
 * r29 (S1): تتطلب جلسة؛ السجلات محصورة بشركات الجلسة، والتسجيل على فاتورة
 * يتطلب ملكية شركة الفاتورة.
 */
export async function GET(req: NextRequest) {
  const scope = await getSessionScope(req);
  if (!scope) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const companySlug = searchParams.get("companySlug")?.trim() || undefined;
  const invoiceIdRaw = searchParams.get("invoiceId");
  const invoiceId = invoiceIdRaw ? Number(invoiceIdRaw) : undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw) || 50, 1), 200) : 50;

  if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
    return forbiddenCompanyResponse();
  }

  const where: Record<string, unknown> = {
    ...(companySlug
      ? { companySlug }
      : scope.all
        ? {}
        : { companySlug: { in: scope.slugs } }), // r29: بلا شركة → شركات الجلسة
  };
  if (invoiceId && Number.isFinite(invoiceId)) where.invoiceId = invoiceId;

  const reminders = await db.reminderLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { invoice: { select: { invoiceNumber: true } } },
  });

  return NextResponse.json(
    reminders.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      companySlug: r.companySlug,
      invoiceNumber: r.invoice?.invoiceNumber ?? null,
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      channel: r.channel,
      message: r.message,
      amount: r.amount,
      createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const scope = await getSessionScope(req);
  if (!scope) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const invoiceId =
    body.invoiceId == null || body.invoiceId === "" ? null : Number(body.invoiceId);
  if (invoiceId != null && (!Number.isFinite(invoiceId) || invoiceId <= 0)) {
    return NextResponse.json({ error: "رقم فاتورة غير صالح" }, { status: 400 });
  }

  let clientName = typeof body.clientName === "string" ? body.clientName.trim() : null;
  let clientPhone = typeof body.clientPhone === "string" ? body.clientPhone.trim() : null;
  let companySlug = typeof body.companySlug === "string" ? body.companySlug.trim() || null : null;
  const channel = ["whatsapp", "call", "manual", "payment_request", "statement"].includes(String(body.channel))
    ? String(body.channel)
    : "whatsapp";
  const message =
    typeof body.message === "string" && body.message.trim() ? body.message.trim().slice(0, 2000) : null;
  const amount =
    body.amount == null || body.amount === ""
      ? null
      : Number.isFinite(Number(body.amount))
        ? Number(body.amount)
        : null;

  // Snapshot invoice fields (name/phone/company/invoice number) when available,
  // so the log survives invoice deletion (onDelete: SetNull).
  if (invoiceId != null) {
    const inv = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, clientName: true, clientPhone: true, companySlug: true },
    });
    if (!inv) {
      return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    }
    // r29 (S1): تسجيل تذكير على فاتورة شركة غير متاحة → 403
    if (!scope.all && (!inv.companySlug || !scope.slugs.includes(inv.companySlug))) {
      return forbiddenCompanyResponse();
    }
    clientName = clientName || inv.clientName;
    clientPhone = clientPhone || inv.clientPhone;
    companySlug = companySlug || inv.companySlug || null;
  }

  // r29 (S1): شركة صريحة في الطلب يجب أن تكون ضمن شركات الجلسة
  if (companySlug && !scope.all && !scope.slugs.includes(companySlug)) {
    return forbiddenCompanyResponse();
  }

  const created = await db.reminderLog.create({
    data: {
      invoiceId,
      companySlug,
      clientName,
      clientPhone,
      channel,
      message,
      amount,
    },
    include: { invoice: { select: { invoiceNumber: true } } },
  });

  return NextResponse.json(
    {
      id: created.id,
      invoiceId: created.invoiceId,
      companySlug: created.companySlug,
      invoiceNumber: created.invoice?.invoiceNumber ?? null,
      clientName: created.clientName,
      clientPhone: created.clientPhone,
      channel: created.channel,
      message: created.message,
      amount: created.amount,
      createdAt: created.createdAt?.toISOString?.() ?? created.createdAt,
    },
    { status: 201 },
  );
}
