import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheDelPattern } from "@/lib/cache";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth-server";

type Tx = Prisma.TransactionClient;

/**
 * POST /api/recovery — استعادة كاملة من نسخة احتياطية (زرار Recovery)
 * العملية استبدالية (Replace): تُمحى البيانات الحالية وتُستعاد نسخة الملف
 * داخل معاملة ذرّية واحدة. إعدادات DeepSeek (المفتاح) لا تُمسّ إطلاقاً.
 */

// مفتاح النسخة → اسم موديل Prisma + جدول PostgreSQL (لضبط التسلسل)
const MODELS: Record<string, { model: keyof Tx; table: string }> = {
  companies: { model: "company", table: "Company" },
  clients: { model: "client", table: "clients" },
  invoices: { model: "invoice", table: "invoices" },
  payments: { model: "payment", table: "payments" },
  productCatalog: { model: "productCatalog", table: "product_catalog" },
  purchaseInvoices: { model: "purchaseInvoice", table: "purchase_invoices" },
  reminderLogs: { model: "reminderLog", table: "reminder_logs" },
  settings: { model: "setting", table: "settings" },
  aiConversations: { model: "aiConversation", table: "ai_conversations" },
  aiMessages: { model: "aiMessage", table: "ai_messages" },
};

// ترتيب الإدراج (الشركات أولاً ثم العملاء ثم الفواتير ثم ما يتفرع عنها)
const INSERT_ORDER = [
  "companies",
  "clients",
  "invoices",
  "payments",
  "productCatalog",
  "purchaseInvoices",
  "reminderLogs",
  "settings",
  "aiConversations",
  "aiMessages",
];

const CAPS: Record<string, number> = {
  companies: 2000,
  clients: 100000,
  invoices: 100000,
  payments: 500000,
  productCatalog: 50000,
  purchaseInvoices: 50000,
  reminderLogs: 500000,
  settings: 20000,
  aiConversations: 50000,
  aiMessages: 500000,
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  // r13: الاستعادة = أخطر عملية في النظام — تتطلب جلسة مدير
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "ملف غير صالح — ليس JSON" }, { status: 400 });
    }
    const dump = body as Record<string, unknown>;
    if (dump.app !== "garfix-accounts" || !dump.data || typeof dump.data !== "object") {
      return NextResponse.json(
        { error: "هذا الملف ليس نسخة احتياطية من نظام جرفِكس (app/data غير مطابقين)" },
        { status: 400 },
      );
    }
    const data = dump.data as Record<string, unknown>;

    // تحقق مسبق من الحدود والأنواع
    for (const [key, rows] of Object.entries(data)) {
      if (!Array.isArray(rows)) {
        return NextResponse.json({ error: `الحقل "${key}" يجب أن يكون مصفوفة` }, { status: 400 });
      }
      const cap = CAPS[key];
      if (cap !== undefined && rows.length > cap) {
        return NextResponse.json({ error: `الحجم كبير جداً في "${key}" (${rows.length} > ${cap})` }, { status: 400 });
      }
    }
    // فواتير بلا رقم أو بلا اسم عميل = ملف تالف
    const invoices = (data.invoices ?? []) as Record<string, unknown>[];
    if (invoices.some((i) => !i.invoiceNumber || !i.clientName)) {
      return NextResponse.json({ error: "توجد فواتير ناقصة الحقول الأساسية (رقم/عميل)" }, { status: 400 });
    }

    const restored: Record<string, number> = {};

    // ————— استبدال ذرّي داخل معاملة واحدة —————
    await db.$transaction(async (tx) => {
      // 1) محو البيانات الحالية بترتيب آمن للعلاقات (الأبناء قبل الآباء)
      const deleteOrder = [...INSERT_ORDER].reverse();
      for (const key of deleteOrder) {
        const { model } = MODELS[key];
        await (tx as any)[model].deleteMany({});
      }

      // 2) إعادة الإدراج بترتيب العلاقات
      for (const key of INSERT_ORDER) {
        const rows = (data[key] ?? []) as Record<string, unknown>[];
        if (!rows.length) {
          restored[key] = 0;
          continue;
        }
        const { model } = MODELS[key];
        const delegate = (tx as any)[model];
        let n = 0;
        for (const part of chunk(rows, 500)) {
          const res = await delegate.createMany({ data: part });
          n += res.count;
        }
        restored[key] = n;
      }

      // 3) إعادة ضبط التسلسلات حتى لا تتصادم الإدراجات الجديدة
      for (const { table } of Object.values(MODELS)) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`,
        );
      }
    });

    // إبطال كل الكاش بعد الاستعادة
    await cacheDelPattern("*");

    return NextResponse.json({
      ok: true,
      restored,
      backupGeneratedAt: typeof dump.generatedAt === "string" ? dump.generatedAt : null,
      engine: typeof dump.engine === "string" ? dump.engine : null,
      message: "تمت الاستعادة بنجاح — أعد تحميل الصفحة لرؤية البيانات المستعادة",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `فشلت الاستعادة: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
