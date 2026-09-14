import type { AppUser } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * r17: نظام الاشتراكات — خطط تحدد سعة (شركات / عملاء / فواتير معالجة بالذكاء الاصطناعي شهرياً)
 * بسعر شهري بالدولار، مع عدّادات استخدام وطلبات ترقية يعتمدها المؤسس.
 *
 * الحسابات المدمجة (المؤسس/الموظفون) بلا حدود — الحصص للمشتركين المسجّلين فقط.
 */

export interface PlanDef {
  code: string;
  nameAr: string;
  descAr: string;
  priceUsd: number;
  maxCompanies: number;
  maxCustomers: number;
  monthlyAiInvoices: number;
  features: string[];
  badgeAr: string | null;
  sortOrder: number;
  active: boolean;
}

// ── الخطط الافتراضية (تُزرع مرة واحدة — تعديلات المؤسس من اللوحة محفوظة) ──
export const DEFAULT_PLANS: PlanDef[] = [
  {
    code: "free_early",
    nameAr: "المجاني التأسيسي",
    descAr: "مجاناً مدى الحياة لأول 100 مشترك",
    priceUsd: 0,
    maxCompanies: 1,
    maxCustomers: 20,
    monthlyAiInvoices: 30,
    features: [
      "شركة واحدة بقاعدة عملائها",
      "٢٠ عميلاً",
      "٣٠ فاتورة معالجة بالذكاء الاصطناعي شهرياً",
      "المساعد الذكي أحمد عزت الصياد",
      "فواتير وطباعة PDF عربية كاملة",
    ],
    badgeAr: "🎁 لأول ١٠٠ مشترك",
    sortOrder: 0,
    active: true,
  },
  {
    code: "starter",
    nameAr: "البداية",
    descAr: "لمتجر واحد ينمو بثبات",
    priceUsd: 9,
    maxCompanies: 1,
    maxCustomers: 150,
    monthlyAiInvoices: 200,
    features: [
      "شركة واحدة",
      "١٥٠ عميلاً",
      "٢٠٠ فاتورة معالجة بالذكاء الاصطناعي شهرياً",
      "الإدخال المجمع بالذكاء الاصطناعي",
      "تقارير ومتابعة مدفوعات كاملة",
    ],
    badgeAr: null,
    sortOrder: 1,
    active: true,
  },
  {
    code: "pro",
    nameAr: "الاحترافية",
    descAr: "لفرق العمل والعلامات المتعددة",
    priceUsd: 19,
    maxCompanies: 3,
    maxCustomers: 600,
    monthlyAiInvoices: 800,
    features: [
      "٣ شركات",
      "٦٠٠ عميل",
      "٨٠٠ فاتورة معالجة بالذكاء الاصطناعي شهرياً",
      "أولوية في معالجة الذكاء الاصطناعي",
      "نسخ احتياطي يومي تلقائي",
    ],
    badgeAr: "⭐ الأكثر شيوعاً",
    sortOrder: 2,
    active: true,
  },
  {
    code: "business",
    nameAr: "الأعمال",
    descAr: "للمؤسسات والمجموعات التجارية",
    priceUsd: 49,
    maxCompanies: 10,
    maxCustomers: 5000,
    monthlyAiInvoices: 4000,
    features: [
      "١٠ شركات",
      "٥٠٠٠ عميل",
      "٤٠٠٠ فاتورة معالجة بالذكاء الاصطناعي شهرياً",
      "أعلى أولوية في الطوابير",
      "دعم مباشر من فريق Garfix",
    ],
    badgeAr: null,
    sortOrder: 3,
    active: true,
  },
];

export function defaultPlanOf(code: string): PlanDef | undefined {
  return DEFAULT_PLANS.find((p) => p.code === code);
}

// ── تعبئة الخطط الناقصة فقط (بلا مسح تعديلات المؤسس) ──
export const FREE_SUBSCRIBER_LIMIT = 100; // «مجاناً لأول ١٠٠ مشترك»

export async function ensurePlans(): Promise<void> {
  try {
    const existing = await db.subscriptionPlan.findMany({ select: { code: true } });
    const have = new Set(existing.map((p) => p.code));
    const missing = DEFAULT_PLANS.filter((p) => !have.has(p.code));
    if (missing.length) {
      await db.subscriptionPlan.createMany({
        data: missing.map((p) => ({
          code: p.code,
          nameAr: p.nameAr,
          descAr: p.descAr,
          priceUsd: p.priceUsd,
          maxCompanies: p.maxCompanies,
          maxCustomers: p.maxCustomers,
          monthlyAiInvoices: p.monthlyAiInvoices,
          features: JSON.stringify(p.features),
          badgeAr: p.badgeAr,
          sortOrder: p.sortOrder,
          active: p.active,
        })),
      });
    }
  } catch {
    /* قاعدة غير مهيأة — الدعاة يستعملون الافتراضيات */
  }
}

export interface PlanRecord extends PlanDef {
  id: number;
  updatedAt: string;
}

export function serializePlan(p: {
  id: number; code: string; nameAr: string; descAr: string | null; priceUsd: number;
  maxCompanies: number; maxCustomers: number; monthlyAiInvoices: number; features: string;
  badgeAr: string | null; sortOrder: number; active: boolean; updatedAt: Date;
}): PlanRecord {
  let features: string[] = [];
  try { features = JSON.parse(p.features) as string[]; } catch { /* [] */ }
  return {
    id: p.id,
    code: p.code,
    nameAr: p.nameAr,
    descAr: p.descAr ?? "",
    priceUsd: p.priceUsd,
    maxCompanies: p.maxCompanies,
    maxCustomers: p.maxCustomers,
    monthlyAiInvoices: p.monthlyAiInvoices,
    features,
    badgeAr: p.badgeAr,
    sortOrder: p.sortOrder,
    active: p.active,
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** خطة بكودها من DB مع سقوط للافتراضية */
export async function getPlan(code: string | null | undefined): Promise<PlanRecord> {
  const c = String(code || "free_early");
  try {
    const row = await db.subscriptionPlan.findUnique({ where: { code: c } });
    if (row) return serializePlan(row);
  } catch { /* fall through */ }
  const d = defaultPlanOf(c) ?? DEFAULT_PLANS[0];
  return { ...d, id: 0, updatedAt: new Date().toISOString() };
}

export async function listPlans(includeInactive = false): Promise<PlanRecord[]> {
  await ensurePlans();
  try {
    const rows = await db.subscriptionPlan.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    if (rows.length) return rows.map(serializePlan);
  } catch { /* fall through */ }
  return DEFAULT_PLANS.filter((p) => includeInactive || p.active).map((p) => ({ ...p, id: 0, updatedAt: "" }));
}

// ── عدّادات الاستخدام الشهرية ──
export function currentPeriod(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getAiUsage(userId: number, period = currentPeriod()): Promise<number> {
  try {
    const row = await db.usageCounter.findUnique({ where: { userId_period: { userId, period } } });
    return row?.aiInvoices ?? 0;
  } catch {
    return 0;
  }
}

/** زيادة العدّاد (upsert) — تُستدعى بعد معالجة ناجحة بالذكاء الاصطناعي */
export async function incrAiInvoices(userId: number, count: number, period = currentPeriod()): Promise<void> {
  if (count <= 0) return;
  try {
    await db.usageCounter.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, aiInvoices: count },
      update: { aiInvoices: { increment: count } },
    });
  } catch {
    /* عدّاد إحصائي — لا يعطّل العملية */
  }
}

// ── الاستخدام الكامل لمشترك (شركاته + عملاؤه + فواتير AI الشهر) ──
export interface UsageSnapshot {
  companies: { used: number; max: number };
  customers: { used: number; max: number };
  aiInvoices: { used: number; max: number; period: string };
}

export async function getUsageSnapshot(appUser: AppUser): Promise<{ plan: PlanRecord; usage: UsageSnapshot }> {
  const plan = await getPlan(appUser.plan);
  let companies: string[] = [];
  try { companies = JSON.parse(appUser.companies) as string[]; } catch { /* [] */ }

  // العملاء المرتبطين بشركات المشترك (مطابقة بالكود أو الـ slug)
  let customersUsed = 0;
  try {
    if (companies.length) {
      const codes = companies.map((s) => s.toLowerCase());
      const rows = await db.client.findMany({ select: { company: true } });
      customersUsed = rows.filter((r) => {
        const v = String(r.company || "").toLowerCase();
        return v && (codes.includes(v) || codes.includes(`tw_inv_${v}_v1`) || companies.some((s) => s.toLowerCase() === v));
      }).length;
    }
  } catch { /* 0 */ }

  const period = currentPeriod();
  const aiUsed = await getAiUsage(appUser.id, period);
  return {
    plan,
    usage: {
      companies: { used: companies.length, max: plan.maxCompanies },
      customers: { used: customersUsed, max: plan.maxCustomers },
      aiInvoices: { used: aiUsed, max: plan.monthlyAiInvoices, period },
    },
  };
}

// ── فحوص الحصص (رسائل عربية جاهزة للواجهة) ──
export interface QuotaResult {
  ok: boolean;
  code?: string;
  message?: string;
  usage?: UsageSnapshot;
}

export async function checkCompaniesQuota(appUser: AppUser): Promise<QuotaResult> {
  const { plan, usage } = await getUsageSnapshot(appUser);
  if (usage.companies.used >= plan.maxCompanies) {
    return {
      ok: false,
      code: "QUOTA_COMPANIES",
      message: `وصلت حد خطتك (${plan.nameAr}): ${plan.maxCompanies} ${plan.maxCompanies === 1 ? "شركة واحدة" : "شركات"} فقط. اطلب ترقية الخطة من تبويب «حسابي» لزيادة السعة.`,
      usage,
    };
  }
  return { ok: true, usage };
}

export async function checkCustomersQuota(appUser: AppUser): Promise<QuotaResult> {
  const { plan, usage } = await getUsageSnapshot(appUser);
  if (usage.customers.used >= plan.maxCustomers) {
    return {
      ok: false,
      code: "QUOTA_CUSTOMERS",
      message: `وصلت حد العملاء في خطتك (${plan.nameAr}): ${plan.maxCustomers} عميلاً. اطلب ترقية الخطة من تبويب «حسابي» لزيادة السعة.`,
      usage,
    };
  }
  return { ok: true, usage };
}

export async function checkAiQuota(appUser: AppUser, additional = 1): Promise<QuotaResult> {
  const { plan, usage } = await getUsageSnapshot(appUser);
  if (usage.aiInvoices.used + additional > plan.monthlyAiInvoices) {
    return {
      ok: false,
      code: "QUOTA_AI_INVOICES",
      message: `وصلت حد الفواتير المعالجة بالذكاء الاصطناعي لهذا الشهر (${usage.aiInvoices.used}/${plan.monthlyAiInvoices} في خطة ${plan.nameAr}). اطلب ترقية الخطة من تبويب «حسابي».`,
      usage,
    };
  }
  return { ok: true, usage };
}
