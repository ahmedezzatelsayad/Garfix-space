import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  num,
  readBody,
  serializeInvoice,
  todayISODate,
  INVOICE_STATUSES,
  ISO_DATE_RE,
} from "@/lib/serialize";
import { cacheWrap, invalidateInvoices } from "@/lib/cache";
import {
  getSessionScope,
  requireCompanyAccess,
  unauthorizedResponse,
  forbiddenCompanyResponse,
} from "@/lib/auth-server";

/**
 * r29 (S1/C3/C9): قائمة الفواتير وإنشاؤها — تتطلب جلسة صالحة، والوصول محصور
 * بشركات الجلسة (المدير العام يرى الكل). المدخلات المالية والنصية تُتحقق بصرامة،
 * ومفاتيح الكاش محدودة (لا search في المفتاح، والحالة من enum معروف).
 */

const MAX_LINE_ITEMS = 200;

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

// GET /api/invoices?companySlug=&status=&search= — (r10: كاش Valkey 15 ثانية)
export async function GET(req: NextRequest) {
  try {
    const scope = await getSessionScope(req);
    if (!scope) return unauthorizedResponse();

    const { searchParams } = req.nextUrl;
    const companySlugRaw = searchParams.get("companySlug")?.trim() || "";
    const statusRaw = searchParams.get("status")?.trim() || "";
    const search = (searchParams.get("search") ?? "").trim().slice(0, 80);

    // r29 (C9): الحالة من enum معروف فقط — يمنع تضخم مفاتيح الكاش وقيمًا غريبة
    if (statusRaw && !(INVOICE_STATUSES as readonly string[]).includes(statusRaw)) {
      return badRequest("حالة الفاتورة غير صالحة");
    }

    // r29 (S1): شركة محددة يجب أن تكون ضمن شركات الجلسة
    if (companySlugRaw && !scope.all && !scope.slugs.includes(companySlugRaw)) {
      return forbiddenCompanyResponse();
    }

    const where: Prisma.InvoiceWhereInput = {
      ...(companySlugRaw
        ? { companySlug: companySlugRaw }
        : scope.all
          ? {}
          : { companySlug: { in: scope.slugs } }), // r29: بلا شركة → شركات الجلسة فقط
      ...(statusRaw ? { status: statusRaw } : {}),
      ...(search ? { clientName: { contains: search } } : {}),
    };
    const orderBy = { createdAt: "desc" as const };

    // r29 (C9): البحث النصي يُستعلم مباشرة (بلا كاش) حتى لا يتولّد مفتاح لكل نص
    const scopeKey = companySlugRaw || (scope.all ? "all" : scope.slugs.join("+"));
    const rows = search
      ? await db.invoice.findMany({ where, orderBy })
      : await cacheWrap(`invoices:v2:${scopeKey}:${statusRaw}`, 15, () =>
          db.invoice.findMany({ where, orderBy }),
        );

    return NextResponse.json(rows.map(serializeInvoice));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/invoices
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const companySlug =
      body.companySlug == null ? null : String(body.companySlug).trim() || null;

    // r29 (S1): إنشاء فاتورة داخل شركة يتطلب ملكيتها (المدير العام يجتاز دائماً)
    const denied = await requireCompanyAccess(req, companySlug);
    if (denied) return denied;

    const { lineItems, subtotal, taxRate, taxAmount, total, shipping, paid, ...rest } = body;

    // ── r29 (C3): تحقق صارم من البنود والمبالغ والنصوص ──
    let items: Record<string, unknown>[] = [];
    if (lineItems !== undefined) {
      if (!Array.isArray(lineItems)) return badRequest("قائمة البنود يجب أن تكون مصفوفة");
      if (lineItems.length > MAX_LINE_ITEMS) {
        return badRequest(`قائمة البنود كبيرة جداً (الحد ${MAX_LINE_ITEMS} بند)`);
      }
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
        items.push(rec);
      }
    } else {
      items = [];
    }

    const subProvided = subtotal !== undefined;
    const sub = subProvided ? num(subtotal) : items.reduce((s, it) => s + num(it?.qty) * num(it?.price), 0);
    if (!Number.isFinite(sub) || sub < 0) return badRequest("المجموع يجب أن يكون رقمًا غير سالب");

    const tRate = num(taxRate);
    if (!Number.isFinite(tRate) || tRate < 0 || tRate > 100) {
      return badRequest("نسبة الضريبة يجب أن تكون بين 0 و 100");
    }
    const tAmountProvided = taxAmount !== undefined ? num(taxAmount) : null;
    if (taxAmount !== undefined && (!Number.isFinite(tAmountProvided ?? 0) || (tAmountProvided ?? 0) < 0)) {
      return badRequest("مبلغ الضريبة يجب أن يكون رقمًا غير سالب");
    }
    // الضريبة تُشتق من النسبة (كما في الواجهة)؛ عند غياب النسبة يُقبل المبلغ الصريح
    const tAmount = taxRate !== undefined ? sub * (tRate / 100) : (tAmountProvided ?? 0);

    const ship = num(shipping);
    if (!Number.isFinite(ship) || ship < 0) return badRequest("التوصيل يجب أن يكون رقمًا غير سالب");

    const paidN = num(paid);
    if (!Number.isFinite(paidN) || paidN < 0) return badRequest("المدفوع يجب أن يكون رقمًا غير سالب");

    // الإجمالي يُحسب دائماً من الأجزاء — لا يُقبل إجمالي مخالف للمعادلة
    const tot = sub + tAmount + ship;

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

    const str = (v: unknown, max: number): string | null => {
      const s = v == null ? null : String(v);
      return s == null ? null : s.slice(0, max);
    };
    const invoiceNumber = str(rest.invoiceNumber, 60)?.trim() || `INV${Date.now()}`;
    const clientName = str(rest.clientName, 500)?.trim() || "عميل";
    const status = str(rest.status, 20)?.trim() || "draft";
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) {
      return badRequest("حالة الفاتورة غير صالحة");
    }
    const issueDate = str(rest.issueDate, 10) || todayISODate();
    const dueDate = str(rest.dueDate, 10) || todayISODate();
    if (!ISO_DATE_RE.test(issueDate) || !ISO_DATE_RE.test(dueDate)) {
      return badRequest("التاريخ يجب أن يكون بصيغة YYYY-MM-DD");
    }

    const created = await db.invoice.create({
      data: {
        invoiceNumber,
        companySlug,
        clientName,
        clientEmail: str(rest.clientEmail, 320),
        clientPhone: str(rest.clientPhone, 40),
        clientAddress: str(rest.clientAddress, 500),
        issueDate,
        dueDate,
        status,
        lineItems: JSON.stringify(items),
        subtotal: sub,
        taxRate: tRate,
        taxAmount: tAmount,
        total: tot,
        shipping: ship,
        paid: paidN,
        notes: str(rest.notes, 5000),
        source: str(rest.source, 60),
      },
    });

    await invalidateInvoices(created.companySlug ?? undefined);
    return NextResponse.json(serializeInvoice(created), { status: 201 });
  } catch (err) {
    // r29 (C7): تعارض رقم الفاتورة داخل الشركة (القيد الفريد الجديد) → 409 واضح
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "رقم الفاتورة مستخدم مسبقاً لهذه الشركة — اختر رقماً آخر" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
