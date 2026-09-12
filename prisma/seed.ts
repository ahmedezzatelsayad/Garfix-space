// Seed script: populate demo data for the invoice system
// Run: bun run prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const COMPANIES = [
  { name: 'Tawfeer Online Shop', slug: 'tw_inv_tawfeer_v1' },
  { name: 'Mahhal Online Store', slug: 'tw_inv_mahhal_v1' },
  { name: 'Boss Neolife', slug: 'tw_inv_boss_v1' },
  { name: 'Laqta Online Store', slug: 'tw_inv_laqta_v1' },
]

const CATALOG = [
  { name: 'شاحن ايفون', aliases: JSON.stringify(['شاحن', 'ايفون', 'iphone charger', 'charger']), purchasePrice: 1.5, sellingPrice: 3.5 },
  { name: 'سماعة JBL', aliases: JSON.stringify(['سماعات', 'jbl', '耳机', 'headphones', 'سماعه']), purchasePrice: 4.0, sellingPrice: 8.5 },
  { name: 'Powerbank 20000', aliases: JSON.stringify(['باور بانك', 'powerbank', 'بطارية متنقلة']), purchasePrice: 6.0, sellingPrice: 12.0 },
  { name: 'كابل Type C', aliases: JSON.stringify(['cable', 'كيبل', 'كابل', 'type c']), purchasePrice: 0.8, sellingPrice: 2.0 },
  { name: 'ماتور بوص', aliases: JSON.stringify(['ماتور', 'حلاق', 'clipper']), purchasePrice: 7.0, sellingPrice: 11.9 },
  { name: 'M19 Headphones', aliases: JSON.stringify(['m19', 'سماعة m19']), purchasePrice: 2.5, sellingPrice: 5.5 },
]

function inv(
  invoiceNumber: string,
  companySlug: string,
  clientName: string,
  clientPhone: string,
  clientAddress: string,
  issueDate: string,
  dueDate: string,
  items: Array<{ name: string; desc?: string; qty: number; price: number }>,
  shipping: number,
  paid: number,
  status = 'draft',
  source = 'manual',
) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0)
  const total = subtotal + shipping
  return {
    invoiceNumber,
    companySlug,
    clientName,
    clientEmail: null,
    clientPhone,
    clientAddress,
    issueDate,
    dueDate,
    status,
    lineItems: JSON.stringify(items),
    subtotal,
    taxRate: 0,
    taxAmount: 0,
    total,
    shipping,
    paid,
    notes: null,
    source,
  }
}

function d(offsetDays: number) {
  const dt = new Date()
  dt.setDate(dt.getDate() + offsetDays)
  return dt.toISOString().split('T')[0]
}

async function main() {
  const count = await db.invoice.count()
  if (count > 0) {
    console.log(`Invoices already seeded (${count}). Skipping.`)
    return
  }

  for (const c of COMPANIES) {
    await db.company.upsert({ where: { slug: c.slug }, update: {}, create: c })
  }

  const catalogSlug = 'tw_inv_tawfeer_v1'
  for (const p of CATALOG) {
    await db.productCatalog.create({ data: { ...p, companySlug: catalogSlug } })
  }

  // Tawfeer demo invoices (dates spread over the last 5 months for the dashboard charts)
  const tawfeerInvoices = [
    inv('INV10001', 'tw_inv_tawfeer_v1', 'محمد أبو العينين', '97479196', 'حولي - قطعة 3', d(-150), d(-120), [
      { name: 'ماتور بوص واحد حصان', desc: 'Wahl brand', qty: 1, price: 11.9 },
    ], 0, 11.9),
    inv('INV10002', 'tw_inv_tawfeer_v1', 'فاطمة العلي', '96612345', 'الجهراء - منطقة 6', d(-120), d(-90), [
      { name: 'شاحن ايفون', desc: '20W fast', qty: 2, price: 3.5 },
      { name: 'كابل Type C', desc: '1 meter', qty: 1, price: 2.0 },
    ], 1.0, 5.0),
    inv('INV10003', 'tw_inv_tawfeer_v1', 'أحمد الصياد', '96598737', 'مدينة الكويت - حولي', d(-90), d(-60), [
      { name: 'سماعة JBL', desc: 'T450BT', qty: 1, price: 8.5 },
      { name: 'Powerbank 20000', desc: 'Anker', qty: 1, price: 12.0 },
    ], 2.0, 10.0),
    inv('INV10004', 'tw_inv_tawfeer_v1', 'نورة السالم', '95544332', 'السالمية', d(-60), d(-30), [
      { name: 'M19 Headphones', desc: '', qty: 3, price: 5.5 },
    ], 1.5, 0),
    inv('INV10005', 'tw_inv_tawfeer_v1', 'خالد المطيري', '94422110', 'الفروانية', d(-30), d(0), [
      { name: 'شاحن ايفون', desc: '', qty: 5, price: 3.5 },
      { name: 'كابل Type C', desc: '2 meter', qty: 5, price: 2.0 },
    ], 2.5, 10.0),
    inv('INV10006', 'tw_inv_tawfeer_v1', 'سارة الأحمد', '93311224', 'حولي - النقرة', d(-7), d(23), [
      { name: 'سماعة JBL', desc: 'T450BT', qty: 2, price: 8.5 },
    ], 1.0, 0),
    inv('INV10007', 'tw_inv_tawfeer_v1', 'عبدالله حسن', '92200117', 'الأحمدي', d(-2), d(28), [
      { name: 'Powerbank 20000', desc: '', qty: 1, price: 12.0 },
      { name: 'ماتور بوص واحد حصان', desc: '', qty: 1, price: 11.9 },
    ], 0, 12.0),
    inv('INV10008', 'tw_inv_tawfeer_v1', 'ريم القحطاني', '97766554', 'الجهراء', d(-1), d(29), [
      { name: 'M19 Headphones', desc: '', qty: 1, price: 5.5 },
    ], 1.0, 0, 'cancelled'),
  ]

  // Mahhal demo invoices
  const mahhalInvoices = [
    inv('INV20001', 'tw_inv_mahhal_v1', 'موظف تجريبي', '91234567', 'مدينة الكويت', d(-45), d(-15), [
      { name: 'عطر فرنسي', desc: '100ml', qty: 1, price: 18.0 },
    ], 2.0, 20.0),
    inv('INV20002', 'tw_inv_mahhal_v1', 'منى العتيبي', '92345678', 'حولي', d(-10), d(20), [
      { name: 'ساعة يد نسائية', desc: '', qty: 1, price: 22.0 },
    ], 1.5, 10.0),
  ]

  // Boss demo invoices
  const bossInvoices = [
    inv('INV30001', 'tw_inv_boss_v1', 'يوسف الغامري', '93456789', 'الفروانية', d(-20), d(10), [
      { name: 'مكمل غذائي', desc: 'Protein 2kg', qty: 1, price: 25.0 },
    ], 2.0, 25.0),
  ]

  // Laqta demo invoices
  const laqtaInvoices = [
    inv('INV40001', 'tw_inv_laqta_v1', 'هند الرشيد', '94567890', 'السالمية', d(-5), d(25), [
      { name: 'سماعات لاسلكية', desc: 'TWS', qty: 2, price: 9.0 },
    ], 1.0, 9.0),
  ]

  const all = [...tawfeerInvoices, ...mahhalInvoices, ...bossInvoices, ...laqtaInvoices]
  for (const data of all) {
    await db.invoice.create({ data })
  }

  console.log(`Seeded: ${COMPANIES.length} companies, ${CATALOG.length} catalog products, ${all.length} invoices`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
