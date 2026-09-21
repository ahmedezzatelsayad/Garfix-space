import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  num,
  parseIdParam,
  readBody,
  serializeInvoice,
  INVOICE_STATUSES,
  ISO_DATE_RE,
} from "@/lib/serialize";
import { invalidateInvoices } from "@/lib/cache";
import {
  getSessionScope,
  requireCompanyAccess,
  unauthorizedResponse,
  forbiddenCompanyResponse,
} from "@/lib/auth-server";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * r29 (S1/C2/C3): فاتورة بمفردها — تتطلب جلسة، والوصول محصور بشركة الفاتورة
 * (المدير العام يجتاز دائماً). PUT يعيد حساب subtotal/taxAmount/total كلما تغيّر
 * أي من البنود/المجموع/الضريبة/التوصيل فلا تبقى أرقام قديمة.
 */

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** r29 (S1): فاتورة ضمن نطاق الجلسة؟ (null = ليس لها شركة → المدير فقط) */
function invoiceInScope(
  inv: { companySlug: string | null },
  scope: { all: boolean; slugs: string[] },
): boolean {
  if (scope.all) return true;
  return !!inv.companySlug && scope.slugs.includes(inv.companySlug);
}

// GET /api/invoices/[id]
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const row = await db.invoice.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!invoiceInScope(row, scope)) return forbiddenCompanyResponse();

    return NextResponse.json(serializeInvoice(row));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// PUT /api/invoices/[id] — partial update semantics (only provided fields)
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!invoiceInScope(existing, scope)) return forbiddenCompanyResponse();

    const body = await readBody(req);
    const { lineItems, subtotal, taxRate, taxAmount, total, shipping, paid, ...rest } = body;

    // r29 (S1): نقل الفاتورة لشركة أخرى يتطلب ملكية الشركة الجديدة أيضاً
    if (rest.companySlug !== undefined && rest.companySlug !== existing.companySlug) {
      const newSlug = rest.companySlug == null ? null : String(rest.companySlug).trim() || null;
      if (newSlug !== existing.companySlug) {
        const denied = await requireCompanyAccess(req, newSlug);
        if (denied) return denied;
      }
    }

    // ── r29 (C3): تحقق البنود والمبالغ ──
    let items: Record<string, unknown>[] | null = null;
    if (lineItems !== undefined) {
      if (!Array.isArray(lineItems)) return badRequest("قائمة البنود يجب أن تكون مصفوفة");
      if (lineItems.length > 200) return badRequest("قائمة البنود كبيرة جداً (الحد 200 بند)");
      for (const it of lineItems) {
        if (!it || typeof it !== "object" || Array.isArray(it)) {
          return badRequest("بنود الفاتورة غير صالحة");
        }
        const rec = it as Record<string, unknown>;
        const name = rec.name ?? rec.desc;
        if (name !== undefined && typeof name !== "string") {
          return badRequest("اسم البند يجب أن يكون نصاً");
        }
        if (name !== undefined && name.length > 300) {
          return badRequest("اسم البند طويل جداً (الحد 300 محرف)");
        }
        const qty = num(rec.qty ?? 1);
        const price = num(rec.price ?? 0);
        if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(price) || price < 0) {
          return badRequest("كمية وسعر البند يجب أن يكونا رقمين غير سالبين");
        }
      }
      items = lineItems as Record<string, unknown>[];
    }

    for (const [label, v] of [
      ["المجموع", subtotal],
      ["التوصيل", shipping],
      ["المدفوع", paid],
      ["مبلغ الضريبة", taxAmount],
    ] as const) {
      if (v !== undefined) {
        const n = num(v);
        if (!Number.isFinite(n) || n < 0) return badRequest(`${label} يجب أن يكون رقمًا غير سالب`);
      }
    }
    if (taxRate !== undefined) {
      const r = num(taxRate);
      if (!Number.isFinite(r) || r < 0 || r > 100) {
        return badRequest("نسبة الضريبة يجب أن تكون بين 0 و 100");
      }
    }
    if (total !== undefined && (!Number.isFinite(num(total)) || num(total) < 0)) {
      return badRequest("الإجمالي يجب أن يكون رقمًا غير سالب");
    }
    if (rest.status != null) {
      const st = String(rest.status);
      if (!(INVOICE_STATUSES as readonly string[]).includes(st)) {
        return badRequest("حالة الفاتورة غير صالحة");
      }
    }
    for (const d of [rest.issueDate, rest.dueDate]) {
      if (d != null && !ISO_DATE_RE.test(String(d).slice(0, 10))) {
        return badRequest("التاريخ يجب أن يكون بصيغة YYYY-MM-DD");
      }
    }
    // r29 (C3): سقوف أطوال النصوص — تجاوزها يُرفض (400) لا يُقصّ صامتاً
    const textCaps = [
      ["اسم العميل", rest.clientName, 500],
      ["بريد العميل", rest.clientEmail, 320],
      ["هاتف العميل", rest.clientPhone, 40],
      ["عنوان العميل", rest.clientAddress, 500],
      ["الملاحظات", rest.notes, 5000],
      ["رقم الفاتورة", rest.invoiceNumber, 60],
      ["المصدر", rest.source, 60],
    ] as const;
    for (const [label, v, cap] of textCaps) {
      if (typeof v === "string" && v.length > cap) {
        return badRequest(`${label} أطول من الحد (${cap} محرف)`);
      }
    }

    // ── r29 (C2): إعادة حساب الأرقام المالية كلما تغيّر أي جزء ──
    const partsChanged =
      lineItems !== undefined ||
      subtotal !== undefined ||
      taxRate !== undefined ||
      taxAmount !== undefined ||
      shipping !== undefined;

    const sub =
      subtotal !== undefined
        ? num(subtotal)
        : items != null
          ? items.reduce((s, it) => s + num(it?.qty) * num(it?.price), 0)
          : num(existing.subtotal);
    const tRate = taxRate !== undefined ? num(taxRate) : num(existing.taxRate);
    const ship = shipping !== undefined ? num(shipping) : num(existing.shipping);
    const tAmount =
      taxRate !== undefined
        ? sub * (tRate / 100)
        : taxAmount !== undefined
          ? num(taxAmount)
          : partsChanged
            ? sub * (tRate / 100)
            : num(existing.taxAmount);
    // الإجمالي يعاد حسابه من الأجزاء عند تغيّر أي جزء؛ total منفرداً (بلا تغيير
    // أجزاء) يُحترم كما كان للحفاظ على سلوك التحديث الجزئي القديم.
    const tot = partsChanged ? sub + tAmount + ship : total !== undefined ? num(total) : num(existing.total);

    const updates: Prisma.InvoiceUpdateInput = {};

    const str = (v: unknown, max: number): string | null => {
      const s = v == null ? null : String(v);
      return s == null ? null : s.slice(0, max);
    };
    if (rest.invoiceNumber != null) updates.invoiceNumber = str(rest.invoiceNumber, 60) ?? "";
    if (rest.companySlug !== undefined) {
      updates.companySlug = rest.companySlug == null ? null : String(rest.companySlug).trim() || null;
    }
    if (rest.clientName != null) updates.clientName = str(rest.clientName, 500) ?? "عميل";
    if (rest.clientEmail !== undefined) {
      updates.clientEmail = rest.clientEmail == null ? null : str(rest.clientEmail, 320);
    }
    if (rest.clientPhone !== undefined) {
      updates.clientPhone = rest.clientPhone == null ? null : str(rest.clientPhone, 40);
    }
    if (rest.clientAddress !== undefined) {
      updates.clientAddress = rest.clientAddress == null ? null : str(rest.clientAddress, 500);
    }
    if (rest.issueDate != null) updates.issueDate = String(rest.issueDate).slice(0, 10);
    if (rest.dueDate != null) updates.dueDate = String(rest.dueDate).slice(0, 10);
    if (rest.status != null) updates.status = String(rest.status);
    if (rest.notes !== undefined) {
      updates.notes = rest.notes == null ? null : str(rest.notes, 5000);
    }
    if (rest.source !== undefined) {
      updates.source = rest.source == null ? null : str(rest.source, 60);
    }
    if (items != null) updates.lineItems = JSON.stringify(items);
    if (partsChanged) {
      updates.subtotal = sub;
      updates.taxRate = tRate;
      updates.taxAmount = tAmount;
      updates.total = tot;
      updates.shipping = ship;
    } else if (total !== undefined) {
      updates.total = tot;
    }
    if (paid !== undefined) updates.paid = num(paid);

    const updated = await db.invoice.update({ where: { id }, data: updates });
    await invalidateInvoices(updated.companySlug ?? undefined);
    return NextResponse.json(serializeInvoice(updated));
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "رقم الفاتورة مستخدم مسبقاً لهذه الشركة — اختر رقماً آخر" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

// DELETE /api/invoices/[id]
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { id: idStr } = await params;
    const id = parseIdParam(idStr);
    if (id === null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!invoiceInScope(existing, scope)) return forbiddenCompanyResponse();

    await db.invoice.delete({ where: { id } });
    await invalidateInvoices(existing.companySlug ?? undefined);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
