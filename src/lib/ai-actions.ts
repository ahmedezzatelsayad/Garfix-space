/**
 * r15: إجراءات المساعد الذكي — طبقة تنفيذ حقيقية للشات الذكي.
 *
 * البروتوكول: المساعد (DeepSeek أو المزوّد المدمج) يقترح إجراءً بكتلة
 * ```garfix-action {"action": "...", "args": {...}}``` في نهاية ردّه،
 * الواجهة تعرضها كبطاقة إجراء، والمستخدم يؤكد بالضغط على «تنفيذ» —
 * فقط عندها يُستدعى /api/ai/action الذي يتحقق وينفّذ هنا.
 *
 * تصميم «إنسان في الحلقة»: لا كتابة على قاعدة البيانات إلا بتأكيد صريح.
 */
import { db } from "@/lib/db";
import { num, todayISODate } from "@/lib/serialize";
import { invalidateCatalog, invalidateClients, invalidateInvoices } from "@/lib/cache";
import { currencyOf, fmtMoneyFor } from "@/lib/currency-shared";

export const AI_ACTIONS = [
  "create_client",
  "create_invoice",
  "register_payment",
  "add_catalog_item",
  "log_reminder",
] as const;

export type AiActionName = (typeof AI_ACTIONS)[number];

export interface ActionContext {
  companySlug?: string | null;
  currency?: string | null;
}

export interface ActionOutcome {
  ok: boolean;
  summary: string; // ملخص عربي يظهر في بطاقة النتيجة
  entity?: Record<string, unknown>; // كيان مُنشأ (id/رقم…) للواجهة
  errors?: string[]; // أخطاء التحقق (عند ok=false قبل التنفيذ)
}

/* ————— أدوات تحقق صغيرة ————— */

const str = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const posNum = (v: unknown): number | null => {
  const n = num(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[+\d][\d\s-]{6,17}$/;

const PAY_METHODS: Record<string, string> = {
  knet: "كي نت",
  cash: "نقدي",
  online: "أونلاين",
  card: "بطاقة",
};
const REMINDER_CHANNELS: Record<string, string> = {
  whatsapp: "واتساب",
  call: "مكالمة",
  manual: "يدوي",
};

/* ————— إنشاء عميل ————— */

async function createClient(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionOutcome> {
  const name = str(args.name, 120);
  const phone = str(args.phone, 24);
  const email = str(args.email, 160);
  const address = str(args.address, 240);
  const errors: string[] = [];
  if (!name) errors.push("اسم العميل مطلوب");
  if (phone && !PHONE.test(phone)) errors.push("رقم الهاتف غير صالح");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("البريد الإلكتروني غير صالح");
  if (errors.length) return { ok: false, summary: "", errors };

  const created = await db.client.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      company: ctx.companySlug || null,
    },
  });
  await invalidateClients();
  return {
    ok: true,
    summary: `تم إنشاء العميل «${name}» بنجاح${phone ? ` — ${phone}` : ""}.`,
    entity: { id: created.id, type: "client", name },
  };
}

/* ————— إنشاء فاتورة ————— */

interface ItemArg {
  name: string;
  qty: number;
  price: number;
}

async function createInvoice(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionOutcome> {
  const clientName = str(args.clientName, 120);
  const clientPhone = str(args.clientPhone, 24);
  const clientEmail = str(args.clientEmail, 160);
  const clientAddress = str(args.clientAddress, 240);
  const notes = str(args.notes, 500);
  const dueDateRaw = str(args.dueDate, 10);
  const itemsRaw = Array.isArray(args.items) ? args.items : [];

  const errors: string[] = [];
  if (!clientName) errors.push("اسم العميل مطلوب");
  if (clientPhone && !PHONE.test(clientPhone)) errors.push("رقم هاتف العميل غير صالح");
  if (dueDateRaw && !ISO_DATE.test(dueDateRaw)) errors.push("تاريخ الاستحقاق يجب أن يكون بصيغة YYYY-MM-DD");
  if (!itemsRaw.length) errors.push("قائمة البنود مطلوبة (على الأقل بند واحد)");

  const items: ItemArg[] = [];
  for (const it of itemsRaw.slice(0, 30)) {
    if (!it || typeof it !== "object") continue;
    const rec = it as Record<string, unknown>;
    const name = str(rec.name, 160);
    const qty = posNum(rec.qty) ?? 1;
    const price = posNum(rec.price);
    if (!name) { errors.push("أحد البنود بلا اسم"); continue; }
    if (price == null) { errors.push(`سعر البند «${name}» غير صالح`); continue; }
    items.push({ name, qty: Math.min(qty, 10000), price });
  }
  if (itemsRaw.length && !items.length) errors.push("لا توجد بنود صالحة");
  if (errors.length) return { ok: false, summary: "", errors };

  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);

  // r29 (C7): ترقيم race-safe — الحساب والإنشاء داخل معاملة واحدة + قيد التفرّد
  // (companySlug, invoiceNumber) في الـ schema؛ عند تعارض متزامن (P2002) تُعاد
  // المحاولة مرة واحدة بترقيم محسوب من جديد.
  const createdFields = {
    companySlug: ctx.companySlug || null,
    clientName,
    clientPhone: clientPhone || null,
    clientEmail: clientEmail || null,
    clientAddress: clientAddress || null,
    issueDate: todayISODate(),
    dueDate: ISO_DATE.test(dueDateRaw) ? dueDateRaw : todayISODate(),
    status: "issued",
    lineItems: JSON.stringify(
      items.map((it) => ({ desc: it.name, qty: it.qty, price: it.price, total: +(it.qty * it.price).toFixed(3) })),
    ),
    subtotal,
    taxRate: 0,
    taxAmount: 0,
    total: subtotal,
    shipping: 0,
    paid: 0,
    notes: notes || `أُنشئت عبر المساعد الذكي — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    source: "smart-chat",
  };

  let created: { id: number; invoiceNumber: string } | null = null;
  for (let attempt = 0; attempt < 2 && !created; attempt++) {
    try {
      created = await db.$transaction(async (tx) => {
        // نفس ترقيم التطبيق: INV + (أكبر رقم رقمي في فواتير الشركة + 1)
        const existing = await tx.invoice.findMany({
          where: ctx.companySlug ? { companySlug: ctx.companySlug } : {},
          select: { invoiceNumber: true },
        });
        const maxN = existing.reduce(
          (m, i) => Math.max(m, parseInt(i.invoiceNumber.replace(/\D/g, "") || "0", 10) || 0),
          0,
        );
        const invoiceNumber = `INV${maxN + 1}`;
        const row = await tx.invoice.create({ data: { ...createdFields, invoiceNumber } });
        return { id: row.id, invoiceNumber };
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempt === 0) continue; // تعارض متزامن → محاولة أخيرة
      return {
        ok: false,
        summary: "",
        errors: [`فشل إنشاء الفاتورة: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }
  if (!created) {
    return { ok: false, summary: "", errors: ["تعارض ترقيم الفواتير — أعد المحاولة بعد لحظات"] };
  }
  const invoiceNumber = created.invoiceNumber;

  await invalidateInvoices(ctx.companySlug ?? undefined);
  const cur = currencyOf(ctx.currency);
  return {
    ok: true,
    summary: `تم إنشاء الفاتورة ${invoiceNumber} للعميل «${clientName}» بإجمالي ${fmtMoneyFor(subtotal, ctx.currency)} (${items.length} بند).`,
    entity: { id: created.id, type: "invoice", invoiceNumber, total: subtotal, currency: cur.code },
  };
}

/* ————— تسجيل دفعة ————— */

async function registerPayment(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionOutcome> {
  const invoiceNumber = str(args.invoiceNumber, 40);
  const amount = posNum(args.amount);
  const method = str(args.method, 12).toLowerCase();
  const dateRaw = str(args.date, 10);
  const note = str(args.note, 300);
  const errors: string[] = [];
  if (!invoiceNumber) errors.push("رقم الفاتورة مطلوب");
  if (amount == null) errors.push("المبلغ يجب أن يكون أكبر من صفر");
  if (method && !(method in PAY_METHODS)) errors.push("طريقة الدفع يجب أن تكون: cash / knet / online / card");
  if (dateRaw && !ISO_DATE.test(dateRaw)) errors.push("التاريخ يجب أن يكون بصيغة YYYY-MM-DD");
  if (errors.length) return { ok: false, summary: "", errors };

  // r29 (C7): قراءة-تحقق-كتابة داخل معاملة واحدة (كانت خارجها فتُتجاوز حالات
  // التزامن وتُدفع فاتورة مرتين) — نفس نمط مسار المدفوعات الرسمي.
  const result = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        invoiceNumber,
        ...(ctx.companySlug ? { companySlug: ctx.companySlug } : {}),
      },
    });
    if (!invoice) {
      return {
        ok: false as const,
        errors: [
          `لم يتم العثور على فاتورة برقم ${invoiceNumber}${ctx.companySlug ? " في هذه الشركة" : ""}`,
        ],
      };
    }

    const total = num(invoice.subtotal) + num(invoice.taxAmount) + num(invoice.shipping);
    const paid = num(invoice.paid);
    const remaining = total - paid;
    if (amount! > remaining + 1e-9) {
      return {
        ok: false as const,
        errors: [`المبلغ ${amount} يتجاوز المتبقي على الفاتورة (${fmtMoneyFor(remaining, ctx.currency)})`],
      };
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: amount!,
        method: method in PAY_METHODS ? method : "knet",
        date: ISO_DATE.test(dateRaw) ? dateRaw : todayISODate(),
        note: note || `سُجّلت عبر المساعد الذكي`,
      },
    });
    await tx.invoice.update({ where: { id: invoice.id }, data: { paid: paid + amount! } });
    return { ok: true as const, paymentId: payment.id, method: payment.method, remaining: remaining - amount! };
  });

  if (!result.ok) return { ok: false, summary: "", errors: result.errors };

  await invalidateInvoices(ctx.companySlug ?? undefined);
  return {
    ok: true,
    summary: `تم تسجيل دفعة ${fmtMoneyFor(amount, ctx.currency)} (${PAY_METHODS[result.method]}) على الفاتورة ${invoiceNumber} — المتبقي ${fmtMoneyFor(result.remaining, ctx.currency)}.`,
    entity: { id: result.paymentId, type: "payment", invoiceNumber, amount },
  };
}

/* ————— إضافة صنف كتالوج ————— */

async function addCatalogItem(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionOutcome> {
  const name = str(args.name, 160);
  const sellingPrice = posNum(args.sellingPrice);
  const purchasePrice = posNum(args.purchasePrice);
  const aliases = Array.isArray(args.aliases)
    ? args.aliases.filter((a): a is string => typeof a === "string").slice(0, 10).map((a) => a.trim()).filter(Boolean)
    : [];
  const errors: string[] = [];
  if (!name) errors.push("اسم الصنف مطلوب");
  if (args.sellingPrice != null && sellingPrice == null) errors.push("سعر البيع غير صالح");
  if (args.purchasePrice != null && purchasePrice == null) errors.push("سعر الشراء غير صالح");
  if (errors.length) return { ok: false, summary: "", errors };

  const created = await db.productCatalog.create({
    data: {
      name,
      sellingPrice: sellingPrice ?? null,
      purchasePrice: purchasePrice ?? null,
      aliases: JSON.stringify(aliases),
      companySlug: ctx.companySlug || null,
    },
  });
  await invalidateCatalog(ctx.companySlug ?? undefined);
  return {
    ok: true,
    summary: `تمت إضافة «${name}» إلى الكتالوج${sellingPrice != null ? ` بسعر بيع ${fmtMoneyFor(sellingPrice, ctx.currency)}` : ""}${purchasePrice != null ? ` (شراء ${fmtMoneyFor(purchasePrice, ctx.currency)})` : ""}.`,
    entity: { id: created.id, type: "catalog_item", name },
  };
}

/* ————— تسجيل تذكير ————— */

async function logReminder(args: Record<string, unknown>, ctx: ActionContext): Promise<ActionOutcome> {
  const clientName = str(args.clientName, 120);
  const clientPhone = str(args.clientPhone, 24);
  const channel = str(args.channel, 20).toLowerCase();
  const message = str(args.message, 1000);
  const invoiceNumber = str(args.invoiceNumber, 40);
  const errors: string[] = [];
  if (!clientName && !invoiceNumber) errors.push("اسم العميل أو رقم الفاتورة مطلوب");
  if (channel && !(channel in REMINDER_CHANNELS)) errors.push("القناة يجب أن تكون: whatsapp / call / manual");
  if (errors.length) return { ok: false, summary: "", errors };

  let invoiceId: number | null = null;
  let resolvedName = clientName;
  let resolvedPhone = clientPhone;
  if (invoiceNumber) {
    const inv = await db.invoice.findFirst({
      where: { invoiceNumber, ...(ctx.companySlug ? { companySlug: ctx.companySlug } : {}) },
    });
    if (!inv) return { ok: false, summary: "", errors: [`لم يتم العثور على فاتورة برقم ${invoiceNumber}`] };
    invoiceId = inv.id;
    resolvedName = resolvedName || inv.clientName;
    resolvedPhone = resolvedPhone || inv.clientPhone || "";
  }

  const created = await db.reminderLog.create({
    data: {
      invoiceId,
      companySlug: ctx.companySlug || null,
      clientName: resolvedName || null,
      clientPhone: resolvedPhone || null,
      channel: channel in REMINDER_CHANNELS ? channel : "whatsapp",
      message: message || null,
    },
  });
  return {
    ok: true,
    summary: `تم تسجيل تذكير ${REMINDER_CHANNELS[created.channel]} لـ «${resolvedName || "العميل"}»${message ? ` — «${message.slice(0, 60)}»` : ""}.`,
    entity: { id: created.id, type: "reminder", clientName: resolvedName },
  };
}

/* ————— المُوزِّع ————— */

const EXECUTORS: Record<AiActionName, (args: Record<string, unknown>, ctx: ActionContext) => Promise<ActionOutcome>> = {
  create_client: createClient,
  create_invoice: createInvoice,
  register_payment: registerPayment,
  add_catalog_item: addCatalogItem,
  log_reminder: logReminder,
};

export function isAiAction(v: unknown): v is AiActionName {
  return typeof v === "string" && (AI_ACTIONS as readonly string[]).includes(v);
}

/** تنفيذ إجراء بعد تحقق صارم — يرمي فقط عند فشل قاعدة البيانات غير المتوقع */
export async function executeAiAction(
  action: AiActionName,
  args: Record<string, unknown>,
  ctx: ActionContext,
): Promise<ActionOutcome> {
  const fn = EXECUTORS[action];
  if (!fn) return { ok: false, summary: "", errors: ["إجراء غير معروف"] };
  return fn(args && typeof args === "object" ? args : {}, ctx);
}

/* ————— وصف بروتوكول الإجراءات (يُحقن في system prompt) ————— */

export function actionProtocolPrompt(): string {
  return [
    "— أدوات تنفيذية (إجراءات حقيقية في النظام):",
    "عندما يطلب المستخدم إنشاء/تسجيل شيء (عميل، فاتورة، دفعة، صنف كتالوج، تذكير)، اقترح الإجراء بإضافة كتلة كود واحدة بهذا الشكل تماماً في نهاية ردك (بعد شرحك النصي):",
    "```garfix-action",
    '{"action": "create_invoice", "args": {"clientName": "سارة", "clientPhone": "+96595544332", "items": [{"name": "منتج", "qty": 2, "price": 15.5}], "dueDate": "2025-02-01", "notes": "أسباب"}}',
    "```",
    "الإجراءات المتاحة وحقول args:",
    '1) create_client: {name*, phone?, email?, address?}',
    '2) create_invoice: {clientName*, clientPhone?, clientEmail?, clientAddress?, items*:[{name*, qty, price*}], dueDate?(YYYY-MM-DD), notes?}',
    '3) register_payment: {invoiceNumber*, amount*, method?(cash|knet|online|card), date?(YYYY-MM-DD), note?}',
    '4) add_catalog_item: {name*, sellingPrice?, purchasePrice?, aliases?:[]}',
    '5) log_reminder: {clientName*, clientPhone?, channel?(whatsapp|call|manual), message?, invoiceNumber?}',
    "قواعد صارمة: بداية السطر بثلاثة backticks ثم garfix-action ثم سطر JSON صالح واحد ثم ثلاثة backticks — بلا أي نص داخل الكتلة عدا الـ JSON. الأرقام أرقام عربية غربية (123). استخرج الحقول من كلام المستخدم حرفياً ولا تخترع أسعاراً؛ إن غاب السعر اسأل عنه في نصك ولا تُصدر الإجراء. المستخدم سيشاهد بطاقة الإجراء ويؤكد التنفيذ بنفسه. لا تُصدر أكثر من كتلة إجراء واحدة في الرد إلا إذا طلب المستخدم عمليات متعددة صراحةً (حتى 3).",
  ].join("\n");
}
