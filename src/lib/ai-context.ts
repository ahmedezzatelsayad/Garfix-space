/**
 * r10: بنّاء سياق المساعد الذكي — يجمع لقطة حيّة من كامل المشروع
 * (شركات، فواتير، عملاء، كتالوج، مشتريات، تذكيرات) لحقنها في الـ system prompt.
 * تُخزَّن اللقطة في كاش Valkey لمدة 20 ثانية لتخفيف الحمل.
 */
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";
import { invoicePaymentStatus, invoiceTotal, num } from "@/lib/serialize";
import { currencyOf } from "@/lib/currency-shared";
import { actionProtocolPrompt } from "@/lib/ai-actions";
import { companyMatchKeys } from "@/lib/company-access";

export interface CompanyContextInput {
  companySlug?: string;
  companyName?: string;
}

interface InvoiceLite {
  id: number;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: string;
  payStatus: string;
  total: number;
  paid: number;
}

interface ContextSnapshot {
  generatedAt: string;
  companies: { name: string; slug: string; invoiceCount: number }[];
  scope: string;
  currency: { code: string; short: string; ar: string; en?: string; shortEn?: string; decimals: number };
  kpis: {
    totalInvoices: number;
    totalRevenue: number;
    outstanding: number;
    overdueCount: number;
    paidCount: number;
    draftCount: number;
    totalClients: number;
    catalogItems: number;
    purchaseInvoices: number;
  };
  topClientsByDebt: { name: string; phone: string; outstanding: number; invoices: number }[];
  recentInvoices: InvoiceLite[];
  catalogSample: { name: string; selling: number; purchase: number }[];
  lastReminders: { client: string; channel: string; at: string }[];
}

const fKD = (n: number, cur: { decimals: number; short: string }): string => `${n.toFixed(cur.decimals)} ${cur.short}`;

export async function buildProjectContext(input: CompanyContextInput): Promise<ContextSnapshot> {
  const slug = input.companySlug || undefined;
  const key = `ai:ctx:${slug || "all"}`;

  return cacheWrap<ContextSnapshot>(key, 20, async () => {
    const companies = await db.company.findMany({ select: { name: true, slug: true, currency: true } });
    // r15: عملة الشركة الفعّالة (بعد r12 العملة إعداد لكل شركة) — كل تُنسيق المبالغ بها
    const curInfo = currencyOf(companies.find((c) => c.slug === slug)?.currency);
    // r29: نمرر en/shortEn أيضاً — كانت تسقط من اللقطة فيقع السؤال الإنجليزي على
    // الاسم العربي دائماً (خطأ TS سابق: cur.en غير موجود على النوع الضيق).
    const cur = {
      code: curInfo.code,
      short: curInfo.short,
      ar: curInfo.ar,
      en: curInfo.en ?? undefined,
      shortEn: curInfo.shortEn ?? undefined,
      decimals: curInfo.decimals,
    };
    // عدّ الفواتير لكل شركة (Company بلا علاقات في الـ schema — نحسبها من الفواتير مباشرة)
    const invoiceCountRows = await db.invoice.groupBy({
      by: ["companySlug"],
      _count: { _all: true },
    });
    const invoiceCountBySlug = new Map<string, number>();
    for (const row of invoiceCountRows) {
      if (row.companySlug) invoiceCountBySlug.set(row.companySlug, row._count._all);
    }
    const companyRows = (slug ? companies.filter((c) => c.slug === slug) : companies).map((c) => ({
      ...c,
      invoiceCount: invoiceCountBySlug.get(c.slug) ?? 0,
    }));

    const invoices = await db.invoice.findMany({
      where: slug ? { companySlug: slug } : {},
      orderBy: { createdAt: "desc" },
      take: 400,
    });
    // r29 (C5/H5): عدد العملاء محصور بالشركة (كان عدد عملاء كل الشركات في سياق
    // المساعد أيضاً) — مطابقة عمود company بكل صيغه (slug/code/name/nameAr).
    let totalClients = 0;
    if (slug) {
      const keys = await companyMatchKeys([slug]);
      const clientRows = await db.client.findMany({ select: { company: true } });
      totalClients = clientRows.filter((r) => {
        const v = String(r.company ?? "").trim().toLowerCase();
        return !!v && keys.has(v);
      }).length;
    } else {
      totalClients = await db.client.count();
    }
    const catalog = await db.productCatalog.findMany({
      where: slug ? { companySlug: slug } : {},
      take: 60,
    });
    const purchases = await db.purchaseInvoice.count({ where: slug ? { companySlug: slug } : {} });
    const reminders = await db.reminderLog.findMany({
      where: slug ? { companySlug: slug } : {},
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    let totalRevenue = 0;
    let outstanding = 0;
    let paidCount = 0;
    let draftCount = 0;
    let overdueCount = 0;

    const byClient = new Map<string, { outstanding: number; invoices: number; phone: string }>();
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
      } else {
        outstanding += tot;
        if (st === "unp") draftCount++;
      }
      if (inv.status === "overdue") overdueCount++;
      const ck = inv.clientName || "غير مسمّى";
      const prev = byClient.get(ck) ?? { outstanding: 0, invoices: 0, phone: inv.clientPhone || "" };
      prev.invoices++;
      if (st !== "paid") prev.outstanding += tot - paid;
      if (!prev.phone && inv.clientPhone) prev.phone = inv.clientPhone;
      byClient.set(ck, prev);
    }

    const topClientsByDebt = [...byClient.entries()]
      .filter(([, v]) => v.outstanding > 0)
      .sort((a, b) => b[1].outstanding - a[1].outstanding)
      .slice(0, 8)
      .map(([name, v]) => ({ name, phone: v.phone, outstanding: +v.outstanding.toFixed(3), invoices: v.invoices }));

    const recentInvoices: InvoiceLite[] = invoices.slice(0, 8).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      status: inv.status,
      payStatus: invoicePaymentStatus(inv),
      total: +invoiceTotal(inv).toFixed(3),
      paid: +num(inv.paid).toFixed(3),
    }));

    return {
      generatedAt: new Date().toISOString(),
      companies: companyRows.map((c) => ({ name: c.name, slug: c.slug, invoiceCount: c.invoiceCount })),
      scope: slug ? companies.find((c) => c.slug === slug)?.name || slug : "كل الشركات",
      currency: cur,
      kpis: {
        totalInvoices: invoices.length,
        totalRevenue: +totalRevenue.toFixed(3),
        outstanding: +outstanding.toFixed(3),
        overdueCount,
        paidCount,
        draftCount,
        totalClients,
        catalogItems: catalog.length,
        purchaseInvoices: purchases,
      },
      topClientsByDebt,
      recentInvoices,
      catalogSample: catalog.slice(0, 15).map((c) => ({
        name: c.name,
        selling: c.sellingPrice ?? 0,
        purchase: c.purchasePrice ?? 0,
      })),
      lastReminders: reminders.map((r) => ({
        client: r.clientName || "-",
        channel: r.channel,
        at: r.createdAt.toISOString().slice(0, 16).replace("T", " "),
      })),
    };
  });
}

/** يحوّل اللقطة إلى system prompt مُوجَّه (r20: يتبع لغة الواجهة — ar افتراضياً) */
export function contextToSystemPrompt(snap: ContextSnapshot, lang?: string): string {
  const en = String(lang || "ar").toLowerCase().split("-")[0] !== "ar";
  const cur = snap.currency;
  const fmt = (n: number) => fKD(n, cur);
  const lines: string[] = [];
  if (en) {
    lines.push(`You are "Garfix Smart Assistant" — a financial & administrative assistant embedded in a Kuwaiti multi-company invoicing system.`);
    lines.push(`Always answer in clear, professional English, and use numbers from the real data below only.`);
    lines.push(`The official currency of the current scope is ${cur.en || cur.ar} (${cur.code}) — abbreviate it "${cur.shortEn || cur.short}" after numbers, with its decimals (${cur.decimals}).`);
    lines.push(`If asked about something missing from the data, say so honestly and never invent numbers.`);
  } else {
  lines.push(`أنت "مساعد جرفِكس الذكي" — مساعد مالي وإداري مدمج في نظام إدارة حسابات وفواتير كويتي متعدد الشركات (واجهة عربية RTL).`);
  lines.push(`أجب دائماً بالعربية بأسلوب واضح ومهني، واستخدم الأرقام من البيانات الحقيقية أدناه فقط.`);
  lines.push(`العملة الرسمية لنطاق العمل الحالي هي ${cur.ar} (${cur.code}) — اختصرها "${cur.short}" بعد الأرقام، وبمنازلها العشرية (${cur.decimals}).`);
  lines.push(`إن سُئلت عن شيء غير موجود في البيانات فاذكر ذلك بصراحة ولا تخترع أرقاماً.`);
  }
  lines.push("");
  lines.push(`— نطاق العمل الحالي: ${snap.scope}`);
  lines.push(`— تاريخ اللقطة: ${snap.generatedAt.replace("T", " ").slice(0, 16)}`);
  if (snap.companies.length) {
    lines.push(`— الشركات: ${snap.companies.map((c) => `${c.name} (${c.invoiceCount} فاتورة)`).join("، ")}`);
  }
  lines.push("");
  lines.push("المؤشرات الرئيسية:");
  lines.push(`- إجمالي الفواتير: ${snap.kpis.totalInvoices} (مدفوعة ${snap.kpis.paidCount}، مسودّات/غير مدفوعة ${snap.kpis.draftCount}، متأخرة ${snap.kpis.overdueCount})`);
  lines.push(`- الإيرادات المحققة: ${fmt(snap.kpis.totalRevenue)}`);
  lines.push(`- المستحقات غير المحصّلة: ${fmt(snap.kpis.outstanding)}`);
  lines.push(`- عدد العملاء: ${snap.kpis.totalClients} | أصناف الكتالوج: ${snap.kpis.catalogItems} | فواتير مشتريات: ${snap.kpis.purchaseInvoices}`);

  if (snap.topClientsByDebt.length) {
    lines.push("");
    lines.push("أعلى العملاء مديونية:");
    for (const c of snap.topClientsByDebt) lines.push(`- ${c.name}${c.phone ? ` (${c.phone})` : ""}: ${fmt(c.outstanding)} عبر ${c.invoices} فاتورة`);
  }

  if (snap.recentInvoices.length) {
    lines.push("");
    lines.push("أحدث الفواتير:");
    for (const i of snap.recentInvoices) lines.push(`- ${i.invoiceNumber} | ${i.clientName} | ${fmt(i.total)} | مدفوع ${fmt(i.paid)} | حالة الدفع: ${i.payStatus} | إصدار ${i.issueDate} | استحقاق ${i.dueDate}`);
  }

  if (snap.catalogSample.length) {
    lines.push("");
    lines.push("عيّنة الكتالوج (سعر بيع / شراء):");
    for (const c of snap.catalogSample) lines.push(`- ${c.name}: بيع ${fmt(c.selling)} / شراء ${fmt(c.purchase)}`);
  }

  if (snap.lastReminders.length) {
    lines.push("");
    lines.push("آخر التذكيرات المرسلة:");
    for (const r of snap.lastReminders) lines.push(`- ${r.client} عبر ${r.channel} في ${r.at}`);
  }

  lines.push("");
  lines.push(actionProtocolPrompt());

  lines.push("");
  lines.push("إرشادات الإجابة: نظّم الإجابة بعناوين ونقاط قصيرة عند الحاجة، واقترح خطوات عملية (تحصيل، متابعة، تقارير) عند المناسبة.");
  return lines.join("\n");
}
