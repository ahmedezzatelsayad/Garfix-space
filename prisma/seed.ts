// Seed script — r33: أزيلت كل البيانات التجريبية (4 شركات hardcode + 12 فاتورة + 6 منتجات
// + عملاء تجريبيون) بطلب المؤسس. القاعدة تبدأ فارغة تماماً: الشركات تُنشأ من الواجهة أو
// من الوكيل الذكي، والخطط الاشتراكية تُبذر ذاتياً من src/lib/plans.ts (ensurePlans)،
// ومحتوى الموقع العام عبر scripts/seed-site.ts.
//
// هذا الملف يبقى كنقطة تحقق صحية فقط: يطبع عدادات القاعدة ولا يكتب أي بيانات.
// Run: bun run prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const [companies, invoices, clients, catalog] = await Promise.all([
    db.company.count(),
    db.invoice.count(),
    db.client.count(),
    db.productCatalog.count(),
  ])
  console.log(
    `DB state: ${companies} companies, ${invoices} invoices, ${clients} clients, ${catalog} catalog items — ` +
    `لا بذر تلقائي (البيانات التجريبية أزيلت نهائياً).`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
