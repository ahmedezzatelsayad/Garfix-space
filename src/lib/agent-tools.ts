/**
 * المرحلة 2 (Agent Engine): صندوق أدوات الوكيل — 8 أدوات حقيقية فوق بيانات ERP.
 *
 * التصميم:
 *  - كل أداة تُعلن عن نوعها: read (آمنة) أو write (تلمس قاعدة البيانات).
 *  - لا توجد أي أداة حذف إطلاقاً — الحذف غير متاح للوكيل بحكم البنية
 *    (whitelist مغلق: أي اسم أداة خارج القائمة → NO_SUCH_TOOL محجوب ومدوَّن).
 *  - الحواجز الأمنية (guardrails) داخل runTool وليس داخل الأدوات نفسها:
 *      1. READONLY_MODE — وضع القراءة الافتراضي يحجب أدوات الكتابة حتى
 *         يؤكد المستخدم (بطاقة تأكيد) أو يشغّل وضع «تنفيذ تلقائي».
 *      2. AMOUNT_CAP — سقف مالي (AGENT_AMOUNT_CAP، افتراضي 5000) لأي
 *         عملية ذات أثر مالي (إلغاء فاتورة بمبلغ كبير…).
 *      3. NOT_ADMIN — إنشاء الشركة/المتجر يتطلب مديراً أو مشتركاً يملك الشركة.
 *  - كل استدعاء — نجح أو حُجب — يُدوَّن في agent_audit_log (المساءلة الكاملة).
 */
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { num, invoiceTotal, invoicePaymentStatus, INVOICE_STATUSES } from "@/lib/serialize";
import { invalidateInvoices, invalidateClients, cacheDelPattern } from "@/lib/cache";
import { currencyOf, fmtMoneyFor } from "@/lib/currency-shared";

/* ————— الأنواع ————— */

export type ToolKind = "read" | "write";

export interface ToolOutcome {
  ok: boolean;
  /** ملخص عربي موجّه للنموذج (ماذا حدث / ماذا وجد) */
  summary: string;
  /** بيانات منظمة اختيارية للنموذج */
  data?: Record<string, unknown>;
  /** كود الحاجز الأمني إن حُجب التنفيذ */
  blocked?: string;
}

export interface AgentToolContext {
  companySlug: string | null;
  currency: string | null;
  userEmail: string;
  isAdmin: boolean;
  /** readonly (افتراضي) | auto (تنفيذ تلقائي) | confirmed (بعد تأكيد المستخدم) */
  mode: "readonly" | "auto" | "confirmed";
  runId: string;
  step: number;
}

export interface AgentTool {
  name: string;
  kind: ToolKind;
  /** وصف عربي يُحقن في الـ system prompt */
  desc: string;
  /** مخطط الوسائط (نصي) للنموذج */
  argsHint: string;
  exec: (args: Record<string, unknown>, ctx: AgentToolContext) => Promise<ToolOutcome>;
}

/* ————— أدوات تحقق صغيرة ————— */

const str = (v: unknown, max = 200): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const posInt = (v: unknown, max: number, dflt: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return dflt;
  return Math.min(Math.round(n), max);
};

const latinSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

/** سقف المبالغ التي يلمسها الوكيل (دينار كويتي افتراضياً) — حاجز AMOUNT_CAP */
export const AGENT_AMOUNT_CAP = (() => {
  const n = parseFloat(process.env.AGENT_AMOUNT_CAP || "");
  return Number.isFinite(n) && n > 0 ? n : 5000;
})();

/* ————— 1) search — بحث عام (read) ————— */

const toolSearch: AgentTool = {
  name: "search",
  kind: "read",
  desc: "بحث عام بالاسم/الرقم في فواتير الشركة وعملائها وكتالوجها. استخدمها قبل أي إجابة عن كيان معين (عميل بالاسم، فاتورة برقمها، صنف بالاسم).",
  argsHint: '{"query": "سارة أو INV1001 أو ساعة", "type": "all|invoices|clients|catalog"}',
  exec: async (args, ctx) => {
    const q = str(args.query, 120);
    if (!q) return { ok: false, summary: "أدخل كلمة البحث في args.query", blocked: "INVALID_ARGS" };
    const type = ["all", "invoices", "clients", "catalog"].includes(str(args.type, 10))
      ? str(args.type, 10)
      : "all";
    const where = ctx.companySlug ? { companySlug: ctx.companySlug } : {};
    const like = { contains: q, mode: "insensitive" as const };

    const [inv, cli, cat] = await Promise.all([
      type === "all" || type === "invoices"
        ? db.invoice.findMany({
            where: {
              ...where,
              OR: [{ invoiceNumber: like }, { clientName: like }, { notes: like }],
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      type === "all" || type === "clients"
        ? db.client.findMany({
            where: {
              ...(ctx.companySlug ? { company: ctx.companySlug } : {}),
              OR: [{ name: like }, { phone: { contains: q } }, { email: like }],
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      type === "all" || type === "catalog"
        ? db.productCatalog.findMany({
            where: { ...where, OR: [{ name: like }] },
            orderBy: { createdAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    const invLines = inv.map(
      (i) =>
        `${i.invoiceNumber} | ${i.clientName} | ${fmtMoneyFor(invoiceTotal(i), ctx.currency)} | دفع: ${invoicePaymentStatus(i)} | ${i.status}`,
    );
    const cliLines = cli.map((c) => `${c.name}${c.phone ? ` (${c.phone})` : ""}${c.email ? ` — ${c.email}` : ""}`);
    const catLines = cat.map(
      (c) => `${c.name}: بيع ${fmtMoneyFor(c.sellingPrice, ctx.currency)} / شراء ${fmtMoneyFor(c.purchasePrice, ctx.currency)}`,
    );

    const parts: string[] = [];
    if (invLines.length) parts.push(`فواتير مطابقة:\n- ${invLines.join("\n- ")}`);
    if (cliLines.length) parts.push(`عملاء مطابقون:\n- ${cliLines.join("\n- ")}`);
    if (catLines.length) parts.push(`أصناف مطابقة:\n- ${catLines.join("\n- ")}`);
    if (!parts.length) {
      return {
        ok: true,
        summary: `لا نتائج لـ «${q}» في ${ctx.companySlug ? "هذه الشركة" : "النظام"}.`,
        data: { query: q, matches: 0 },
      };
    }
    return {
      ok: true,
      summary: parts.join("\n\n"),
      data: { query: q, invoices: inv.length, clients: cli.length, catalog: cat.length },
    };
  },
};

/* ————— 2) list_invoices — فواتير (read) ————— */

const toolListInvoices: AgentTool = {
  name: "list_invoices",
  kind: "read",
  desc: "قائمة فواتير الشركة مع فلترة اختيارية بالحالة أو حالة الدفع. حد أقصى 20 فاتورة في الرد.",
  argsHint: '{"status": "issued|sent|paid|cancelled|draft|overdue|pending", "payStatus": "unpaid|partial|paid", "limit": 10}',
  exec: async (args, ctx) => {
    const status = INVOICE_STATUSES.includes(str(args.status, 20) as (typeof INVOICE_STATUSES)[number])
      ? str(args.status, 20)
      : undefined;
    const payStatusRaw = ["unpaid", "partial", "paid"].includes(str(args.payStatus, 10))
      ? str(args.payStatus, 10)
      : undefined;
    const limit = posInt(args.limit, 20, 10);

    const rows = await db.invoice.findMany({
      where: {
        ...(ctx.companySlug ? { companySlug: ctx.companySlug } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const payMap: Record<string, string> = { unp: "unpaid", part: "partial", paid: "paid" };
    const filtered = payStatusRaw
      ? rows.filter((r) => payMap[invoicePaymentStatus(r)] === payStatusRaw)
      : rows;
    const shown = filtered.slice(0, limit);
    const lines = shown.map(
      (i) =>
        `- ${i.invoiceNumber} | ${i.clientName} | إجمالي ${fmtMoneyFor(invoiceTotal(i), ctx.currency)} | مدفوع ${fmtMoneyFor(i.paid, ctx.currency)} | حالة ${i.status} | دفع ${invoicePaymentStatus(i)} | استحقاق ${i.dueDate}`,
    );
    return {
      ok: true,
      summary: lines.length
        ? `أحدث ${shown.length} فاتورة (من أصل ${filtered.length} مطابقة):\n${lines.join("\n")}`
        : "لا توجد فواتير مطابقة للفلتر.",
      data: { count: filtered.length, shown: shown.length },
    };
  },
};

/* ————— 3) list_customers — عملاء (read) ————— */

const toolListCustomers: AgentTool = {
  name: "list_customers",
  kind: "read",
  desc: "قائمة عملاء الشركة مع عدد فواتير كل عميل ومديونيته الحالية (المتبقي غير المحصّل).",
  argsHint: '{"limit": 15}',
  exec: async (args, ctx) => {
    const limit = posInt(args.limit, 20, 15);
    const clients = await db.client.findMany({
      where: ctx.companySlug ? { company: ctx.companySlug } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    if (!clients.length) return { ok: true, summary: "لا يوجد عملاء في هذا النطاق." };

    const invoices = await db.invoice.findMany({
      where: ctx.companySlug ? { companySlug: ctx.companySlug } : {},
      select: { clientName: true, subtotal: true, taxAmount: true, shipping: true, paid: true, status: true },
    });
    const byName = new Map<string, { outstanding: number; count: number }>();
    for (const inv of invoices) {
      const key = (inv.clientName || "").trim();
      if (!key) continue;
      const prev = byName.get(key) ?? { outstanding: 0, count: 0 };
      prev.count++;
      if (invoicePaymentStatus(inv) !== "paid" && inv.status !== "cancelled") {
        prev.outstanding += invoiceTotal(inv) - num(inv.paid);
      }
      byName.set(key, prev);
    }
    const lines = clients.slice(0, limit).map((c) => {
      const agg = byName.get(c.name.trim()) ?? { outstanding: 0, count: 0 };
      return `- ${c.name}${c.phone ? ` (${c.phone})` : ""} | ${agg.count} فاتورة | مديونية ${fmtMoneyFor(agg.outstanding, ctx.currency)}`;
    });
    return {
      ok: true,
      summary: `العملاء (آخر ${Math.min(limit, clients.length)} من ${clients.length}):\n${lines.join("\n")}`,
      data: { clients: clients.length },
    };
  },
};

/* ————— 4) list_payments — مدفوعات (read) ————— */

const toolListPayments: AgentTool = {
  name: "list_payments",
  kind: "read",
  desc: "آخر المدفوعات المسجلة على فواتير الشركة (المبلغ، الطريقة، التاريخ، الفاتورة).",
  argsHint: '{"limit": 10}',
  exec: async (args, ctx) => {
    const limit = posInt(args.limit, 20, 10);
    const payments = await db.payment.findMany({
      where: ctx.companySlug ? { invoice: { companySlug: ctx.companySlug } } : {},
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { invoice: { select: { invoiceNumber: true, companySlug: true } } },
    });
    if (!payments.length) return { ok: true, summary: "لا توجد مدفوعات مسجلة في هذا النطاق." };
    const METHOD_AR: Record<string, string> = { knet: "كي نت", cash: "نقدي", online: "أونلاين", card: "بطاقة" };
    const lines = payments.map(
      (p) =>
        `- ${fmtMoneyFor(p.amount, ctx.currency)} (${METHOD_AR[p.method] || p.method}) على ${p.invoice?.invoiceNumber ?? "—"} | ${p.date}${p.note ? ` | ${p.note.slice(0, 60)}` : ""}`,
    );
    const total = payments.reduce((s, p) => s + p.amount, 0);
    return {
      ok: true,
      summary: `آخر ${payments.length} دفعة (إجمالي ${fmtMoneyFor(total, ctx.currency)}):\n${lines.join("\n")}`,
      data: { payments: payments.length, total },
    };
  },
};

/* ————— 5) company_stats — إحصائيات (read) ————— */

const toolCompanyStats: AgentTool = {
  name: "company_stats",
  kind: "read",
  desc: "المؤشرات الحية للشركة الحالية (أو كل الشركات للمدير بلا شركة محددة): الإيرادات، المستحقات، المتأخرات، عدد الفواتير/العملاء.",
  argsHint: "{}",
  exec: async (_args, ctx) => {
    const where = ctx.companySlug ? { companySlug: ctx.companySlug } : {};
    const [invoices, clientsCount, paymentsCount, catalogCount] = await Promise.all([
      db.invoice.findMany({ where, select: { subtotal: true, taxAmount: true, shipping: true, paid: true, status: true } }),
      db.client.count({ where: ctx.companySlug ? { company: ctx.companySlug } : {} }),
      db.payment.count({ where: ctx.companySlug ? { invoice: { companySlug: ctx.companySlug } } : {} }),
      db.productCatalog.count({ where }),
    ]);

    let revenue = 0;
    let outstanding = 0;
    let overdue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    for (const inv of invoices) {
      const tot = invoiceTotal(inv);
      const paid = num(inv.paid);
      const ps = invoicePaymentStatus(inv);
      if (ps === "paid") {
        revenue += tot;
        paidCount++;
      } else if (ps === "part") {
        revenue += paid;
        outstanding += tot - paid;
      } else if (ps !== "cancel") {
        outstanding += tot;
        unpaidCount++;
      }
      if (inv.status === "overdue") overdue++;
    }

    const cur = ctx.currency;
    return {
      ok: true,
      summary: [
        `📊 مؤشرات ${ctx.companySlug || "كل الشركات"}:`,
        `- الفواتير: ${invoices.length} (مدفوعة ${paidCount}، غير محصّلة ${unpaidCount})`,
        `- الإيرادات المحققة: ${fmtMoneyFor(revenue, cur)}`,
        `- المستحقات غير المحصّلة: ${fmtMoneyFor(outstanding, cur)} (منها ${overdue} فاتورة متأخرة عن الاستحقاق)`,
        `- العملاء: ${clientsCount} | المدفوعات المسجلة: ${paymentsCount} | أصناف الكتالوج: ${catalogCount}`,
      ].join("\n"),
      data: {
        invoices: invoices.length,
        revenue: +revenue.toFixed(3),
        outstanding: +outstanding.toFixed(3),
        overdue,
        clients: clientsCount,
      },
    };
  },
};

/* ————— 6) create_company — إنشاء شركة (write) ————— */

/** إنشاء سجل شركة داخلياً (يستخدمه الوكيل مباشرة — نفس منطق /api/companies بدون HTTP) */
async function createCompanyRecord(
  args: Record<string, unknown>,
  ownerEmail: string | null,
  ctx: AgentToolContext,
): Promise<{ company: { id: number; slug: string; code: string; name: string; currency: string }; created: boolean }> {
  const name = str(args.name, 120);
  const nameAr = str(args.nameAr, 120) || name;
  const currency = (str(args.currency, 3) || "KWD").toUpperCase();
  const code = str(args.code, 24)?.toLowerCase().replace(/[^a-z0-9-]/g, "") || latinSlug(name);
  const city = str(args.city, 80);
  const phone = str(args.phone, 24);
  const emoji = str(args.emoji, 8) || "🏢";

  let slug = `tw_inv_${code}_v1`;
  // تفرد code/slug — لواحق رقمية تصاعدية عند التصادم
  for (let i = 1; ; i++) {
    const dupCode = await db.company.findFirst({ where: { code } });
    const dupSlug = await db.company.findUnique({ where: { slug } });
    if (!dupCode && !dupSlug) break;
    if (i > 20) throw new Error("تعذر توليد مفتاح فريد للشركة");
    const suffix = i > 1 ? `${i + 1}` : "2";
    slug = `tw_inv_${code}${i > 1 ? suffix : ""}_v1`;
  }

  const row = await db.company.create({
    data: {
      name,
      nameAr,
      slug,
      code,
      currency,
      phone: phone || null,
      city: city || null,
      emoji,
      logo: emoji,
      color: "#334155",
      accent: "#64748b",
      cardBg: "#f1f5f9",
      firebaseOwnerId: ownerEmail,
      // وكيل جرفِكس لا يفعّل ضريبة افتراضياً — قرار مالي يبقى للبشر
      taxEnabled: false,
      defaultTaxRate: null,
    },
  });
  void ctx;

  // ربط الشركة بصاحبها المشترك إن كان منشئها مشتركاً (نفس سلوك /api/companies)
  if (ownerEmail) {
    const appUser = await db.appUser.findUnique({ where: { email: ownerEmail } });
    if (appUser) {
      let companies: string[] = [];
      try { companies = JSON.parse(appUser.companies) as string[]; } catch { companies = []; }
      await db.appUser.update({
        where: { email: ownerEmail },
        data: { companies: JSON.stringify([...new Set([...companies, row.slug])]) },
      });
    }
  }

  await cacheDelPattern("companies:*");
  await cacheDelPattern("ai:ctx:*");
  return { company: { id: row.id, slug: row.slug, code: row.code ?? row.slug, name: row.name, currency: row.currency }, created: true };
}

const toolCreateCompany: AgentTool = {
  name: "create_company",
  kind: "write",
  desc:
    "إنشاء شركة جديدة في ERP. تتطلب اسم الشركة (إنجليزي أو عربي) — البقية اختيارية (العملة KWD افتراضياً، المدينة، الهاتف، إيموجي). " +
    "المدير ينشئ أي شركة؛ المشترك المسجّل تنشأ الشركة ملكاً له.",
  argsHint: '{"name": "Threads Co", "nameAr": "شركة الثريدز للملابس", "currency": "KWD", "city": "الكويت", "phone": "+965...", "emoji": "👕"}',
  exec: async (args, ctx) => {
    const name = str(args.name, 120) || str(args.nameAr, 120);
    if (!name) return { ok: false, summary: "اسم الشركة مطلوب (name أو nameAr)", blocked: "INVALID_ARGS" };

    // المشترك غير المالك لمجال الشركات → ملكية الشركة ستكون له تلقائياً
    const { company } = await createCompanyRecord(
      { name, nameAr: str(args.nameAr, 120) || name, ...args },
      ctx.isAdmin ? null : ctx.userEmail,
      ctx,
    );
    return {
      ok: true,
      summary: `تم إنشاء الشركة «${company.name}» (كود: ${company.code} — عملة: ${company.currency}).`,
      data: { company },
    };
  },
};

/* ————— 7) create_store — إنشاء متجر Garfix Stores (write — اللحظة الفاصلة) ————— */

export interface StoreProvisionResult {
  ok: boolean;
  created?: boolean;
  store?: { slug: string; name: string; url?: string };
  affiliate?: { code?: string };
  error?: string;
}

/** استدعاء منصة المتاجر لتجهيز متجر (HMAC بنفس سر الـ webhooks) — server-to-server */
export async function provisionStoreInStores(
  store: { slug: string; name: string; tagline?: string; whatsapp?: string },
  owner: { name: string; email?: string; phone?: string },
): Promise<StoreProvisionResult> {
  const base = (process.env.STORES_BASE_URL || "").replace(/\/$/, "");
  const secret = process.env.GARFIX_WEBHOOK_SECRET || "";
  if (!base || !secret) {
    return { ok: false, error: "STORES_UNREACHABLE: تكامل المتاجر غير مضبوط (STORES_BASE_URL / GARFIX_WEBHOOK_SECRET)" };
  }
  const raw = JSON.stringify({ store, owner, sentAt: new Date().toISOString() });
  const sig = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  try {
    const res = await fetch(`${base}/api/webhooks/erp/provision-store`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Garfix-Signature": `sha256=${sig}` },
      body: raw,
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: `STORES_UNREACHABLE: ${(data.error as string) || `HTTP ${res.status}`}` };
    }
    return {
      ok: true,
      created: data.created === true,
      store: (data.store as StoreProvisionResult["store"]) ?? undefined,
      affiliate: (data.affiliate as StoreProvisionResult["affiliate"]) ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: `STORES_UNREACHABLE: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const toolCreateStore: AgentTool = {
  name: "create_store",
  kind: "write",
  desc:
    "اللحظة الفاصلة: إنشاء متجر حقيقي في منصة Garfix Stores وربطه بشركة ERP — كل طلبات المتجر (COD) ستتحول فواتير تلقائياً لهذه الشركة عبر webhooks. " +
    "إذا لم تُمرّر شركة موجودة، يمكن للأداة إنشاء الشركة أولاً ثم المتجر (شركة + متجر بجملة واحدة). " +
    "storeSlug: حروف إنجليزية صغيرة/أرقام/شرطات (3-30) — يُشتق من اسم الشركة عند غيابه.",
  argsHint:
    '{"companySlug": "tw_inv_threads_v1", "companyName": "Threads Co", "nameAr": "شركة ملابس", "storeSlug": "threads-co", "storeName": "Threads — ملابس", "tagline": "أحدث صيحات الملابس", "whatsapp": "+965..."}',
  exec: async (args, ctx) => {
    // 1) حلّ الشركة المستهدفة: موجودة (slug) أو جديدة (اسم)
    let company: { id: number; slug: string; code: string; name: string; currency: string } | null = null;
    let companyCreated = false;

    const existingSlug = str(args.companySlug, 60);
    if (existingSlug) {
      const found = await db.company.findUnique({ where: { slug: existingSlug } });
      if (!found) return { ok: false, summary: `لا توجد شركة بالمفتاح «${existingSlug}»`, blocked: "INVALID_ARGS" };
      // ملكية: المدير يربط أي شركة؛ المشترك شركاته فقط
      if (!ctx.isAdmin) {
        const appUser = await db.appUser.findUnique({ where: { email: ctx.userEmail } });
        let owned: string[] = [];
        try { owned = appUser ? (JSON.parse(appUser.companies) as string[]) : []; } catch { owned = []; }
        if (!owned.includes(found.slug)) {
          return { ok: false, summary: "لا يمكنك ربط متجر بشركة ليست ضمن شركاتك", blocked: "NOT_ADMIN" };
        }
      }
      if (found.storesSlug) {
        return {
          ok: false,
          summary: `الشركة «${found.name}» مرتبطة أصلاً بمتجر «${found.storesSlug}» — متجر واحد لكل شركة.`,
          blocked: "INVALID_ARGS",
        };
      }
      company = { id: found.id, slug: found.slug, code: found.code || found.slug, name: found.name, currency: found.currency };
    } else {
      const name = str(args.companyName, 120) || str(args.nameAr, 120);
      if (name) {
        const res = await createCompanyRecord(
          { name, nameAr: str(args.nameAr, 120) || name, ...args },
          ctx.isAdmin ? null : ctx.userEmail,
          ctx,
        );
        company = res.company;
        companyCreated = true;
      } else if (ctx.companySlug) {
        const found = await db.company.findUnique({ where: { slug: ctx.companySlug } });
        if (!found) return { ok: false, summary: "الشركة الحالية غير موجودة", blocked: "INVALID_ARGS" };
        if (found.storesSlug) {
          return {
            ok: false,
            summary: `الشركة «${found.name}» مرتبطة أصلاً بمتجر «${found.storesSlug}».`,
            blocked: "INVALID_ARGS",
          };
        }
        company = { id: found.id, slug: found.slug, code: found.code || found.slug, name: found.name, currency: found.currency };
      } else {
        return {
          ok: false,
          summary: "مرّر شركة موجودة (companySlug) أو اسم شركة جديدة (companyName) لإنشائها مع المتجر.",
          blocked: "INVALID_ARGS",
        };
      }
    }

    // 2) معرّف المتجر
    const storeSlug =
      str(args.storeSlug, 30)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || latinSlug(company.code || company.name);
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(storeSlug)) {
      return { ok: false, summary: `معرف المتجر «${storeSlug}» غير صالح — 3-30 حرف إنجليزي صغير/أرقام/شرطات.`, blocked: "INVALID_ARGS" };
    }

    // 3) جهّز المتجر في منصة Stores (server-to-server موقّع)
    const storeName = str(args.storeName, 60) || company.name;
    const provision = await provisionStoreInStores(
      {
        slug: storeSlug,
        name: storeName,
        tagline: str(args.tagline, 120) || undefined,
        whatsapp: str(args.whatsapp, 20) || undefined,
      },
      { name: ctx.userEmail, email: ctx.userEmail },
    );
    if (!provision.ok) {
      const note = companyCreated
        ? ` أُنشئت الشركة «${company.name}» في ERP لكن تجهيز المتجر فشل — أعِد المحاولة بـ companySlug=${company.slug}.`
        : "";
      return { ok: false, summary: `${provision.error}${note}`, blocked: "STORES_UNREACHABLE" };
    }

    // 4) اربط الشركة بالمتجر (كل أوامر المتجر → فواتير هذه الشركة)
    await db.company.update({ where: { id: company.id }, data: { storesSlug: storeSlug } });
    await cacheDelPattern("companies:*");
    await invalidateClients();

    const storeUrl = `${(process.env.STORES_BASE_URL || "").replace(/\/$/, "")}/store/${storeSlug}`;
    return {
      ok: true,
      summary:
        `تم إنشاء المتجر «${storeName}» (${provision.created ? "جديد" : "موجود"}) وربطه ${companyCreated ? "بالشركة الجديدة" : "بالشركة"} «${company.name}».\n` +
        `- رابط المتجر: ${storeUrl}\n` +
        `- كل طلب COD في المتجر سيصبح فاتورة تلقائياً في ERP لهذه الشركة، وعند التسليم تُسجَّل الدفعة وتُسدَّد الفاتورة.`,
      data: {
        company: { slug: company.slug, name: company.name, created: companyCreated },
        store: { slug: storeSlug, name: storeName, url: storeUrl },
        affiliateCode: provision.affiliate?.code,
      },
    };
  },
};

/* ————— 8) update_invoice_status — تحديث حالة فاتورة (write + حاجز السقف المالي) ————— */

/** تحولات مسموحة — الوكيل لا يستطيع التراجع عن حالة نهائية */
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(["issued", "sent", "cancelled"]),
  issued: new Set(["sent", "paid", "overdue", "cancelled"]),
  sent: new Set(["paid", "overdue", "cancelled"]),
  pending: new Set(["issued", "sent", "paid", "cancelled"]),
  overdue: new Set(["paid", "sent", "cancelled"]),
  paid: new Set(), // نهائية — لا يلمسها الوكيل
  cancelled: new Set(), // نهائية — لا يلمسها الوكيل
};

const toolUpdateStatus: AgentTool = {
  name: "update_invoice_status",
  kind: "write",
  desc:
    "تحديث حالة فاتورة (صادرة → مُرسلة → مدفوعة…). الحالات النهائية (مدفوعة/ملغاة) لا تُرجَع أبداً. " +
    "الوسم «مدفوعة» يتطلب أن تغطي الدفعات المبلغ فعلاً، والإلغاء ممنوع على فاتورة عليها دفعات أو تتجاوز السقف المالي.",
  argsHint: '{"invoiceNumber": "INV1001", "status": "sent|paid|cancelled|issued|overdue"}',
  exec: async (args, ctx) => {
    const invoiceNumber = str(args.invoiceNumber, 40) || str(args.id, 40);
    const status = str(args.status, 20).toLowerCase();
    if (!invoiceNumber) return { ok: false, summary: "رقم الفاتورة مطلوب (invoiceNumber)", blocked: "INVALID_ARGS" };
    if (!INVOICE_STATUSES.includes(status as (typeof INVOICE_STATUSES)[number])) {
      return { ok: false, summary: `حالة غير معروفة: ${status}`, blocked: "INVALID_ARGS" };
    }

    const invoice = await db.invoice.findFirst({
      where: { invoiceNumber, ...(ctx.companySlug ? { companySlug: ctx.companySlug } : {}) },
    });
    if (!invoice) return { ok: false, summary: `لا توجد فاتورة «${invoiceNumber}» في هذا النطاق.`, blocked: "INVALID_ARGS" };

    if (!ALLOWED_TRANSITIONS[invoice.status]?.has(status)) {
      return {
        ok: false,
        summary: `انتقال غير مسموح: «${invoice.status}» → «${status}». الحالات النهائية (paid/cancelled) لا تُعدَّل.`,
        blocked: "INVALID_ARGS",
      };
    }

    const total = invoiceTotal(invoice);
    const paid = num(invoice.paid);

    // حاجز السقف المالي: الإلغاء أثره المالي = شطب كامل المبلغ — يقيّده AMOUNT_CAP
    if (status === "cancelled") {
      if (paid > 0) {
        return {
          ok: false,
          summary: `لا يمكن إلغاء «${invoiceNumber}» — عليها دفعات مسجلة (${fmtMoneyFor(paid, ctx.currency)}). الإلغاء يتطلب معالجة الدفعات أولاً (بشر).`,
          blocked: "AMOUNT_CAP",
        };
      }
      if (total > AGENT_AMOUNT_CAP) {
        return {
          ok: false,
          summary: `حاجز السقف المالي: مبلغ الفاتورة ${fmtMoneyFor(total, ctx.currency)} يتجاوز سقف الوكيل (${fmtMoneyFor(AGENT_AMOUNT_CAP, ctx.currency)}) — الإلغاء يتطلب تدخلاً بشرياً.`,
          blocked: "AMOUNT_CAP",
        };
      }
    }

    // «مدفوعة» صادقة فقط: الدفعات تغطي المبلغ
    if (status === "paid" && paid + 1e-9 < total) {
      return {
        ok: false,
        summary: `لا يمكن وسم «${invoiceNumber}» مدفوعة — المدفوع ${fmtMoneyFor(paid, ctx.currency)} من ${fmtMoneyFor(total, ctx.currency)}. سجّل الدفعة الناقصة أولاً.`,
        blocked: "INVALID_ARGS",
      };
    }

    await db.invoice.update({ where: { id: invoice.id }, data: { status } });
    await invalidateInvoices(ctx.companySlug ?? undefined);
    return {
      ok: true,
      summary: `حُدّثت حالة «${invoiceNumber}» من «${invoice.status}» إلى «${status}».`,
      data: { invoiceNumber, from: invoice.status, to: status },
    };
  },
};

/* ————— السجل (whitelist مغلق — لا أدوات حذف إطلاقاً) ————— */

export const AGENT_TOOLS: AgentTool[] = [
  toolSearch,
  toolListInvoices,
  toolListCustomers,
  toolListPayments,
  toolCompanyStats,
  toolCreateCompany,
  toolCreateStore,
  toolUpdateStatus,
];

export const AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name);

export function isAgentTool(v: unknown): v is string {
  return typeof v === "string" && AGENT_TOOL_NAMES.includes(v);
}

/* ————— الحاجز الأمني + التدقيق: كل استدعاء يمر من هنا ————— */

export interface ToolRunRecord {
  tool: string;
  kind: ToolKind;
  args: Record<string, unknown>;
  outcome: ToolOutcome;
  durationMs: number;
  blocked: string | null;
}

/** معقّم الوسائط للتدقيق — بلا بيانات حساسة وبطول محدود */
function sanitizeArgs(args: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args).slice(0, 15)) {
    if (v == null) continue;
    if (typeof v === "string") clean[k] = v.slice(0, 120);
    else if (typeof v === "number" || typeof v === "boolean") clean[k] = v;
    else clean[k] = JSON.stringify(v).slice(0, 200);
  }
  try {
    return JSON.stringify(clean).slice(0, 600);
  } catch {
    return "{}";
  }
}

/**
 * تنفيذ أداة الوكيل بأمان: whitelist → صلاحيات → وضع القراءة → التنفيذ → التدقيق.
 * لا ترمي أبداً — كل فشل يعود كـ ToolOutcome مع كود blocked.
 */
export async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<ToolRunRecord> {
  const t0 = Date.now();
  const safeArgs = args && typeof args === "object" && !Array.isArray(args) ? args : {};

  // 1. whitelist مغلق — أي اسم خارج الأدوات الثمانية محجوب (لا حذف، لا مفاجآت)
  const tool = AGENT_TOOLS.find((t) => t.name === name);
  if (!tool) {
    const rec: ToolRunRecord = {
      tool: String(name).slice(0, 40),
      kind: "read",
      args: safeArgs,
      outcome: {
        ok: false,
        summary: `أداة غير معروفة «${name}» — الأدوات المتاحة: ${AGENT_TOOL_NAMES.join("، ")}. لا توجد عمليات حذف في النظام.`,
        blocked: "NO_SUCH_TOOL",
      },
      durationMs: 0,
      blocked: "NO_SUCH_TOOL",
    };
    await writeAudit(rec, ctx);
    return rec;
  }

  // 2. أدوات الكتابة تتطلب مديراً (إنشاء شركة/متجر) — أو تظل حصرية بملكية المشترك داخل الأداة
  if (tool.kind === "write" && (tool.name === "create_company" || tool.name === "create_store") && !ctx.isAdmin) {
    // المشترك يُسمح له — الأداة نفسها تقيّد الملكية (شركته فقط)
    const appUser = await db.appUser.findUnique({ where: { email: ctx.userEmail } });
    if (!appUser) {
      const rec: ToolRunRecord = {
        tool: tool.name,
        kind: tool.kind,
        args: safeArgs,
        outcome: {
          ok: false,
          summary: "إنشاء الشركات والمتاجر عبر الوكيل متاح للمدير أو المشتركين المسجّلين فقط.",
          blocked: "NOT_ADMIN",
        },
        durationMs: 0,
        blocked: "NOT_ADMIN",
      };
      await writeAudit(rec, ctx);
      return rec;
    }
  }

  // 3. حاجز وضع القراءة الافتراضي — الكتابة تنتظر تأكيد المستخدم الصريح
  if (tool.kind === "write" && ctx.mode === "readonly") {
    const rec: ToolRunRecord = {
      tool: tool.name,
      kind: tool.kind,
      args: safeArgs,
      outcome: {
        ok: false,
        summary:
          `CONFIRMATION_REQUIRED: أداة الكتابة «${tool.name}» محجوبة في وضع القراءة فقط — ` +
          `أعلِم المستخدم أن العملية بانتظار تأكيده من بطاقة التنفيذ، ولا تحاول تنفيذها مرة أخرى قبل الموافقة.`,
        blocked: "READONLY_MODE",
      },
      durationMs: 0,
      blocked: "READONLY_MODE",
    };
    await writeAudit(rec, ctx);
    return rec;
  }

  // 4. التنفيذ الفعلي داخل حماية — أي استثناء يُحوَّل إلى فشل مدوَّن
  let outcome: ToolOutcome;
  try {
    outcome = await tool.exec(safeArgs, ctx);
  } catch (e) {
    outcome = { ok: false, summary: `خطأ تنفيذ داخلي: ${e instanceof Error ? e.message : String(e)}` };
  }
  const durationMs = Date.now() - t0;
  const rec: ToolRunRecord = {
    tool: tool.name,
    kind: tool.kind,
    args: safeArgs,
    outcome,
    durationMs,
    blocked: outcome.blocked ?? null,
  };
  await writeAudit(rec, ctx);
  return rec;
}

/** تدوين استدعاء واحد في agent_audit_log — نجح أو حُجب أو فشل */
async function writeAudit(rec: ToolRunRecord, ctx: AgentToolContext): Promise<void> {
  try {
    let resultSummary = "{}";
    try {
      resultSummary = JSON.stringify({
        summary: rec.outcome.summary.slice(0, 500),
        ...(rec.outcome.data ? { data: rec.outcome.data } : {}),
      }).slice(0, 900);
    } catch {
      resultSummary = "{}";
    }
    await db.agentAuditLog.create({
      data: {
        runId: ctx.runId,
        step: ctx.step,
        tool: rec.tool,
        kind: rec.kind,
        args: sanitizeArgs(rec.args),
        ok: rec.outcome.ok,
        blocked: rec.blocked,
        result: resultSummary,
        durationMs: rec.durationMs,
        userEmail: ctx.userEmail,
        companySlug: ctx.companySlug,
        mode: ctx.mode,
      },
    });
  } catch (e) {
    // التدقيق لا يُفشل تشغيلة الوكيل أبداً — يُسجَّل التحذير فقط
    console.warn("[agent] audit write failed:", e instanceof Error ? e.message : e);
  }
}

/* ————— بروتوكول الأدوات (يُحقن في system prompt) ————— */

export function agentToolsPrompt(mode: "readonly" | "auto" | "confirmed"): string {
  const toolLines = AGENT_TOOLS.map(
    (t) => `- ${t.name} (${t.kind === "read" ? "قراءة" : "كتابة"}): ${t.desc}\n  الوسائط: ${t.argsHint}`,
  ).join("\n");
  return [
    "— أدواتك التنفيذية الحقيقية (ثمانية فقط — لا شيء خارجها):",
    toolLines,
    "",
    "— بروتوكول استدعاء الأداة (صارم):",
    "عندما تقرر استخدام أداة، أنهِ رسالتك بكتلة كود واحدة بهذا الشكل حرفياً (بلا أي نص داخل الكتلة عدا الـ JSON):",
    "```garfix-tool",
    '{"tool": "list_invoices", "args": {"status": "issued", "limit": 10}}',
    "```",
    "قواعد: أداة واحدة فقط في كل رسالة. الأرقام أرقام غربية (123). بعد إرسالك الأداة ستستلم نتيجتها برسالة نظام تبدأ بـ [TOOL_RESULT] — اقرأها جيداً وقرّر: أداة أخرى أو الجواب النهائي للمستخدم.",
    "",
    "— الحواجز الأمنية (مبادئ غير قابلة للتفاوض):",
    `1. الوضع الحالي: ${mode === "auto" ? "⚡ تنفيذ تلقائي — أدوات الكتابة تُنفَّذ مباشرة (ضمن الحواجز)." : "🔒 قراءة فقط"}.`,
    mode === "auto"
      ? "أدوات الكتابة تُنفَّذ مباشرة ضمن الحواجز — لا حاجة لتأكيد إضافي."
      : "قاعدة صارمة في وضع القراءة: إذا طلب المستخدم عملية كتابة (شركة/متجر/تحديث حالة) فأصدِر استدعاء الأداة كالمعتاد ولا ترفض طلبه نصياً — النظام سيحجبها تلقائياً (CONFIRMATION_REQUIRED) وسيعرض للمستخدم بطاقة تأكيد بضغطة زر. بعد استلام نتيجة الحجب، أخبر المستخدم بملخص ما ستنفّذه وأن عليه الضغط على زر التأكيد.",
    `2. لا توجد عمليات حذف في نظامك إطلاقاً — إن طلب المستخدم حذفاً فاشرح أن الحذف غير متاح للوكيل ويحتاج تدخلاً بشرياً مباشراً.`,
    `3. السقف المالي لأي أثر نقدي (مثل إلغاء فاتورة) هو ${fmtMoneyFor(AGENT_AMOUNT_CAP, "KWD")} — ما يتجاوزه يُحجب تلقائياً.`,
    "4. لا تخترع أرقاماً أبداً — استفسر بالأدوات أولاً ثم أجب من [TOOL_RESULT].",
    "5. للمهام المركّبة (مثل: شركة + متجر): خطّط، نفّذ أداة أولاً، لاحظ النتيجة، ثم أكمل — حلقة Think→Act→Observe حقيقية.",
    "",
    "— أمثلة:",
    'طلب «اعمل شركة تبيع ملابس ومتجر ليها» → استدعِ create_store بـ {"companyName": "...", "nameAr": "...", "storeSlug": "..." ...} — الأداة تنشئ الشركة والمتجر معاً.',
    'طلب «شو صار على فاتورة INV1005؟» → استدعِ search أو list_invoices ثم أجب من النتيجة.',
  ].join("\n");
}
