import type { NextRequest } from "next/server";
import type { Invoice, ProductCatalog, PurchaseInvoice } from "@prisma/client";

/**
 * Shared serialization helpers for the invoice system API.
 *
 * The Prisma/SQLite port stores JSON-typed columns (lineItems, aliases,
 * items, sourceInvoiceIds) as JSON strings, and numeric columns as Float.
 * These helpers mirror the original Express API contract: JSON fields are
 * parsed back to arrays and numeric fields are always plain numbers.
 */

export function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function todayISODate(): string {
  return new Date().toISOString().split("T")[0];
}

/** Safely read a JSON object body; returns {} for invalid/missing payloads. */
export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
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

export function parseIdParam(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) ? id : null;
}

/** r29 (C3): حالات الفاتورة المعروفة — أي حالة أخرى تُرفض (400) */
export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "sent",
  "paid",
  "pending",
  "cancelled",
  "overdue",
] as const;

/** r29 (C3): تاريخ بصيغة YYYY-MM-DD (الصيغة الوحيدة المخزنة في DB) */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------ serializers ------------------------------ */

export function serializeInvoice(inv: Invoice) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    companySlug: inv.companySlug,
    clientId: inv.clientId,
    companyId: inv.companyId,
    clientName: inv.clientName,
    clientEmail: inv.clientEmail,
    clientPhone: inv.clientPhone,
    clientAddress: inv.clientAddress,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    status: inv.status,
    lineItems: parseJsonArray<Record<string, unknown>>(inv.lineItems),
    subtotal: num(inv.subtotal),
    taxRate: num(inv.taxRate),
    taxAmount: num(inv.taxAmount),
    total: num(inv.total),
    shipping: num(inv.shipping),
    paid: num(inv.paid),
    notes: inv.notes,
    source: inv.source,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

export function serializeCatalogItem(p: ProductCatalog) {
  return {
    id: p.id,
    name: p.name,
    aliases: parseJsonArray<string>(p.aliases),
    purchasePrice: p.purchasePrice == null ? null : num(p.purchasePrice),
    sellingPrice: p.sellingPrice == null ? null : num(p.sellingPrice),
    companySlug: p.companySlug,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializePurchaseInvoice(p: PurchaseInvoice) {
  return {
    id: p.id,
    num: p.num,
    date: p.date,
    supplier: p.supplier,
    companySlug: p.companySlug,
    items: parseJsonArray<Record<string, unknown>>(p.items),
    sourceInvoiceIds: parseJsonArray<unknown>(p.sourceInvoiceIds),
    totalQty: p.totalQty,
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

/* --------------------------- dashboard helpers --------------------------- */

/**
 * إجمالي الفاتورة = المجموع + الضريبة + التوصيل.
 * r29 (C1): كانت الضريبة (taxAmount، حقول r18) مُغفّلة هنا منذ r18 فاختلفت كل
 * الأرقام المشتقة (داشبورد/تصدير CSV/سياق المساعد) عن مسار المدفوعات الذي
 * يحسبها صحيحاً — الآن الكل يقرأ من هذه الدالة الواحدة.
 */
export function invoiceTotal(
  inv: Pick<Invoice, "subtotal" | "taxAmount" | "shipping">,
): number {
  return num(inv.subtotal) + num(inv.taxAmount) + num(inv.shipping);
}

/**
 * Payment-derived status used by the dashboard:
 * cancel | paid | part | unp
 */
export function invoicePaymentStatus(
  inv: Pick<Invoice, "status" | "subtotal" | "taxAmount" | "shipping" | "paid">,
): string {
  if (inv.status === "cancelled") return "cancel";
  const tot = invoiceTotal(inv);
  const paid = num(inv.paid);
  if (paid >= tot && tot > 0) return "paid";
  if (paid > 0) return "part";
  return "unp";
}
