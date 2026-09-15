/**
 * backup-legacy.ts — r21: دعم استعادة النسخ الاحتياطية القديمة (النظام الأصلي).
 *
 * النسخة القديمة (من نظام Express/Drizzle الأصلي) بتنسيق مختلف:
 *   { meta: {version, createdAt, tables}, invoices: [...], companies: [...],
 *     clients: [...], users: [...], catalog: [...], purchases: [...], auditLogs: [...] }
 * بينما النظام الحالي يستخدم { app: "garfix-accounts", data: {...} } بأسماء جداول
 * مختلفة (productCatalog / purchaseInvoices) وحقول JSON مخزنة نصياً.
 *
 * هذا المحوّل يطابق الصيغة القديمة (isLegacyBackup) ويحوّلها إلى التنسيق
 * الحالي (migrateLegacyBackup) مع:
 *   - invoices: lineItems (مصفوفة) → JSON نصي
 *   - catalog → productCatalog (aliases مصفوفة → JSON)
 *   - purchases → purchaseInvoices (items/sourceInvoiceIds → JSON)
 *   - companies: logoBase64 → logo
 *   - users و auditLogs: لا مقابل لهما في المخطط الحالي → تُتخطى (تُعاد أعدادها)
 */

export interface LegacyDump {
  meta?: { version?: number; createdAt?: string; tables?: string[] };
  invoices?: unknown[];
  companies?: unknown[];
  clients?: unknown[];
  users?: unknown[];
  catalog?: unknown[];
  purchases?: unknown[];
  auditLogs?: unknown[];
  [k: string]: unknown;
}

export interface CurrentDump {
  app: "garfix-accounts";
  generatedAt: string;
  engine: string;
  data: {
    companies: Record<string, unknown>[];
    clients: Record<string, unknown>[];
    invoices: Record<string, unknown>[];
    payments: Record<string, unknown>[];
    productCatalog: Record<string, unknown>[];
    purchaseInvoices: Record<string, unknown>[];
    reminderLogs: Record<string, unknown>[];
    settings: Record<string, unknown>[];
    aiConversations: Record<string, unknown>[];
    aiMessages: Record<string, unknown>[];
  };
}

/** هل الملف نسخة قديمة؟ (meta + مصفوفات معروفة بأسماء قديمة) */
export function isLegacyBackup(dump: unknown): dump is LegacyDump {
  if (!dump || typeof dump !== "object") return false;
  const d = dump as Record<string, unknown>;
  if (d.app === "garfix-accounts") return false; // التنسيق الحالي
  const hasMeta = d.meta && typeof d.meta === "object";
  const knownOld = ["invoices", "companies", "catalog", "purchases", "users", "auditLogs"];
  const hits = knownOld.filter((k) => Array.isArray(d[k])).length;
  return Boolean(hasMeta) && hits >= 2;
}

const asRow = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const toJson = (v: unknown): string => JSON.stringify(Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : v == null ? fallback : String(v));
const asNum = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};
const asDate = (v: unknown): string => {
  const s = asStr(v);
  return s || new Date().toISOString();
};

/**
 * ترحيل النسخة القديمة إلى تنسيق الاستعادة الحالي.
 * يُعيد { dump, skipped } حيث skipped توضح الجداول بلا مقابل.
 *
 * currentCompanies: صفوف الشركات الحالية من قاعدة البيانات (تُقرأ قبل المعاملة)
 * — تُحفظ كما هي بدل الشركات القديمة (أسماء وبيانات أغنى)، مع مطابقة
 * السلَاغات القصيرة القديمة (tawfeer…) على سلاغات النظام الحالي
 * (tw_inv_tawfeer_v1) حتى تظهر الفواتير تحت شركاتها الصحيحة مباشرة.
 */
export function migrateLegacyBackup(
  legacy: LegacyDump,
  currentCompanies: Array<Record<string, unknown>> = [],
): { dump: CurrentDump; skipped: Record<string, number> } {
  // ── خريطة السلاغات: قديم → حالي (مطابقة بالسلاغ نفسه أو بالاحتواء أو بالكود) ──
  const slugMap = new Map<string, string>();
  for (const c of asArray(legacy.companies)) {
    const ls = asStr(asRow(c).slug);
    if (!ls) continue;
    const hit = currentCompanies.find((cur) => {
      const curSlug = asStr(cur.slug);
      const curCode = asStr(cur.code);
      return curSlug === ls || curCode === ls || (ls.length >= 3 && curSlug.includes(ls));
    });
    slugMap.set(ls, hit ? asStr(hit.slug) : ls);
  }
  const mapSlug = (v: unknown): string | null => {
    const s = typeof v === "string" ? v : "";
    if (!s) return null;
    return slugMap.get(s) ?? s;
  };

  const data: CurrentDump["data"] = {
    companies: [],
    clients: [],
    invoices: [],
    payments: [],
    productCatalog: [],
    purchaseInvoices: [],
    reminderLogs: [],
    settings: [],
    aiConversations: [],
    aiMessages: [],
  };

  // ── companies: نبقي الشركات الحالية كما هي، ونضيف القديمة غير المطابقة فقط ──
  const keptSlugs = new Set<string>();
  data.companies = currentCompanies.map((cur) => {
    keptSlugs.add(asStr(cur.slug));
    return { ...cur };
  });
  for (const c of asArray(legacy.companies)) {
    const r = asRow(c);
    const ls = asStr(r.slug);
    const mapped = slugMap.get(ls) ?? ls;
    if (!mapped || keptSlugs.has(mapped)) continue; // شركة قديمة لها مقابل حالي — تُتخطى
    const logo = typeof r.logoBase64 === "string" && r.logoBase64.length > 0 && r.logoBase64.length < 900_000 ? r.logoBase64 : null;
    data.companies.push({
      id: asNum(r.id),
      name: asStr(r.name),
      slug: mapped,
      firebaseOwnerId: typeof r.firebaseOwnerId === "string" ? r.firebaseOwnerId : null,
      logo,
      currency: asStr(r.currency, "KWD") || "KWD",
      createdAt: asDate(r.createdAt),
      updatedAt: asDate(r.createdAt),
    });
    keptSlugs.add(mapped);
  }

  // ── clients ──
  data.clients = asArray(legacy.clients).map((c) => {
    const r = asRow(c);
    return {
      id: asNum(r.id),
      name: asStr(r.name),
      email: typeof r.email === "string" ? r.email : null,
      phone: typeof r.phone === "string" ? r.phone : null,
      company: typeof r.company === "string" ? r.company : null,
      address: typeof r.address === "string" ? r.address : null,
      companyId: r.companyId == null ? null : asNum(r.companyId, 0) || null,
      createdAt: asDate(r.createdAt),
      updatedAt: asDate(r.updatedAt ?? r.createdAt),
    };
  });

  // ── invoices ──
  data.invoices = asArray(legacy.invoices).map((i) => {
    const r = asRow(i);
    return {
      id: asNum(r.id),
      invoiceNumber: asStr(r.invoiceNumber),
      companySlug: mapSlug(r.companySlug),
      clientId: r.clientId == null ? null : asNum(r.clientId, 0) || null,
      companyId: r.companyId == null ? null : asNum(r.companyId, 0) || null,
      clientName: asStr(r.clientName),
      clientEmail: typeof r.clientEmail === "string" ? r.clientEmail : null,
      clientPhone: typeof r.clientPhone === "string" ? r.clientPhone : null,
      clientAddress: typeof r.clientAddress === "string" ? r.clientAddress : null,
      issueDate: asStr(r.issueDate),
      dueDate: asStr(r.dueDate),
      status: asStr(r.status, "new"),
      lineItems: toJson(r.lineItems),
      subtotal: asNum(r.subtotal),
      taxRate: asNum(r.taxRate),
      taxAmount: asNum(r.taxAmount),
      total: asNum(r.total),
      shipping: asNum(r.shipping),
      paid: asNum(r.paid),
      notes: typeof r.notes === "string" ? r.notes : null,
      source: typeof r.source === "string" ? r.source : null,
      createdAt: asDate(r.createdAt),
      updatedAt: asDate(r.updatedAt ?? r.createdAt),
    };
  });

  // ── catalog → productCatalog ──
  data.productCatalog = asArray(legacy.catalog).map((c) => {
    const r = asRow(c);
    return {
      id: asNum(r.id),
      name: asStr(r.name),
      aliases: toJson(r.aliases),
      purchasePrice: r.purchasePrice == null ? null : asNum(r.purchasePrice),
      sellingPrice: r.sellingPrice == null ? null : asNum(r.sellingPrice),
      companySlug: mapSlug(r.companySlug),
      createdAt: asDate(r.createdAt),
      updatedAt: asDate(r.updatedAt ?? r.createdAt),
    };
  });

  // ── purchases → purchaseInvoices ──
  data.purchaseInvoices = asArray(legacy.purchases).map((p) => {
    const r = asRow(p);
    return {
      id: asNum(r.id),
      num: asStr(r.num),
      date: asStr(r.date),
      supplier: asStr(r.supplier),
      companySlug: mapSlug(r.companySlug),
      items: toJson(r.items),
      sourceInvoiceIds: toJson(r.sourceInvoiceIds),
      totalQty: Math.round(asNum(r.totalQty)),
      notes: typeof r.notes === "string" ? r.notes : null,
      createdAt: asDate(r.createdAt),
    };
  });

  const skipped: Record<string, number> = {
    users: asArray(legacy.users).length,
    auditLogs: asArray(legacy.auditLogs).length,
  };

  const dump: CurrentDump = {
    app: "garfix-accounts",
    generatedAt: asStr(legacy.meta?.createdAt, new Date().toISOString()),
    engine: "legacy-migration",
    data,
  };
  return { dump, skipped };
}
