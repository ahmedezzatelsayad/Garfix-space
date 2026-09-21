import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invalidateInvoices, invalidateClients } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";
import { companyMatchKeys } from "@/lib/company-access";

/**
 * POST /api/clients/merge — دمج عميلين مكررين (r11)
 * يوحّد كل فواتير «المصدر» (بمطابقة phKey للرقم) على اسم/رقم/عنوان «الهدف»
 * وينظّف صفوف جدول clients المتعلقة بالمصدر — كل ذلك داخل معاملة واحدة.
 * body: { companySlug, from: {phone, name?}, to: {phone, name, address?} }
 * r29 (C4): تنظيف صفوف المصدر/الهدف محصور الآن بشركة companySlug فقط — كان
 * يحذف صفوف كل الشركات التي تتطابق أرقامها (فقدان بيانات عبر المستأجرين).
 */

// مفتاح الرقم القانوني: أرقام فقط + إزالة + و إزالة 965 عند اتباعها بـ8 أرقام
function phKey(p: unknown): string {
  const d = String(p ?? "")
    .replace(/[^\d]/g, "");
  return /^965\d{8}$/.test(d) ? d.slice(3) : d;
}

export async function POST(req: NextRequest) {
  // r13: دمج العملاء = عملية إدارية — تتطلب جلسة مدير
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const companySlug = typeof body.companySlug === "string" ? body.companySlug : "";
    const from = (body.from ?? {}) as Record<string, unknown>;
    const to = (body.to ?? {}) as Record<string, unknown>;

    const fromPh = phKey(from.phone);
    const toPh = phKey(to.phone);
    const toName = typeof to.name === "string" ? to.name.trim() : "";
    const toPhoneRaw = typeof to.phone === "string" ? to.phone.trim() : "";
    const toAddress = typeof to.address === "string" ? to.address.trim() : undefined;

    if (!companySlug) {
      return NextResponse.json({ error: "companySlug مطلوب" }, { status: 400 });
    }
    if (!fromPh) {
      return NextResponse.json({ error: "رقم العميل المصدر مطلوب" }, { status: 400 });
    }
    if (!toPh || !toName) {
      return NextResponse.json({ error: "العميل الهدف يحتاج اسماً ورقماً" }, { status: 400 });
    }
    if (fromPh === toPh) {
      return NextResponse.json({ error: "لا يمكن دمج العميل مع نفسه (نفس الرقم)" }, { status: 400 });
    }

    // هل يوجد فعلاً فواتير للمصدر؟
    const sourceInvoices = await db.invoice.findMany({
      where: { companySlug },
      select: { id: true, clientPhone: true, clientName: true },
    });
    const toMerge = sourceInvoices.filter((inv) => phKey(inv.clientPhone) === fromPh);

    // r29 (C4): مفاتيح شركة الدمج (slug/code/name/nameAr) — تنظيف الدليل محصور بها
    const companyKeys = await companyMatchKeys([companySlug]);
    const inCompany = (c: { company: string | null }): boolean =>
      companyKeys.has(String(c.company ?? "").trim().toLowerCase());

    let merged = 0;
    let clientsRemoved = 0;

    await db.$transaction(async (tx) => {
      for (const inv of toMerge) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            clientName: toName,
            clientPhone: toPhoneRaw,
            ...(toAddress !== undefined ? { clientAddress: toAddress } : {}),
          },
        });
        merged++;
      }

      // تنظيف صفوف دليل العملاء للمصدر (أي تهجئة رقم) وتوحيد صف الهدف —
      // r29 (C4): داخل شركة companySlug فقط (كان findMany({}) لكل الشركات)
      const clientRows = await tx.client.findMany({
        where: { company: { not: null } },
      });
      const sourceRows = clientRows.filter(
        (c) => inCompany(c) && phKey(c.phone) === fromPh,
      );
      for (const row of sourceRows) {
        await tx.client.delete({ where: { id: row.id } });
        clientsRemoved++;
      }
      const targetRows = clientRows.filter(
        (c) => inCompany(c) && phKey(c.phone) === toPh,
      );
      for (const row of targetRows) {
        await tx.client.update({
          where: { id: row.id },
          data: {
            name: toName,
            phone: toPhoneRaw,
            ...(toAddress !== undefined ? { address: toAddress } : {}),
          },
        });
      }
      if (!targetRows.length && merged > 0) {
        await tx.client.create({
          data: {
            name: toName,
            phone: toPhoneRaw,
            company: companySlug, // r29 (C4): يُنسب للشركة المدمجة (كان null)
            address: toAddress ?? null,
          },
        });
      }
    });

    await invalidateInvoices(companySlug);
    await invalidateClients();

    return NextResponse.json({
      ok: true,
      merged,
      clientsRemoved,
      from: { phone: fromPh },
      to: { name: toName, phone: toPhoneRaw },
      message: `تم دمج ${merged} فاتورة في العميل «${toName}»`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `فشل الدمج: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
