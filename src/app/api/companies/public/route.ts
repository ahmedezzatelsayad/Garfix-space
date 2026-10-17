import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cacheWrap } from "@/lib/cache";

/**
 * r26 — تكامل Garfix.io: قائمة عامة (بلا مصادقة) بشركات ERP المتاحة للربط.
 * تُستخدم في لوحة مؤسس Garfix.io لبناء رابط ERP مخصص لكل عميل (?co=<code>).
 * لا تُرجع إلا حقول غير حساسة: الكود/الاسم/الإيموجي — بلا هواتف أو إعدادات مالية.
 * CORS مفتوح عمداً: المنصة (garfix.io) تعمل على أصل مختلف وتجلب هذه القائمة من المتصفح.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// r33: لا شركات مدمجة — القائمة من قاعدة البيانات حصراً (كود/اسم/إيموجي فقط، بلا PII)
export async function GET() {
  const list = await cacheWrap("companies:public", 300, async () => {
    try {
      const rows = await db.company.findMany({
        select: { code: true, slug: true, name: true, nameAr: true, emoji: true },
        orderBy: { id: "asc" },
      });
      return rows.map((r) => ({
        code: r.code || r.slug,
        name: r.name,
        nameAr: r.nameAr || r.name,
        emoji: r.emoji || "🏢",
      }));
    } catch {
      return []; // قاعدة غير متاحة — قائمة فارغة
    }
  });
  return NextResponse.json({ companies: list }, { headers: CORS });
}
