import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheDelPattern } from "@/lib/cache";
import { requireAdmin } from "@/lib/auth-server";

/**
 * r12: تعديل بيانات شركة موجودة (slug = مفتاح التخزين tw_inv_…_v1).
 *
 * PUT /api/companies/[slug]
 *   { name?, nameAr?, currency?, phone?, email?, address?, city?, sellerRef?,
 *     manager?, managerPhone?, color?, accent?, cardBg?, emoji? }
 * → 200 { company }  — تحديث جزئي: فقط الحقول المُرسلة تتغير.
 *   لا يمكن تغيير slug/code من هنا (هوية الفواتير مرتبطة بها).
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const CURRENCY = /^[A-Z]{3}$/;

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function PUT(req: NextRequest, { params }: Params) {
  // r13: تعديل شركة = عملية إدارية — تتطلب جلسة مدير
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const { slug: slugParam } = await params;
    const slug = decodeURIComponent(slugParam ?? "").trim();
    if (!slug) {
      return NextResponse.json({ error: "slug مطلوب" }, { status: 400 });
    }

    const existing = await db.company.findUnique({ where: { slug } });
    if (!existing) {
      return NextResponse.json({ error: "الشركة غير موجودة" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, string | null> = {};

    const name = str(body.name);
    if (name) data.name = name;
    if (body.nameAr !== undefined) data.nameAr = str(body.nameAr) ?? null;

    if (body.currency !== undefined) {
      const cur = str(body.currency, 3)?.toUpperCase();
      if (!cur || !CURRENCY.test(cur)) {
        return NextResponse.json(
          { error: "رمز العملة يجب أن يكون 3 أحرف لاتينية (مثل KWD)" },
          { status: 400 },
        );
      }
      data.currency = cur;
    }

    // نصوص قابلة للإفراغ
    const textFields = [
      "phone",
      "email",
      "address",
      "city",
      "sellerRef",
      "manager",
      "managerPhone",
      "cardBg",
      "emoji",
    ] as const;
    for (const f of textFields) {
      if (body[f] !== undefined) data[f] = str(body[f], f === "emoji" ? 8 : 200) ?? null;
    }

    // ألوان hex قابلة للإفراغ
    for (const f of ["color", "accent"] as const) {
      if (body[f] !== undefined) {
        const v = str(body[f], 7);
        if (v && !HEX.test(v)) {
          return NextResponse.json({ error: `اللون ${f} يجب أن يكون hex مثل #1e3a5f` }, { status: 400 });
        }
        data[f] = v ?? null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا حقول للتحديث" }, { status: 400 });
    }

    const row = await db.company.update({ where: { slug }, data });

    // بيانات الشركة تظهر في: قائمة الشركات + سياق المساعد + قوالب الطباعة/الفاتورة
    await cacheDelPattern("companies:*");
    await cacheDelPattern("ai:ctx:*");

    return NextResponse.json({
      company: {
        slug: row.slug,
        code: row.code ?? row.slug,
        name: row.name,
        nameAr: row.nameAr,
        currency: row.currency,
        phone: row.phone,
        email: row.email,
        address: row.address,
        city: row.city,
        sellerRef: row.sellerRef,
        manager: row.manager,
        managerPhone: row.managerPhone,
        color: row.color,
        accent: row.accent,
        cardBg: row.cardBg,
        emoji: row.emoji,
        logo: row.logo,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
