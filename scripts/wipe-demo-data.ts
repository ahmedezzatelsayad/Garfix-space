/**
 * r33 — تفريغ كل البيانات التجريبية من القاعدة (بطلب المؤسس).
 * يحذف: الشركات + الفواتير + المدفوعات + العملاء + الكتالوج + المشتريات + التذكيرات
 *       + الإعدادات + محادثات الذكاء + سجل تدقيق الوكيل + عدادات الاستخدام + طلبات الخطط.
 * يُبقي: محتوى الموقع العام (site_content) + خطط الاشتراك (subscription_plans) — محتوى إنتاجي.
 *        app_users تُفرّغ أيضاً (موظفو/مشتركون تجريبيون) — المؤسس حسابه من البيئة لا من القاعدة.
 *
 * Usage: DATABASE_URL=postgres://… bun run scripts/wipe-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const countsBefore = {
    companies: await db.company.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    clients: await db.client.count(),
    catalog: await db.productCatalog.count(),
    purchases: await db.purchaseInvoice.count(),
    reminders: await db.reminderLog.count(),
    settings: await db.setting.count(),
    aiConvos: await db.aiConversation.count(),
    audit: await db.agentAuditLog.count(),
    usage: await db.usageCounter.count(),
    planReq: await db.planRequest.count(),
    users: await db.appUser.count(),
    resets: await db.passwordReset.count(),
  };
  console.log("Before:", JSON.stringify(countsBefore));

  // الترتيب يحترم قيود المفاتيح (payments/reminders تشير لـ invoices)
  await db.payment.deleteMany({});
  await db.reminderLog.deleteMany({});
  await db.invoice.deleteMany({});
  await db.client.deleteMany({});
  await db.productCatalog.deleteMany({});
  await db.purchaseInvoice.deleteMany({});
  await db.setting.deleteMany({});
  await db.aiMessage.deleteMany({});
  await db.aiConversation.deleteMany({});
  await db.agentAuditLog.deleteMany({});
  await db.usageCounter.deleteMany({});
  await db.planRequest.deleteMany({});
  await db.passwordReset.deleteMany({});
  await db.appUser.deleteMany({});
  await db.company.deleteMany({});

  const after = {
    companies: await db.company.count(),
    invoices: await db.invoice.count(),
    users: await db.appUser.count(),
    siteContent: await db.siteContent.count(),
    plans: await db.subscriptionPlan.count(),
  };
  console.log("After:", JSON.stringify(after));
  console.log("✅ تم تفريغ البيانات التجريبية — بقي محتوى الموقع + الخطط فقط");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
