import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";

// GET /api/backup — تنزيل نسخة احتياطية كاملة (JSON) من قاعدة PostgreSQL
// ملاحظة أمان: مفتاح DeepSeek API لا يُضم أبداً إلى النسخة الاحتياطية.
// r13: التنزيل = عملية إدارية — تتطلب جلسة مدير.
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const [companies, clients, invoices, payments, catalog, purchases, reminders, settings, conversations, messages] =
      await Promise.all([
        db.company.findMany(),
        db.client.findMany(),
        db.invoice.findMany(),
        db.payment.findMany(),
        db.productCatalog.findMany(),
        db.purchaseInvoice.findMany(),
        db.reminderLog.findMany(),
        db.setting.findMany(),
        db.aiConversation.findMany(),
        db.aiMessage.findMany(),
      ]);

    const dump = {
      app: "garfix-accounts",
      version: 2,
      engine: "postgresql",
      generatedAt: new Date().toISOString(),
      counts: {
        companies: companies.length,
        clients: clients.length,
        invoices: invoices.length,
        payments: payments.length,
        productCatalog: catalog.length,
        purchaseInvoices: purchases.length,
        reminderLogs: reminders.length,
        settings: settings.length,
        aiConversations: conversations.length,
        aiMessages: messages.length,
      },
      data: {
        companies: companies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        clients: clients.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
        invoices: invoices.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
        payments: payments.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        productCatalog: catalog.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
        purchaseInvoices: purchases.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        reminderLogs: reminders.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        settings: settings.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString(), createdAt: r.createdAt.toISOString() })),
        aiConversations: conversations.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })),
        aiMessages: messages.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      },
    };

    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    return new NextResponse(JSON.stringify(dump, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="garfix-backup-${stamp}.json"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
