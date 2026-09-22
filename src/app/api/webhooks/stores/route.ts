import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { todayISODate } from "@/lib/serialize";
import { invalidateInvoices } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * ── المرحلة 1 (تكامل Garfix Stores): مستقبِل Webhooks من منصة المتاجر ──
 *
 * POST /api/webhooks/stores
 * الأحداث المدعومة:
 *  - order.created       → إنشاء فاتورة ERP من طلب متجر (COD) — idempotent
 *  - order.status_changed → delivered: تسجيل دفعة تحصيل + سداد الفاتورة
 *                          cancelled/returned (قبل التحصيل): إلغاء الفاتورة
 *                          shipped: وسم الفاتورة «مُرسلة»
 *
 * الأمان:
 *  - التوقيع إلزامي: X-Garfix-Signature: sha256=HMAC_SHA256(rawBody, GARFIX_WEBHOOK_SECRET)
 *    مقارنة timing-safe. بلا سر صالح → 401 فوراً.
 *  - Idempotency مزدوج: @@unique([companySlug, externalSource, externalRef])
 *    على الفواتير و @@unique على Payment.externalRef — إعادة إرسال الحدث أو
 *    تزامن محاولتين لا يُنشئان أبداً فاتورة أو دفعة مكررة.
 *  - الأرقام تُعاد حسابها من البنود دائماً (لا نثق بمجاميع الطلب الواردة).
 */

const EXTERNAL_SOURCE = "garfix-stores";

interface WebhookItem {
  name?: unknown;
  quantity?: unknown;
  price?: unknown;
}

interface StoresPayload {
  event?: unknown;
  store?: { slug?: unknown; name?: unknown };
  order?: {
    number?: unknown;
    status?: unknown;
    customer?: {
      name?: unknown;
      phone?: unknown;
      area?: unknown;
      governorate?: unknown;
      address?: unknown;
    };
    items?: WebhookItem[];
    subtotal?: unknown;
    shipping?: unknown;
    total?: unknown;
    currency?: unknown;
    affiliateCode?: unknown;
  };
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

/** تحقق توقيع HMAC-SHA256 (timing-safe) — يتساهل مع sha256= وبلا بادئة. */
function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.GARFIX_WEBHOOK_SECRET || "";
  if (!secret) return false;
  if (!header) return false;
  const provided = header.replace(/^sha256=/, "").trim();
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

const str = (v: unknown, max = 200): string =>
  v == null ? "" : String(v).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

const numPos = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** يحدد شركة ERP المستقبِلة: مطابقة storesSlug في DB ثم خرائط env ثم الافتراضية. */
async function resolveCompany(storeSlug: string) {
  const slug = str(storeSlug, 80);
  if (slug) {
    const byStore = await db.company.findFirst({ where: { storesSlug: slug } });
    if (byStore) return byStore;
    const envMap = (process.env.GARFIX_STORES_SLUG_MAP || "")
      .split(",")
      .map((pair) => pair.split(":").map((x) => x.trim()))
      .find(([store, company]) => store === slug && company);
    if (envMap && envMap[1]) {
      const c = await db.company.findFirst({ where: { slug: envMap[1] } });
      if (c) return c;
    }
  }
  const fallbackSlug = (process.env.GARFIX_STORES_DEFAULT_SLUG || "").trim();
  if (fallbackSlug) {
    return db.company.findFirst({ where: { slug: fallbackSlug } });
  }
  return null;
}

/** عميل الشركة بالهاتف (upsert خفيف — يُنشئ عند الغياب). */
async function upsertClient(
  companyId: number,
  companySlug: string,
  customer: NonNullable<StoresPayload["order"]>["customer"],
) {
  const name = str(customer?.name, 200) || "عميل متجر";
  const phone = str(customer?.phone, 40);
  const addressParts = [
    str(customer?.governorate, 120),
    str(customer?.area, 120),
    str(customer?.address, 300),
  ].filter(Boolean);
  const address = addressParts.join(" — ").slice(0, 500) || null;

  if (phone) {
    const existing = await db.client.findFirst({
      where: { companyId, phone },
    });
    if (existing) {
      // تحديث الاسم/العنوان إن تغيرا (آخر نشاط يفوز)
      if (existing.name !== name || (address && existing.address !== address)) {
        return db.client.update({
          where: { id: existing.id },
          data: { name, address: address ?? existing.address, company: companySlug },
        });
      }
      return existing;
    }
  }
  return db.client.create({
    data: { name, phone: phone || null, address, company: companySlug, companyId },
  });
}

/** رقم فاتورة قابل للاستئناف من رقم الطلب — GS-<order> ثم لواحق عند التصادم. */
async function createInvoiceFromOrder(
  company: { id: number; slug: string; currency: string },
  payload: StoresPayload,
): Promise<{ invoiceId: number; invoiceNumber: string }> {
  const order = payload.order!;
  const orderNumber = str(order.number, 60);
  const storeName = str(payload.store?.name, 120) || "متجر Garfix";

  // البنود: الاسم + الكمية + السعر (كلها بنود نصية حرة — كتالوج المتاجر منفصل)
  const items = (Array.isArray(order.items) ? order.items : []).slice(0, 60);
  const lineItems = items.map((it, i) => {
    const qty = Math.max(1, Math.round(numPos(it.quantity) || 1));
    const price = numPos(it.price);
    return {
      id: `gs${i + 1}`,
      name: str(it.name, 200) || "منتج",
      qty,
      price,
      total: +(qty * price).toFixed(3),
    };
  });
  const subtotal = +lineItems.reduce((s, li) => s + li.total, 0).toFixed(3);
  const shipping = +numPos(order.shipping).toFixed(3);
  // المتاجر أسعارها شاملة — لا ضريبة منفصلة على أوامر المتاجر في المرحلة 1
  const total = +(subtotal + shipping).toFixed(3);

  const client = await upsertClient(company.id, company.slug, order.customer);

  const baseNumber = `GS-${orderNumber || Date.now()}`;
  let invoiceNumber = baseNumber;
  let created: Awaited<ReturnType<typeof db.invoice.create>> | null = null;

  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      created = await db.invoice.create({
        data: {
          invoiceNumber,
          companySlug: company.slug,
          companyId: company.id,
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientAddress: client.address,
          issueDate: todayISODate(),
          dueDate: todayISODate(),
          status: "issued",
          lineItems: JSON.stringify(lineItems),
          subtotal,
          taxRate: 0,
          taxAmount: 0,
          total,
          shipping,
          paid: 0,
          notes:
            `طلب ${orderNumber} من ${storeName}` +
            (str(order.affiliateCode, 40) ? ` — مسوّق: ${str(order.affiliateCode, 40)}` : "") +
            " (استُورد تلقائياً من Garfix Stores)",
          source: EXTERNAL_SOURCE,
          externalSource: EXTERNAL_SOURCE,
          externalRef: orderNumber,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        // أي من القيدين الفريدين: إما طلب مستورد سابقاً (idempotent) أو تصادم رقم
        const dupe = await db.invoice.findFirst({
          where: { companySlug: company.slug, externalSource: EXTERNAL_SOURCE, externalRef: orderNumber },
          select: { id: true, invoiceNumber: true },
        });
        if (dupe) return { invoiceId: dupe.id, invoiceNumber: dupe.invoiceNumber }; // سبق استيراده — لا تكرار
        invoiceNumber = `${baseNumber}-${attempt + 2}`; // تصادم ترقيم يدوي → لاحقة
        continue;
      }
      throw err;
    }
  }
  if (!created) throw new Error("تعذر إنشاء الفاتورة بعد المحاولات");
  await invalidateInvoices(company.slug);
  return { invoiceId: created.id, invoiceNumber: created.invoiceNumber };
}

/** تسجيل دفعة تحصيل COD عند التسليم — مرة واحدة لكل أمر (Payment.externalRef فريد). */
async function recordDeliveryPayment(
  invoiceId: number,
  orderNumber: string,
): Promise<boolean> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return false;
  const remaining = +(invoice.total - invoice.paid).toFixed(3);
  if (remaining <= 0.001) return true; // مسددة سلفاً — لا شيء للتسجيل

  try {
    await db.payment.create({
      data: {
        invoiceId,
        amount: remaining,
        method: "cash",
        date: todayISODate(),
        note: `تحصيل عند الاستلام (COD) — طلب ${orderNumber} من Garfix Stores`,
        externalRef: orderNumber,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return true; // سُجلت سابقاً
    throw err;
  }
  await db.invoice.update({
    where: { id: invoiceId },
    data: { paid: +(invoice.paid + remaining).toFixed(3), status: "paid" },
  });
  return true;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-garfix-signature");
  if (!verifySignature(raw, signature)) {
    return NextResponse.json({ error: "توقيع غير صالح" }, { status: 401 });
  }

  let payload: StoresPayload;
  try {
    payload = JSON.parse(raw) as StoresPayload;
  } catch {
    return badRequest("JSON غير صالح");
  }

  const event = str(payload.event, 40);
  const orderNumber = str(payload.order?.number, 60);

  try {
    if (event === "order.created") {
      if (!orderNumber) return badRequest("order.number مطلوب");
      const company = await resolveCompany(str(payload.store?.slug, 80));
      if (!company) {
        return NextResponse.json(
          {
            error:
              "لا توجد شركة ERP مرتبطة بهذا المتجر — اضبط storesSlug للشركة أو GARFIX_STORES_DEFAULT_SLUG",
          },
          { status: 422 },
        );
      }
      const result = await createInvoiceFromOrder(company, payload);
      return NextResponse.json({ ok: true, ...result });
    }

    if (event === "order.status_changed") {
      if (!orderNumber) return badRequest("order.number مطلوب");
      const status = str(payload.order?.status, 30);
      const invoice = await db.invoice.findFirst({
        where: { externalSource: EXTERNAL_SOURCE, externalRef: orderNumber },
      });
      if (!invoice) {
        return NextResponse.json(
          { error: "لا توجد فاتورة مستوردة لهذا الطلب", orderNumber },
          { status: 404 },
        );
      }

      if (status === "delivered") {
        await recordDeliveryPayment(invoice.id, orderNumber);
        await invalidateInvoices(invoice.companySlug ?? undefined);
        return NextResponse.json({ ok: true, invoiceId: invoice.id, paid: true });
      }
      if (status === "shipped") {
        if (["draft", "issued"].includes(invoice.status)) {
          await db.invoice.update({ where: { id: invoice.id }, data: { status: "sent" } });
          await invalidateInvoices(invoice.companySlug ?? undefined);
        }
        return NextResponse.json({ ok: true, invoiceId: invoice.id, shipped: true });
      }
      if (status === "cancelled" || status === "returned") {
        if (["draft", "issued", "sent", "pending", "overdue"].includes(invoice.status)) {
          await db.invoice.update({
            where: { id: invoice.id },
            data: {
              status: "cancelled",
              notes: `${invoice.notes ? invoice.notes + " | " : ""}أُلغي الطلب ${orderNumber} في المتجر`,
            },
          });
          await invalidateInvoices(invoice.companySlug ?? undefined);
        }
        return NextResponse.json({ ok: true, invoiceId: invoice.id, cancelled: true });
      }
      return NextResponse.json({ ok: true, ignored: status });
    }

    return badRequest(`حدث غير مدعوم: ${event || "(فارغ)"}`);
  } catch (err) {
    console.error("[webhooks/stores]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
