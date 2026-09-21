/**
 * r28: بذر بيانات العرض التجريبية (شركات/عملاء/فواتير/مدفوعات/كتالوج/مشتريات)
 * بعد إعادة ضبط الـ sandbox التي محت db/ كلياً (لا SQLite للترحيل هذه المرة).
 *
 * Usage: DATABASE_URL=postgresql://garfix:garfix2024@127.0.0.1:5432/garfix?schema=public bun scripts/seed-demo-data.ts
 *
 * آمن للتكرار: إذا وُجدت شركات أصلاً يتوقف دون كتابة أي شيء.
 * التواريخ ديناميكية (آخر 8 أشهر من اليوم) حتى تعرض لوحة التحكم اتجاهات حية دائماً.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const pad = (n: number) => String(n).padStart(2, "0");
/** تاريخ ISO (YYYY-MM-DD) قبل n شهراً مع يوم محدد */
const d = (monthsBack: number, day: number): string => {
  const now = new Date();
  const dt = new Date(now.getFullYear(), now.getMonth() - monthsBack, Math.min(day, 28));
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const items = (arr: [string, number, number][]) =>
  JSON.stringify(arr.map(([name, qty, price]) => ({ name, qty, price })));
const round2 = (n: number) => Math.round(n * 100) / 100;
const lineTotal = (arr: [string, number, number][]) => round2(arr.reduce((s, [, q, p]) => s + q * p, 0));

async function main() {
  const existing = await db.company.count();
  if (existing > 0) {
    console.log(`[seed-demo] توجد ${existing} شركة بالفعل — لا حاجة للبذر (آمن للتكرار).`);
    return;
  }

  // ── 1) الشركات الأربع الأصلية ──
  const tawfeer = await db.company.create({
    data: {
      name: "Tawfeer Online", nameAr: "توفير أونلاين", code: "tawfeer", slug: "tw_inv_tawfeer_v1",
      currency: "KWD", emoji: "🛒", color: "#0F766E", accent: "#14B8A6", cardBg: "#F0FDFA",
      email: "info@tawfeer.com", phone: "+965 5000 0001", city: "الكويت — حولي",
      address: "الكويت — حولي — شارع التحرير", manager: "أحمد عزت", managerPhone: "+965 9873 7207",
      taxEnabled: true, defaultTaxRate: 0,
    },
  });
  const mahhal = await db.company.create({
    data: {
      name: "Mahhal Online", nameAr: "محلكم أونلاين", code: "mahhal", slug: "tw_inv_mahhal_v1",
      currency: "KWD", emoji: "🏪", color: "#B45309", accent: "#D97706", cardBg: "#FFFBEB",
      email: "info@mahhl.com", phone: "+965 5000 0002", city: "الكويت — الفروانية",
      address: "الكويت — الفروانية — منطقة صناعية", manager: "أيمن", managerPhone: "+965 5000 0012",
      taxEnabled: true, defaultTaxRate: 0,
    },
  });
  const boss = await db.company.create({
    data: {
      name: "Boss Neolife", nameAr: "بوص نيولايف", code: "boss", slug: "tw_inv_boss_v1",
      currency: "KWD", emoji: "💊", color: "#15803D", accent: "#22C55E", cardBg: "#F0FDF4",
      email: "info@boss.com", phone: "+965 5000 0003", city: "الكويت — السالمية",
      address: "الكويت — السالمية — شارع سالم المبارك", manager: "بوص", managerPhone: "+965 5000 0013",
      taxEnabled: true, defaultTaxRate: 0,
    },
  });
  const laqta = await db.company.create({
    data: {
      name: "Laqta", nameAr: "لقطة", code: "laqta", slug: "tw_inv_laqta_v1",
      currency: "KWD", emoji: "📸", color: "#BE123C", accent: "#E11D48", cardBg: "#FFF1F2",
      email: "info@laqta.com", phone: "+965 5000 0004", city: "الكويت — مدينة الكويت",
      address: "الكويت — العاصمة — شارع أحمد الجابر", manager: "لقطة", managerPhone: "+965 5000 0014",
      taxEnabled: true, defaultTaxRate: 0,
    },
  });
  console.log(`[seed-demo] الشركات: ${[tawfeer, mahhal, boss, laqta].map((c) => c.nameAr).join(" / ")}`);

  // ── 2) العملاء (7) ──
  const clientDefs: { name: string; email: string; phone: string; companyId: number; company: string; gov: string }[] = [
    { name: "شركة الفجر للتجارة العامة", email: "fajr@example.com", phone: "+965 2222 0001", companyId: tawfeer.id, company: "توفير أونلاين", gov: "Al Asimah" },
    { name: "مؤسسة النور للمواد الغذائية", email: "alnoor@example.com", phone: "+965 2222 0002", companyId: tawfeer.id, company: "توفير أونلاين", gov: "Hawalli" },
    { name: "أحمد العلي", email: "ahmed.ali@example.com", phone: "+965 2222 0003", companyId: tawfeer.id, company: "توفير أونلاين", gov: "Farwaniya" },
    { name: "فاطمة الصباح", email: "fatima@example.com", phone: "+965 2222 0004", companyId: mahhal.id, company: "محلكم أونلاين", gov: "Hawalli" },
    { name: "متجر السلام", email: "salam@example.com", phone: "+965 2222 0005", companyId: boss.id, company: "بوص نيولايف", gov: "Hawalli" },
    { name: "شركة الخليج للمقاولات", email: "gulf@example.com", phone: "+965 2222 0006", companyId: boss.id, company: "بوص نيولايف", gov: "Ahmadi" },
    { name: "محمد الرشيد", email: "rashid@example.com", phone: "+965 2222 0007", companyId: laqta.id, company: "لقطة", gov: "Al Jahra" },
  ];
  const clients: { id: number; name: string; email: string; phone: string }[] = [];
  for (const c of clientDefs) {
    const row = await db.client.create({
      data: {
        name: c.name, email: c.email, phone: c.phone, company: c.company,
        companyId: c.companyId, country: "KW", governorate: c.gov,
        address: `الكويت — ${c.gov}`,
      },
    });
    clients.push({ id: row.id, name: row.name, email: row.email, phone: row.phone });
  }
  console.log(`[seed-demo] العملاء: ${clients.length}`);

  // ── 3) الفواتير (14) عبر آخر 8 أشهر ──
  type InvDef = {
    companySlug: string; companyId: number; clientIdx: number; num: string;
    monthsBack: number; day: number; dueDays: number; status: string;
    lines: [string, number, number][]; paidRatio: number; paymentMethod?: string; source?: string;
  };
  const invDefs: InvDef[] = [
    // مدفوعة (5) — منجزة عبر الأشهر لتغذية اتجاه الإيرادات
    { companySlug: tawfeer.slug, companyId: tawfeer.id, clientIdx: 0, num: "TW-0001", monthsBack: 7, day: 8, dueDays: 14, status: "paid", lines: [["أرز بسمتي 5كغ", 20, 4.25], ["زيت عافية 1.65ل", 10, 3.75]], paidRatio: 1, paymentMethod: "knet" },
    { companySlug: tawfeer.slug, companyId: tawfeer.id, clientIdx: 1, num: "TW-0002", monthsBack: 6, day: 12, dueDays: 14, status: "paid", lines: [["سكر 2كغ", 30, 1.85], ["شاي أحمر 100كيس", 15, 2.5]], paidRatio: 1, paymentMethod: "cash" },
    { companySlug: mahhal.slug, companyId: mahhal.id, clientIdx: 3, num: "MH-0001", monthsBack: 5, day: 5, dueDays: 21, status: "paid", lines: [["حليب نيدو 2.25كغ", 12, 8.5], ["ماء معدني 24×330مل", 40, 1.25]], paidRatio: 1, paymentMethod: "online" },
    { companySlug: boss.slug, companyId: boss.id, clientIdx: 4, num: "BN-0001", monthsBack: 3, day: 18, dueDays: 14, status: "paid", lines: [["مكمل فيتامين C", 25, 6.75], ["بروتين مصل 2كغ", 5, 32]], paidRatio: 1, paymentMethod: "knet" },
    { companySlug: tawfeer.slug, companyId: tawfeer.id, clientIdx: 2, num: "TW-0003", monthsBack: 2, day: 22, dueDays: 14, status: "paid", lines: [["أرز بسمتي 5كغ", 15, 4.25], ["معكرونة 400غ", 50, 0.65]], paidRatio: 1, paymentMethod: "knet" },
    // معلقة (4) — إحداها بدفعة جزئية
    { companySlug: mahhal.slug, companyId: mahhal.id, clientIdx: 3, num: "MH-0002", monthsBack: 1, day: 9, dueDays: 21, status: "pending", lines: [["ماء معدني 24×330مل", 100, 1.25], ["عصير برتقال 1ل", 30, 1.75]], paidRatio: 0 },
    { companySlug: tawfeer.slug, companyId: tawfeer.id, clientIdx: 0, num: "TW-0004", monthsBack: 0, day: 3, dueDays: 14, status: "pending", lines: [["زيت عافية 1.65ل", 24, 3.75], ["سكر 2كغ", 24, 1.85]], paidRatio: 0.4, paymentMethod: "knet" },
    { companySlug: laqta.slug, companyId: laqta.id, clientIdx: 6, num: "LQ-0001", monthsBack: 0, day: 10, dueDays: 30, status: "pending", lines: [["خدمة تصوير منتجات (جلسة)", 1, 120]], paidRatio: 0 },
    { companySlug: boss.slug, companyId: boss.id, clientIdx: 5, num: "BN-0002", monthsBack: 0, day: 14, dueDays: 21, status: "pending", lines: [["مكمل أوميغا 3", 18, 9.25]], paidRatio: 0 },
    // متأخرة (3)
    { companySlug: tawfeer.slug, companyId: tawfeer.id, clientIdx: 1, num: "TW-0005", monthsBack: 2, day: 2, dueDays: 14, status: "overdue", lines: [["أرز بسمتي 5كغ", 30, 4.25]], paidRatio: 0 },
    { companySlug: mahhal.slug, companyId: mahhal.id, clientIdx: 3, num: "MH-0003", monthsBack: 1, day: 25, dueDays: 7, status: "overdue", lines: [["حليب نيدو 2.25كغ", 8, 8.5], ["شاي أحمر 100كيس", 20, 2.5]], paidRatio: 0 },
    { companySlug: boss.slug, companyId: boss.id, clientIdx: 4, num: "BN-0003", monthsBack: 1, day: 28, dueDays: 7, status: "overdue", lines: [["بروتين مصل 2كغ", 3, 32]], paidRatio: 0 },
    // ملغاة (1) + مسودة (1)
    { companySlug: laqta.slug, companyId: laqta.id, clientIdx: 6, num: "LQ-0002", monthsBack: 4, day: 15, dueDays: 14, status: "cancelled", lines: [["خدمة مونتاج فيديو", 1, 90]], paidRatio: 0 },
    { companySlug: laqta.slug, companyId: laqta.id, clientIdx: 6, num: "LQ-0003", monthsBack: 0, day: 20, dueDays: 14, status: "draft", lines: [["خدمة تصوير منتجات (مجموعة)", 1, 250]], paidRatio: 0 },
  ];

  let paymentsCount = 0;
  for (const def of invDefs) {
    const cl = clients[def.clientIdx];
    const sub = lineTotal(def.lines);
    const taxRate = 0; // الكويت: بلا ضريبة
    const total = round2(sub + taxRate * sub);
    const paid = round2(total * def.paidRatio);
    const issue = d(def.monthsBack, def.day);
    const due = (() => {
      const dt = new Date(issue + "T00:00:00");
      dt.setDate(dt.getDate() + def.dueDays);
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    })();

    const inv = await db.invoice.create({
      data: {
        invoiceNumber: def.num, companySlug: def.companySlug, companyId: def.companyId,
        clientId: cl.id, clientName: cl.name, clientEmail: cl.email, clientPhone: cl.phone,
        clientAddress: `الكويت`, issueDate: issue, dueDate: due, status: def.status,
        lineItems: items(def.lines), subtotal: sub, taxRate, taxAmount: 0, total,
        shipping: 0, paid, notes: def.status === "overdue" ? "بانتظار التحصيل — تذكير واتساب مرسل" : null,
        source: "seed-demo",
      },
    });

    if (paid > 0 && def.paymentMethod) {
      await db.payment.create({
        data: { invoiceId: inv.id, amount: paid, method: def.paymentMethod, date: due, note: "دفعة كاملة" },
      });
      paymentsCount++;
    }
  }
  console.log(`[seed-demo] الفواتير: ${invDefs.length} (مدفوعات مسجلة: ${paymentsCount})`);

  // ── 4) كتالوج المنتجات (6) ──
  const catalog: [string, string[], number | null, number | null, string][] = [
    ["أرز بسمتي 5كغ", ["بسمتي", "رز", "basmati"], 3.1, 4.25, tawfeer.slug],
    ["زيت عافية 1.65ل", ["زيت", "عافية", "oil"], 2.6, 3.75, tawfeer.slug],
    ["سكر 2كغ", ["سكر", "sugar"], 1.25, 1.85, tawfeer.slug],
    ["شاي أحمر 100كيس", ["شاي", "tea"], 1.6, 2.5, mahhal.slug],
    ["حليب نيدو 2.25كغ", ["نيدو", "حليب", "milk"], 6.75, 8.5, mahhal.slug],
    ["ماء معدني 24×330مل", ["ماء", "water"], 0.75, 1.25, mahhal.slug],
  ];
  for (const [name, aliases, buy, sell, slug] of catalog) {
    await db.productCatalog.create({
      data: { name, aliases: JSON.stringify(aliases), purchasePrice: buy, sellingPrice: sell, companySlug: slug },
    });
  }
  console.log(`[seed-demo] الكتالوج: ${catalog.length}`);

  // ── 5) فاتورة مشتريات (1) ──
  await db.purchaseInvoice.create({
    data: {
      num: "PUR-0001", date: d(1, 6), supplier: "شركة التوريدات المركزية", companySlug: tawfeer.slug,
      items: JSON.stringify([
        { name: "أرز بسمتي 5كغ", qty: 60, price: 3.1 },
        { name: "زيت عافية 1.65ل", qty: 30, price: 2.6 },
      ]),
      sourceInvoiceIds: "[]", totalQty: 90, notes: "توريد شهري",
    },
  });
  console.log("[seed-demo] المشتريات: 1");

  const summary = {
    companies: await db.company.count(),
    clients: await db.client.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    productCatalog: await db.productCatalog.count(),
    purchaseInvoices: await db.purchaseInvoice.count(),
  };
  console.log("[seed-demo] ✔ اكتمل:", JSON.stringify(summary));
}

main()
  .catch((e) => { console.error("[seed-demo] فشل:", e); process.exit(1); })
  .finally(() => db.$disconnect());
